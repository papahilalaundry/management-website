/**
 * Small demo data set for Papa Hila Laundry: about a dozen clients and forty
 * orders over the last six weeks, with payments (Paybill, M-Pesa number,
 * cash), client feedback, expenses and inventory.
 *
 * Generated deterministically relative to "now" so the dashboard always looks
 * live. Staff accounts are never touched — orders are assigned to the
 * existing staff members.
 */
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, subDays } from 'date-fns'
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import { firestore } from '../firebase'
import { calcOrderTotals, avgIntervalDays, clientTypeFor, garmentCount, lineTotal, paymentStatusFor } from '../utils/calculations'
import { formatId } from '../utils/generateIds'
import { roundMoney } from '../utils/formatCurrency'
import { DEFAULT_SETTINGS } from './defaults'
import { DEFAULT_RATE_PER_KG, formatQuantity, STAGE_VALUES } from './constants'

/* ---------------------------------------------------------------- PRNG -- */
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const iso = (d) => d.toISOString()
const dayKey = (v) => new Date(new Date(v).getTime() + 3 * 36e5).toISOString().slice(0, 10)

const CUSTOMERS = [
  ['Wanjiru Kamau', '0712345678', 'Kilimani Heights, Apt B4'],
  ['Otieno Odhiambo', '0723456781', 'Jamhuri Estate, Hse 12'],
  ['Akinyi Atieno', '0734567892', 'Kileleshwa, Othaya Rd'],
  ['Mwangi Njoroge', '0745678903', 'Lavington Green'],
  ['Chebet Kiprotich', '0756789014', 'South B, Mukoma Rd'],
  ['Omondi Ouma', '0767890125', 'Westlands, Rhapta Rd'],
  ['Njeri Wambui', '0778901236', 'Ngong Rd, Adams Arcade'],
  ['Kiptoo Langat', '0789012347', 'Hurlingham, Argwings Kodhek Rd'],
  ['Halima Abdi', '0790123458', 'South C, Mugoya Estate'],
  ['Mutua Musyoka', '0701234569', 'Kilimani, Lenana Rd'],
  ['Wairimu Nduta', '0110234567', 'Upper Hill, Matumbato Rd'],
  ['Barasa Wekesa', '0111345678', 'Valley Arcade, Gitanga Rd'],
]
// How often each client comes in (higher = more regular).
const VISIT_WEIGHT = [6, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1]

const GARMENTS = [
  ['Clothing', 'Shirt'], ['Clothing', 'T-shirt'], ['Clothing', 'Trousers'], ['Clothing', 'Jeans'], ['Clothing', 'Dress'],
  ['Clothing', 'Skirt'], ['Clothing', 'Sweater'], ['Clothing', 'School uniform'], ['Household', 'Bedsheet'],
  ['Household', 'Towel'], ['Household', 'Pillowcase'], ['Household', 'Curtain'], ['Household', 'Blanket'],
]

const FEEDBACK = [
  [5, 'Very clean and well folded. Will bring more next week.'],
  [5, 'Fast service, thank you!'],
  [4, 'Good job, but one shirt still had a small stain.'],
  [4, 'Happy with the ironing.'],
  [3, 'Clothes were fine but delivery was late.'],
  [5, 'Smells fresh. Best laundry in the area.'],
  [2, 'A sock went missing — please check.'],
]

const EXPENSES = [
  ['Detergent (20 L)', 'Detergents & Chemicals', 4200, 'Chandaria Supplies'],
  ['Fabric softener', 'Detergents & Chemicals', 1800, 'Chandaria Supplies'],
  ['Water bill', 'Water', 3500, 'Nairobi Water'],
  ['KPLC tokens', 'Electricity', 5000, 'KPLC'],
  ['Shop rent', 'Rent', 25000, 'Landlord'],
  ['Laundry bags', 'Packaging Materials', 1500, 'Packaging Hub'],
  ['Boda delivery fuel', 'Transport', 1200, 'Shell Ngong Rd'],
  ['Washing machine service', 'Repairs & Maintenance', 3800, 'Fundi Appliances'],
  ['Bleach', 'Detergents & Chemicals', 900, 'Chandaria Supplies'],
  ['Hangers', 'Packaging Materials', 700, 'Packaging Hub'],
  ['KPLC tokens', 'Electricity', 4500, 'KPLC'],
  ['Boda delivery fuel', 'Transport', 1000, 'Shell Ngong Rd'],
]

const INVENTORY = [
  ['Liquid detergent', 'Detergents', 'litres', 18, 10, 210, 'Chandaria Supplies'],
  ['Powder detergent', 'Detergents', 'kg', 6, 8, 180, 'Chandaria Supplies'],
  ['Fabric softener', 'Chemicals', 'litres', 9, 5, 260, 'Chandaria Supplies'],
  ['Bleach', 'Chemicals', 'litres', 4, 3, 150, 'Chandaria Supplies'],
  ['Laundry bags', 'Packaging', 'pieces', 120, 50, 12, 'Packaging Hub'],
  ['Hangers', 'Accessories', 'pieces', 80, 40, 15, 'Packaging Hub'],
  ['Stain remover', 'Chemicals', 'bottles', 0, 2, 450, 'Chandaria Supplies'],
  ['Gloves', 'Protective Gear', 'pairs', 12, 6, 80, 'Medisel'],
]

const MPESA_CODE = (rand) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let s = 'T'
  for (let i = 0; i < 9; i++) s += chars[Math.floor(rand() * chars.length)]
  return s
}

/** @param {{ now: Date, staff: Array<{id, role, status}> }} opts */
export function generateDemoData({ now = new Date(), staff = [] } = {}) {
  const rand = mulberry32(20261105)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const between = (a, b) => a + rand() * (b - a)
  const active = staff.filter((s) => s.status !== 'inactive')
  const workers = active.filter((s) => s.role === 'staff').length ? active.filter((s) => s.role === 'staff') : active
  const by = () => (active.length ? pick(active).id : null)
  const pricing = DEFAULT_SETTINGS.pricing

  // Demo services and prices — edit them on the Services page.
  const svc = (n, name, description, unit, price, extra = {}) => ({ id: formatId('SRV', n, 2), name, description, unit, unitLabel: '', price, minCharge: 0, priceEditable: false, trackItems: false, active: true, createdAt: iso(subDays(now, 60)), updatedAt: iso(subDays(now, 60)), ...extra })
  const services = [
    svc(1, 'Laundry (wash, dry & fold)', 'Everyday laundry, priced by weight.', 'kg', DEFAULT_RATE_PER_KG, { trackItems: true }),
    svc(2, 'Shoe cleaning', 'Sneakers, school shoes, boots. Price agreed per pair.', 'pair', 250, { priceEditable: true }),
    svc(3, 'Carpet cleaning', 'Shampoo, rinse and dry.', 'sqm', 150, { minCharge: 1000 }),
    svc(4, 'Curtain cleaning', 'Wash and press, per curtain panel.', 'panel', 300),
    svc(5, 'Duvet cleaning', 'Deep clean for duvets of any size.', 'piece', 500),
    svc(6, 'Ironing only', 'Pressing for already-clean garments.', 'piece', 30, { trackItems: true }),
  ]
  const [laundry, shoes, carpet, curtains, duvet] = services
  const line = (n, l, service, quantity, unitPrice = service.price) => {
    const out = { id: `l_${n}_${l}`, serviceId: service.id, serviceName: service.name, unit: service.unit, unitLabel: '', quantity, unitPrice, minCharge: service.minCharge, notes: '' }
    return { ...out, total: lineTotal(out) }
  }

  const customers = CUSTOMERS.map(([name, phone, address], i) => ({
    id: formatId('CUS', i + 1),
    name,
    nameLower: name.toLowerCase(),
    searchTokens: name.toLowerCase().split(' '),
    phone,
    email: '',
    address,
    notes: i === 0 ? [{ id: 'n_seed1', text: 'Prefers clothes folded, not hung.', createdAt: iso(subDays(now, 40)), by: by() }] : [],
    createdAt: iso(setHours(subDays(now, 50 - i * 2), 9)),
    createdBy: by(),
    orderCount: 0, firstOrderAt: null, lastOrderAt: null, avgIntervalDays: null, clientType: 'new',
    totalBilled: 0, totalPaid: 0, outstanding: 0,
  }))

  const weighted = VISIT_WEIGHT.flatMap((w, i) => Array(w).fill(i))
  const orders = []
  const payments = []
  const activities = []
  let paymentNo = 0

  for (let n = 0; n < 40; n++) {
    const c = customers[pick(weighted)]
    const daysAgo = Math.floor(between(0, 42))
    const receivedAt = addMinutes(setMinutes(setHours(subDays(now, daysAgo), 8 + Math.floor(rand() * 9)), 0), Math.floor(rand() * 59))
    if (receivedAt > now || new Date(c.createdAt) > receivedAt) continue
    const priority = rand() < 0.8 ? 'normal' : rand() < 0.7 ? 'express' : 'urgent'
    const dueAt = priority === 'urgent' ? addHours(receivedAt, 6) : setMinutes(setHours(addDays(startOfDay(receivedAt), priority === 'express' ? 1 : 2), 17), 0)
    // Most orders are laundry; some add shoes, curtains, a duvet or a carpet.
    const lines = []
    if (n % 9 !== 4) lines.push(line(n, 0, laundry, Math.round(between(2, 12) * 10) / 10))
    if (rand() < 0.25) lines.push(line(n, 1, shoes, 1 + Math.floor(rand() * 3), pick([200, 250, 300, 350])))
    if (rand() < 0.1) lines.push(line(n, 2, curtains, 2 + Math.floor(rand() * 4)))
    if (rand() < 0.1) lines.push(line(n, 3, duvet, 1))
    if (n % 9 === 4) lines.push(line(n, 4, carpet, Math.round(between(4, 12) * 10) / 10))
    const garmentLines = lines.some((l) => l.serviceId === laundry.id) ? 2 + Math.floor(rand() * 3) : 0
    const items = []
    const used = new Set()
    for (let l = 0; l < garmentLines; l++) {
      const [category, name] = pick(GARMENTS)
      if (used.has(name)) continue
      used.add(name)
      items.push({ id: `g_${n}_${l}`, category, name, quantity: 1 + Math.floor(rand() * 6), instructions: '', condition: '', status: 'received' })
    }
    const extraCharges = rand() < 0.25 ? pricing.deliveryFee : 0
    const totals = calcOrderTotals({ lines, priority, extraCharges, discount: 0, taxRate: pricing.taxRate }, pricing)
    const serviceSummary = lines.map((l) => `${l.serviceName} (${formatQuantity(l.quantity, l)})`).join(', ')

    // Status from age; a couple of open orders are left overdue on purpose.
    const ageH = (now - receivedAt) / 36e5
    let status = ageH > 96 ? (rand() < 0.9 ? 'delivered' : 'ready') : ageH > 48 ? pick(['ready', 'ready', 'ironing', 'delivered']) : ageH > 12 ? pick(['washing', 'drying', 'ironing']) : 'received'
    if (n === 7) status = 'washing' // overdue example
    const cancelled = n === 11
    const stages = { received: { at: iso(receivedAt), by: by() } }
    const reached = cancelled ? 0 : STAGE_VALUES.indexOf(status)
    let t = receivedAt
    for (let s = 1; s <= reached; s++) {
      t = addHours(t, between(2, 10))
      if (t > now) t = now
      stages[STAGE_VALUES[s]] = { at: iso(t), by: by(), note: '' }
    }
    items.forEach((it) => (it.status = cancelled ? 'received' : status))
    const wantsDelivery = rand() < 0.3
    const order = {
      id: `PHL-${10001 + orders.length}`,
      customerId: c.id,
      customerName: c.name,
      customerNameLower: c.nameLower,
      customerPhone: c.phone,
      lines,
      serviceIds: [...new Set(lines.map((l) => l.serviceId))],
      serviceNames: [...new Set(lines.map((l) => l.serviceName))],
      serviceSummary,
      items,
      garmentCount: garmentCount(items),
      priority,
      receivedAt: iso(receivedAt),
      dueAt: iso(n === 7 ? subDays(now, 1) : dueAt),
      pickupAt: null,
      deliveryAt: wantsDelivery ? iso(addHours(dueAt, 1)) : null,
      deliveredAt: status === 'delivered' && !cancelled ? stages.delivered.at : null,
      assignedTo: workers.length ? pick(workers).id : null,
      status: cancelled ? 'cancelled' : status,
      isOpen: !cancelled && ['received', 'washing', 'drying', 'ironing'].includes(status),
      cancelled,
      stages,
      notes: wantsDelivery ? `Deliver to ${c.address}` : '',
      ...totals,
      amountPaid: 0,
      balance: totals.total,
      paymentStatus: 'unpaid',
      feedback: null,
      createdBy: stages.received.by,
      createdAt: iso(receivedAt),
      updatedAt: iso(t),
      cancelledAt: cancelled ? iso(addHours(receivedAt, 2)) : null,
      cancelReason: cancelled ? 'Client changed their mind' : '',
      history: [{ id: `h_${n}`, type: 'created', message: `Order created: ${serviceSummary}`, at: iso(receivedAt), by: stages.received.by }],
    }
    if (cancelled) order.balance = 0

    // Payments: delivered orders are paid; others may have a deposit.
    const pay = (amount, at, expected) => {
      const method = rand() < 0.4 ? 'paybill' : rand() < 0.5 ? 'mpesa_number' : 'cash'
      const mpesa = method !== 'cash'
      const payer = mpesa ? (rand() < 0.8 ? c.name.toUpperCase() : pick(['JANE MUTHONI', 'PETER KAMAU', 'GRACE ACHIENG'])) : ''
      const p = {
        id: formatId('TXN', ++paymentNo, 6),
        orderId: order.id,
        customerId: c.id,
        customerName: c.name,
        customerNameLower: c.nameLower,
        customerPhone: c.phone,
        method,
        expectedAmount: roundMoney(expected),
        amount: roundMoney(amount),
        payerName: payer,
        payerNameLower: payer.toLowerCase(),
        reference: mpesa ? MPESA_CODE(rand) : '',
        paidAt: iso(at),
        recordedBy: by(),
        notes: '',
        previousBalance: order.balance,
        balanceAfter: roundMoney(order.balance - amount),
        createdAt: iso(at),
      }
      payments.push(p)
      order.amountPaid = roundMoney(order.amountPaid + p.amount)
      order.balance = roundMoney(order.total - order.amountPaid)
      activities.push({ id: `ACT-SEED-P${paymentNo}`, type: 'payment', message: `recorded payment for ${order.id}`, at: p.paidAt, by: p.recordedBy, orderId: order.id, customerId: c.id, paymentId: p.id })
    }
    if (!cancelled) {
      if (status === 'delivered') {
        if (rand() < 0.3) {
          const deposit = Math.round(order.total / 2 / 10) * 10
          pay(deposit, addMinutes(receivedAt, 5), order.total)
          pay(order.balance, new Date(stages.delivered.at), order.balance)
        } else pay(order.total, new Date(stages.delivered.at), order.total)
      } else if (status === 'ready' && rand() < 0.4) pay(order.total, new Date(stages.ready.at), order.total)
      else if (rand() < 0.35) {
        const expected = order.total
        const deposit = Math.round(order.total / 2 / 10) * 10
        pay(deposit, addMinutes(receivedAt, 5), expected)
      }
    }
    order.paymentStatus = paymentStatusFor(order.total, order.amountPaid)

    if (status === 'delivered' && !cancelled && rand() < 0.4) {
      const [rating, comment] = pick(FEEDBACK)
      order.feedback = { rating, comment, at: iso(addHours(new Date(stages.delivered.at), 3) > now ? now : addHours(new Date(stages.delivered.at), 3)), by: by() }
    }
    orders.push(order)
    activities.push({ id: `ACT-SEED-O${n}`, type: 'order_created', message: `created order ${order.id} for ${c.name}`, at: order.receivedAt, by: order.createdBy, orderId: order.id, customerId: c.id })
  }

  // Client visit stats from their orders.
  for (const c of customers) {
    const own = orders.filter((o) => o.customerId === c.id && !o.cancelled).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
    c.orderCount = own.length
    c.firstOrderAt = own[0]?.receivedAt ?? null
    c.lastOrderAt = own.at(-1)?.receivedAt ?? null
    c.avgIntervalDays = avgIntervalDays(c.firstOrderAt, c.lastOrderAt, c.orderCount)
    c.clientType = clientTypeFor(c.orderCount)
    c.totalBilled = roundMoney(own.reduce((s, o) => s + o.total, 0))
    c.totalPaid = roundMoney(payments.filter((p) => p.customerId === c.id).reduce((s, p) => s + p.amount, 0))
    c.outstanding = roundMoney(own.reduce((s, o) => s + o.balance, 0))
  }

  const expenses = EXPENSES.map(([title, category, amount, vendor], i) => {
    const date = setHours(subDays(now, Math.floor((i / EXPENSES.length) * 40) + 1), 11)
    return { id: formatId('EXP', i + 1), title, titleLower: title.toLowerCase(), category, amount, date: iso(date), method: pick(['mpesa', 'cash', 'bank']), vendor, reference: '', notes: '', attachmentName: '', recordedBy: by(), createdAt: iso(date) }
  })

  const inventory = INVENTORY.map(([name, category, unit, stock, minStock, unitCost, supplier], i) => ({
    id: formatId('INV', i + 1, 3), name, category, unit, stock, minStock, unitCost, supplier, createdAt: iso(subDays(now, 45)), updatedAt: iso(subDays(now, 3)),
  }))
  const stockMovements = inventory.map((it, i) => ({ id: `MOV-SEED-${i + 1}`, itemId: it.id, type: 'received', quantity: it.stock + 5, balanceAfter: it.stock + 5, reason: 'Opening stock', at: iso(subDays(now, 45)), by: by() }))
  inventory.forEach((it, i) => stockMovements.push({ id: `MOV-SEED-U${i + 1}`, itemId: it.id, type: 'used', quantity: -5, balanceAfter: it.stock, reason: 'Weekly use', at: iso(subDays(now, 3)), by: by() }))

  const open = orders.filter((o) => o.isOpen)
  const notifications = [
    ...orders.slice(-4).map((o, i) => ({ id: `NTF-SEED-${i + 1}`, category: 'new_order', title: 'New order received', message: `${o.id} from ${o.customerName} — ${o.serviceSummary}.`, link: `/orders/${o.id}`, createdAt: o.receivedAt, read: i < 2 })),
    ...payments.slice(-2).map((p, i) => ({ id: `NTF-SEED-P${i + 1}`, category: 'payment', title: 'Payment received', message: `KES ${p.amount} for ${p.orderId} (${p.customerName}).`, link: `/orders/${p.orderId}`, createdAt: p.paidAt, read: false })),
    { id: 'NTF-SEED-L1', category: 'low_stock', title: 'Out of stock', message: 'Stain remover: 0 bottles left (minimum 2).', link: '/inventory?item=INV-007', createdAt: iso(subDays(now, 3)), read: false },
    ...(open[0] ? [{ id: 'NTF-SEED-O1', category: 'overdue', title: 'Order overdue', message: `${open[0].id} for ${open[0].customerName} is past its due time.`, link: `/orders/${open[0].id}`, createdAt: iso(subDays(now, 1)), read: false }] : []),
  ]

  // Daily summaries, exactly as the services would have built them.
  const stats = new Map()
  const bump = (at, f) => {
    const k = dayKey(at)
    const s = stats.get(k) ?? { date: k }
    for (const [key, v] of Object.entries(f)) {
      if (v && typeof v === 'object') {
        s[key] = s[key] ?? {}
        for (const [kk, vv] of Object.entries(v)) s[key][kk] = roundMoney((s[key][kk] || 0) + vv)
      } else s[key] = Math.round(((s[key] || 0) + v) * 100) / 100
    }
    stats.set(k, s)
  }
  orders.forEach((o) => (o.cancelled ? bump(o.receivedAt, { cancelled: 1 }) : bump(o.receivedAt, { orders: 1, billed: o.total, kg: o.weightKg, garments: o.garmentCount })))
  payments.forEach((p) => bump(p.paidAt, { revenue: p.amount, payments: 1, revenueByMethod: { [p.method]: p.amount } }))
  expenses.forEach((e) => bump(e.date, { expenses: e.amount, expenseByCategory: { [e.category]: e.amount } }))

  return {
    services,
    customers,
    orders,
    payments,
    expenses,
    inventory,
    stockMovements,
    notifications,
    activities,
    stats: [...stats.values()],
    counters: { order: orders.length, customer: customers.length, payment: payments.length, expense: expenses.length, inventory: inventory.length, service: services.length },
  }
}

/** Collections replaced by a demo reset (staff, users and settings are kept). */
export const DEMO_COLLECTIONS = ['services', 'customers', 'orders', 'payments', 'expenses', 'inventory', 'stockMovements', 'notifications', 'activities', 'smsLog', 'stats']

async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(firestore)
    ops.slice(i, i + 450).forEach((op) => op(batch))
    await batch.commit()
  }
}

/** Deletes everything in the demo collections, then writes a fresh demo set. */
export async function resetDemoData({ staff, now = new Date() }) {
  const deletes = []
  for (const name of DEMO_COLLECTIONS) {
    const snap = await getDocs(collection(firestore, name))
    snap.docs.forEach((d) => deletes.push((b) => b.delete(d.ref)))
  }
  await commitInChunks(deletes)

  const data = generateDemoData({ now, staff })
  const writes = []
  for (const name of DEMO_COLLECTIONS.filter((n) => n !== 'smsLog')) {
    const idOf = name === 'stats' ? (r) => r.date : (r) => r.id
    data[name].forEach((row) => writes.push((b) => b.set(doc(firestore, name, idOf(row)), row)))
  }
  writes.push((b) => b.set(doc(firestore, 'app', 'counters'), data.counters, { merge: true }))
  await commitInChunks(writes)
  return data
}
