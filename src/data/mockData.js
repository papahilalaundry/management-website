/**
 * Demo seed data for Papa Hila Laundry.
 *
 * Data is generated deterministically (seeded PRNG) relative to the moment the
 * demo is first initialised, so the dashboard always looks "live": there are
 * orders received today, orders in progress, overdue orders, etc.
 *
 * Every statistic in the UI is computed from these records — nothing on the
 * dashboard is hard-coded.
 */
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, subDays, startOfMonth, subMonths, format } from 'date-fns'
import { calcOrderTotals } from '../utils/calculations'
import { formatId } from '../utils/generateIds'
import { formatCurrency, roundMoney } from '../utils/formatCurrency'
import { STAGE_VALUES } from './constants'

export const SEED_VERSION = 4

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

/* ----------------------------------------------------------- Defaults -- */
export const DEFAULT_SETTINGS = {
  business: {
    name: 'Papa Hila Laundry',
    tagline: 'Fresh. Clean. On time.',
    phone: '0722 456 789',
    email: 'hello@papahila.co.ke',
    address: 'Shop 4, Kilimani Business Centre, Argwings Kodhek Rd, Nairobi',
    hours: 'Mon–Sat 7:00 AM – 8:00 PM · Sun 9:00 AM – 4:00 PM',
    currency: 'KES',
    kraPin: 'P051234567X',
    receiptFooter: 'Thank you for choosing Papa Hila Laundry! Items not collected within 30 days are subject to storage charges.',
  },
  pricing: { taxRate: 0, taxLabel: 'VAT', expressSurcharge: 25, urgentSurcharge: 50, deliveryFee: 200 },
  notifications: { orders: true, payments: true, lowStock: true, overdue: true, sms: true, smsPreview: true },
  preferences: { dateFormat: 'dd MMM yyyy' },
  system: { latency: true, simulateErrors: false },
}

/** Demo accounts. Passwords are stored in plain text ONLY because this is a mock. */
const STAFF = [
  { id: 'STF-001', name: 'Grace Wanjiku', email: 'admin@papahila.com', password: 'Admin123!', phone: '0722 456 789', role: 'admin', status: 'active', joined: 400, title: 'Owner & Administrator' },
  { id: 'STF-002', name: 'Brian Otieno', email: 'manager@papahila.com', password: 'Manager123!', phone: '0711 238 904', role: 'manager', status: 'active', joined: 380, title: 'Operations Manager' },
  { id: 'STF-003', name: 'Faith Achieng', email: 'staff@papahila.com', password: 'Staff123!', phone: '0745 671 223', role: 'staff', status: 'active', joined: 300, title: 'Front Desk Attendant' },
  { id: 'STF-004', name: 'Kevin Mwangi', email: 'kevin.mwangi@papahila.com', password: 'Welcome123!', phone: '0798 114 552', role: 'staff', status: 'active', joined: 280, title: 'Laundry Technician' },
  { id: 'STF-005', name: 'Mercy Njeri', email: 'mercy.njeri@papahila.com', password: 'Welcome123!', phone: '0702 889 431', role: 'staff', status: 'active', joined: 210, title: 'Ironing & Finishing' },
  { id: 'STF-006', name: 'Daniel Kiprop', email: 'daniel.kiprop@papahila.com', password: 'Welcome123!', phone: '0726 503 118', role: 'staff', status: 'inactive', joined: 350, title: 'Delivery Rider' },
]

const SERVICES = [
  { id: 'SRV-01', name: 'Washing', description: 'Machine wash with premium detergent, line or tumble dried.', pricingModel: 'per_item', price: 100 },
  { id: 'SRV-02', name: 'Washing & Ironing', description: 'Full wash, dry and professional steam pressing.', pricingModel: 'per_item', price: 150 },
  { id: 'SRV-03', name: 'Ironing Only', description: 'Steam pressing for clean garments.', pricingModel: 'per_item', price: 70 },
  { id: 'SRV-04', name: 'Dry Cleaning', description: 'Solvent-based cleaning for delicate and structured garments.', pricingModel: 'per_item', price: 350 },
  { id: 'SRV-05', name: 'Duvet Cleaning', description: 'Deep cleaning for duvets of any size.', pricingModel: 'per_item', price: 500 },
  { id: 'SRV-06', name: 'Blanket Cleaning', description: 'Thorough wash and fluff dry for blankets.', pricingModel: 'per_item', price: 400 },
  { id: 'SRV-07', name: 'Curtain Cleaning', description: 'Gentle wash and press, priced per curtain panel.', pricingModel: 'per_item', price: 250 },
  { id: 'SRV-08', name: 'Suit Cleaning', description: 'Dry clean and press for 2- and 3-piece suits.', pricingModel: 'per_item', price: 450 },
  { id: 'SRV-09', name: 'Wash & Fold', description: 'Mixed everyday laundry washed, dried and neatly folded.', pricingModel: 'per_kg', price: 180 },
  { id: 'SRV-10', name: 'Special Fabric Care', description: 'Hand wash for silk, wool, lace and embellished items.', pricingModel: 'per_item', price: 300 },
  { id: 'SRV-11', name: 'Carpet Cleaning (Small)', description: 'Shampoo and dry for rugs up to 5×8 ft.', pricingModel: 'fixed', price: 1200, active: false },
]

const CUSTOMERS = [
  ['Wanjiru Kamau', '0712 345 678', 'wanjiru.kamau@gmail.com', 'Apt B4, Kilimani Heights, Kilimani'],
  ['Otieno Odhiambo', '0723 456 781', 'otieno.odhiambo@yahoo.com', 'Hse 12, Jamhuri Estate, Ngong Rd'],
  ['Akinyi Atieno', '0734 567 892', '', 'Kileleshwa, Othaya Rd'],
  ['Mwangi Njoroge', '0745 678 903', 'mwangi.njoroge@outlook.com', 'Lavington Green, James Gichuru Rd'],
  ['Chebet Kiprotich', '0756 789 014', 'chebet.k@gmail.com', 'South B, Mukoma Rd'],
  ['Omondi Ouma', '0767 890 125', '', 'Westlands, Rhapta Rd'],
  ['Njeri Wambui', '0778 901 236', 'njeri.wambui@gmail.com', 'Parklands, 3rd Avenue'],
  ['Kiptoo Rotich', '0789 012 347', 'kiptoo.rotich@gmail.com', 'Kasarani, Mwiki Rd'],
  ['Achieng Adhiambo', '0790 123 458', '', 'Ruaka, Limuru Rd'],
  ['Kariuki Gitau', '0701 234 569', 'kariuki.gitau@kenyamail.co.ke', 'Syokimau, Katani Rd'],
  ['Wairimu Muthoni', '0113 345 670', 'wairimu.m@gmail.com', 'Kilimani, Lenana Rd'],
  ['Mutua Musyoka', '0724 456 782', '', 'Embakasi, Pipeline'],
  ['Nyambura Wangari', '0735 567 893', 'nyambura.w@gmail.com', 'Riverside Drive, Westlands'],
  ['Kimani Ndungu', '0746 678 904', 'kimani.ndungu@gmail.com', 'Lang’ata, Southlands Estate'],
  ['Hassan Abdi', '0757 789 015', 'hassan.abdi@gmail.com', 'Eastleigh, 1st Avenue'],
  ['Fatuma Wanjiku', '0768 890 126', '', 'Kilimani, Ring Rd'],
  ['Juma Baraka', '0779 901 237', 'juma.baraka@gmail.com', 'Rongai, Maasai Lodge Rd'],
  ['Moraa Kemunto', '0110 012 348', 'moraa.k@gmail.com', 'Kileleshwa, Gatundu Rd'],
  ['Kosgei Kibet', '0791 123 459', 'kosgei.kibet@gmail.com', 'Hurlingham, Argwings Kodhek Rd'],
  ['Wekesa Barasa', '0702 234 560', '', 'Upper Hill, Hospital Rd'],
  ['Naliaka Nekesa', '0714 345 671', 'naliaka.n@gmail.com', 'Kilimani, Kindaruma Rd'],
  ['Kamau Githinji', '0725 456 783', 'kamau.githinji@gmail.com', 'Dennis Pritt Rd, Kilimani'],
  ['Zawadi Mwende', '0736 567 894', 'zawadi.mwende@gmail.com', 'Valley Arcade, Lavington'],
  ['Ochieng Owino', '0747 678 905', '', 'Adams Arcade, Ngong Rd'],
  ['Halima Said', '0758 789 016', 'halima.said@gmail.com', 'Kilimani, Wood Avenue'],
]

const INVENTORY = [
  ['Powder detergent (Ariel)', 'Detergents', 'kg', 42, 20, 380, 'Chandarana Wholesalers'],
  ['Liquid detergent (Omo)', 'Detergents', 'litres', 18, 15, 450, 'Chandarana Wholesalers'],
  ['Fabric softener (Downy)', 'Detergents', 'litres', 6, 10, 520, 'Supa Chem Supplies'],
  ['Bleach (Jik)', 'Chemicals', 'litres', 14, 8, 180, 'Supa Chem Supplies'],
  ['Stain remover (Vanish)', 'Chemicals', 'bottles', 0, 4, 650, 'Supa Chem Supplies'],
  ['Dry cleaning solvent', 'Chemicals', 'litres', 22, 10, 900, 'Kenchem Industrial Ltd'],
  ['Starch spray', 'Chemicals', 'bottles', 9, 6, 320, 'Chandarana Wholesalers'],
  ['Packaging bags (large, 100s)', 'Packaging', 'packs', 3, 5, 450, 'Kamukunji Packaging'],
  ['Garment covers', 'Packaging', 'rolls', 7, 4, 1200, 'Kamukunji Packaging'],
  ['Plastic hangers', 'Accessories', 'pieces', 240, 100, 15, 'Gikomba Hangers Ltd'],
  ['Wire hangers', 'Accessories', 'pieces', 60, 80, 8, 'Gikomba Hangers Ltd'],
  ['Rubber gloves', 'Protective Gear', 'pairs', 24, 10, 120, 'Chandarana Wholesalers'],
  ['Machine & floor cleaner', 'Cleaning', 'litres', 5, 4, 350, 'Supa Chem Supplies'],
  ['Receipt paper rolls', 'Accessories', 'rolls', 12, 5, 90, 'Text Book Centre'],
]

/** Garment templates: [category, name, serviceId, minQty, maxQty, weight] */
const GARMENT_TEMPLATES = [
  ['Clothing', 'Shirt', 'SRV-02', 3, 12, 10],
  ['Clothing', 'Shirt', 'SRV-03', 4, 12, 4],
  ['Clothing', 'Trousers', 'SRV-02', 2, 6, 8],
  ['Clothing', 'T-shirt', 'SRV-01', 3, 10, 5],
  ['Clothing', 'Jeans', 'SRV-01', 1, 4, 5],
  ['Clothing', 'Dress', 'SRV-02', 1, 3, 4],
  ['Clothing', 'Dress', 'SRV-10', 1, 2, 2],
  ['Clothing', 'Blouse', 'SRV-02', 1, 4, 3],
  ['Clothing', 'Suit (2-piece)', 'SRV-08', 1, 2, 4],
  ['Clothing', 'Jacket', 'SRV-04', 1, 2, 3],
  ['Clothing', 'Coat', 'SRV-04', 1, 1, 1],
  ['Clothing', 'Sweater', 'SRV-01', 1, 3, 3],
  ['Clothing', 'School uniform', 'SRV-02', 2, 6, 4],
  ['Clothing', 'Kanzu', 'SRV-02', 1, 2, 1],
  ['Clothing', 'Skirt', 'SRV-02', 1, 3, 2],
  ['Household', 'Duvet', 'SRV-05', 1, 2, 5],
  ['Household', 'Blanket', 'SRV-06', 1, 2, 3],
  ['Household', 'Curtain', 'SRV-07', 2, 6, 3],
  ['Household', 'Bedsheet', 'SRV-02', 2, 4, 4],
  ['Household', 'Towel', 'SRV-01', 2, 6, 3],
  ['Household', 'Mixed load', 'SRV-09', 4, 12, 6],
]
const INSTRUCTIONS = ['Low heat when ironing', 'Separate whites', 'No starch please', 'Hang dry only', 'Handle with care — delicate fabric', 'Light starch on collars', 'Fold, do not hang']
const CONDITIONS = ['Small stain on collar', 'Missing button (2nd from top)', 'Faded at the knees', 'Slight tear on hem — shown to customer', 'Old ink stain, may not come off', 'Loose thread on sleeve']

/* ---------------------------------------------------------- Generator -- */
export function generateSeedData(now = new Date()) {
  const rand = mulberry32(20261104)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const between = (min, max) => min + Math.floor(rand() * (max - min + 1))
  const chance = (p) => rand() < p
  const weighted = (arr, weightOf) => {
    const total = arr.reduce((s, x) => s + weightOf(x), 0)
    let r = rand() * total
    for (const x of arr) {
      r -= weightOf(x)
      if (r <= 0) return x
    }
    return arr[arr.length - 1]
  }
  const mpesaRef = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
    let s = 'S'
    for (let i = 0; i < 9; i++) s += chars[Math.floor(rand() * chars.length)]
    return s
  }
  const iso = (d) => d.toISOString()
  const today = startOfDay(now)
  const settings = structuredClone(DEFAULT_SETTINGS)

  /* Staff */
  const staff = STAFF.map(({ joined, ...s }) => ({
    ...s,
    joinedAt: iso(subDays(today, joined)),
    lastActiveAt: s.status === 'active' ? iso(subMinutes(now, between(5, 600))) : iso(subDays(now, 40)),
  }))
  const counterStaff = ['STF-003', 'STF-003', 'STF-002', 'STF-005']
  const techStaff = ['STF-004', 'STF-005', 'STF-003']

  /* Services */
  const services = SERVICES.map((s) => ({ active: true, ...s, createdAt: iso(subDays(today, 400)), updatedAt: iso(subDays(today, 170)) }))
  const svc = Object.fromEntries(services.map((s) => [s.id, s]))

  /* Customers (first-seen dates fixed later from their first order) */
  const customers = CUSTOMERS.map(([name, phone, email, address], i) => ({
    id: formatId('CUS', i + 1),
    name,
    phone: phone.replace(/\s/g, ''),
    email,
    address,
    notes: [],
    createdAt: null,
    createdBy: pick(counterStaff),
    _weight: i < 6 ? 4 : i < 14 ? 2 : 1,
    _recentOnly: i >= 20 ? (i >= 22 ? 3 : 25) : 0,
  }))

  /* Orders */
  const orders = []
  const payments = []
  for (let d = 365; d >= 0; d--) {
    let count = d <= 45 ? pick([4, 4, 5, 5, 6, 6]) : d <= 120 ? pick([2, 2, 3, 3, 3, 4]) : d <= 220 ? pick([1, 2, 2, 2, 3, 3]) : pick([1, 1, 1, 2, 2, 3])
    if (d === 0) count = Math.min(8, Math.max(2, now.getHours() - 6))
    for (let n = 0; n < count; n++) {
      const day = subDays(today, d)
      let receivedAt = setMinutes(setHours(day, between(7, 18)), between(0, 59))
      if (receivedAt > now) receivedAt = subMinutes(now, between(10, 90))
      const pool = customers.filter((c) => !c._recentOnly || d <= c._recentOnly)
      const customer = weighted(pool, (c) => c._weight)
      orders.push(buildOrder({ receivedAt, customer, d }))
    }
  }

  function buildOrder({ receivedAt, customer, d }) {
    const priority = chance(0.8) ? 'normal' : chance(0.75) ? 'express' : 'urgent'
    const dueBase = priority === 'urgent' ? addHours(receivedAt, 6) : setMinutes(setHours(addDays(receivedAt, priority === 'express' ? 1 : 2), 17), 0)
    const dueAt = dueBase
    const lineCount = weighted([1, 2, 3, 4, 5], (x) => [2, 4, 4, 2, 1][x - 1])
    const priceFactor = d > 180 ? 0.9 : 1 // prices were raised ~6 months ago; old orders keep old prices
    const items = []
    for (let i = 0; i < lineCount; i++) {
      const [category, name, serviceId, min, max] = weighted(GARMENT_TEMPLATES, (t) => t[5])
      const s = svc[serviceId]
      items.push({
        id: `g${i + 1}`,
        category,
        name,
        quantity: between(min, max),
        serviceId,
        serviceName: s.name,
        pricingModel: s.pricingModel,
        unitPrice: Math.round((s.price * priceFactor) / 10) * 10,
        instructions: chance(0.18) ? pick(INSTRUCTIONS) : '',
        condition: chance(0.1) ? pick(CONDITIONS) : '',
        status: 'received',
      })
    }
    const delivery = chance(0.15)
    const extraCharges = delivery ? settings.pricing.deliveryFee : 0
    const discount = customer._weight >= 4 && chance(0.12) ? pick([100, 150, 200]) : 0
    const totals = calcOrderTotals({ items, priority, extraCharges, discount, taxRate: 0 }, settings.pricing)

    /* status by age */
    let status
    const ageH = (now - receivedAt) / 36e5
    if (d >= 4) status = chance(0.035) ? 'cancelled' : chance(0.04) ? 'ready' : 'delivered'
    else if (d >= 2) status = weighted(['delivered', 'ready', 'ironing', 'drying', 'washing', 'cancelled'], (s) => ({ delivered: 48, ready: 28, ironing: 12, drying: 6, washing: 3, cancelled: 3 })[s])
    else if (d === 1) status = weighted(['delivered', 'ready', 'ironing', 'drying', 'washing'], (s) => ({ delivered: 12, ready: 30, ironing: 22, drying: 20, washing: 16 })[s])
    else status = ageH < 0.75 ? 'received' : weighted(['received', 'washing', 'drying', 'ironing'], (s) => ({ received: 40, washing: 32, drying: 18, ironing: 10 })[s])

    const createdBy = pick(counterStaff)
    const assignedTo = d > 120 && chance(0.25) ? 'STF-006' : pick(techStaff)

    /* stage timestamps, monotonic and never in the future */
    const stages = { received: { at: iso(receivedAt), by: createdBy } }
    const reachIdx = status === 'cancelled' ? 0 : STAGE_VALUES.indexOf(status)
    let t = receivedAt
    for (let i = 1; i <= reachIdx; i++) {
      const stage = STAGE_VALUES[i]
      const delta = stage === 'delivered' ? between(1, d >= 3 ? 40 : 8) * 60 : stage === 'ready' ? between(60, 240) : between(45, 200)
      t = addMinutes(t, delta)
      const latest = subMinutes(now, (reachIdx - i + 1) * 7)
      if (t > latest) t = latest
      if (t < receivedAt) t = addMinutes(receivedAt, i)
      stages[stage] = { at: iso(t), by: stage === 'delivered' || stage === 'ready' ? pick([createdBy, assignedTo]) : assignedTo }
    }
    items.forEach((it) => (it.status = status === 'cancelled' ? 'received' : status))
    // garment-level variety: some garments already one stage ahead
    if (['washing', 'drying', 'received'].includes(status) && items.length > 1 && chance(0.5)) {
      items[items.length - 1].status = STAGE_VALUES[STAGE_VALUES.indexOf(status) + 1]
    }

    const order = {
      id: '',
      customerId: customer.id,
      items,
      priority,
      receivedAt: iso(receivedAt),
      dueAt: iso(dueAt),
      pickupAt: chance(0.08) ? iso(receivedAt) : null,
      deliveryAt: delivery ? iso(dueAt) : null,
      assignedTo,
      status,
      stages,
      notes: chance(0.08) ? pick(['Customer will send a driver for collection.', 'Call before delivery.', 'Regular customer — fold shirts, no hangers.']) : '',
      ...totals,
      createdBy,
      createdAt: iso(receivedAt),
      updatedAt: iso(t),
      cancelledAt: null,
      cancelReason: '',
      history: [],
    }
    if (status === 'cancelled') {
      order.cancelledAt = iso(addMinutes(receivedAt, between(30, 300)))
      order.cancelReason = pick(['Customer withdrew the order', 'Duplicate order entry', 'Customer chose to collect items unwashed'])
    }

    /* payments */
    if (status !== 'cancelled') {
      const r = rand()
      const method = () => (chance(0.72) ? 'mpesa' : 'cash')
      let paid = 0
      const addPayment = (amount, at, by) => {
        if (amount <= 0) return
        const m = method()
        payments.push({
          id: '',
          orderId: null,
          _order: order,
          customerId: customer.id,
          amount,
          method: m,
          reference: m === 'mpesa' ? mpesaRef() : '',
          paidAt: iso(at),
          recordedBy: by,
          notes: '',
          previousBalance: roundMoney(order.total - paid),
          balanceAfter: roundMoney(order.total - paid - amount),
        })
        paid = roundMoney(paid + amount)
      }
      if (r < 0.42) addPayment(order.total, addMinutes(receivedAt, 2), createdBy)
      else if (r < 0.72) addPayment(Math.max(50, Math.round(order.total / 2 / 50) * 50), addMinutes(receivedAt, 2), createdBy)
      if (status === 'delivered' && paid < order.total && chance(0.93)) {
        addPayment(roundMoney(order.total - paid), new Date(stages.delivered.at), stages.delivered.by)
      }
    }
    return order
  }

  /* Guarantee a few overdue orders so the overdue workflows are visible */
  const isOpen = (o) => ['received', 'washing', 'drying', 'ironing'].includes(o.status)
  const overdueNow = orders.filter((o) => isOpen(o) && new Date(o.dueAt) < now).length
  orders
    .filter((o) => o.status === 'ready' && new Date(o.dueAt) < now && now - new Date(o.receivedAt) < 4 * 864e5)
    .slice(0, Math.max(0, 3 - overdueNow))
    .forEach((o, i) => {
      const back = i === 0 ? 'ironing' : i === 1 ? 'drying' : 'washing'
      const idx = STAGE_VALUES.indexOf(back)
      STAGE_VALUES.slice(idx + 1).forEach((s) => delete o.stages[s])
      o.status = back
      o.items.forEach((it) => (it.status = back))
    })

  /* IDs, ordering */
  orders.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  orders.forEach((o, i) => {
    o.id = `PHL-${10001 + i}`
    const c = customers.find((x) => x.id === o.customerId)
    o.history.push({
      id: `h${o.id}-1`,
      type: 'created',
      message: `Order created with ${o.items.reduce((s, it) => s + it.quantity, 0)} garments across ${o.items.length} line${o.items.length > 1 ? 's' : ''}`,
      at: o.createdAt,
      by: o.createdBy,
    })
    if (o.status === 'cancelled') {
      o.history.push({ id: `h${o.id}-2`, type: 'cancelled', message: `Order cancelled: ${o.cancelReason}`, at: o.cancelledAt, by: 'STF-002' })
    }
    if (!c.createdAt || o.receivedAt < c.createdAt) c.createdAt = o.receivedAt
  })
  payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt))
  payments.forEach((p, i) => {
    p.id = formatId('TXN', i + 1, 6)
    p.orderId = p._order.id
    delete p._order
  })

  /* customers: registration slightly before first order */
  customers.forEach((c) => {
    c.createdAt = c.createdAt ? iso(subMinutes(new Date(c.createdAt), 5)) : iso(subDays(today, between(1, 20)))
    delete c._weight
    delete c._recentOnly
  })
  const noteTargets = [
    ['CUS-0001', 'Prefers shirts folded, not on hangers.'],
    ['CUS-0004', 'Corporate client — invoices sent monthly to accounts.'],
    ['CUS-0013', 'Allergic to strong fragrances. Use unscented softener.'],
    ['CUS-0002', 'Usually pays via M-Pesa on collection.'],
  ]
  noteTargets.forEach(([id, text], i) => {
    const c = customers.find((x) => x.id === id)
    c.notes.push({ id: `n${i}`, text, createdAt: iso(addDays(new Date(c.createdAt), 3)), by: 'STF-002' })
  })

  /* Expenses */
  const expenses = []
  const addExpense = (title, category, amount, date, method, vendor, notes = '') => {
    if (date > now) return
    expenses.push({
      id: '',
      title,
      category,
      amount,
      date: iso(date),
      method,
      vendor,
      reference: method === 'mpesa' ? mpesaRef() : method === 'bank' ? `BNK${between(100000, 999999)}` : '',
      notes,
      attachmentName: '',
      recordedBy: chance(0.6) ? 'STF-002' : 'STF-001',
      createdAt: iso(date),
    })
  }
  for (let m = 12; m >= 0; m--) {
    const month = startOfMonth(subMonths(today, m))
    if (month < subDays(today, 366)) continue
    const at = (day, h = 10) => setHours(addDays(month, day - 1), h)
    const label = format(month, 'MMMM yyyy')
    addExpense(`Shop rent — ${label}`, 'Rent', 18000, at(1, 9), 'bank', 'Mr. Kamau (Landlord)')
    addExpense(`Staff wages — ${label}`, 'Salaries & Wages', 32000, at(28, 17), 'mpesa', 'Staff payroll', 'Monthly wages for laundry staff')
    addExpense('KPLC prepaid tokens', 'Electricity', between(24, 34) * 100, at(3), 'mpesa', 'Kenya Power (KPLC)')
    addExpense('KPLC prepaid tokens', 'Electricity', between(22, 32) * 100, at(17), 'mpesa', 'Kenya Power (KPLC)')
    addExpense('Water bill', 'Water', between(28, 39) * 100, at(10), 'mpesa', 'Nairobi City Water')
    addExpense('Detergent & softener restock', 'Detergents & Chemicals', between(35, 65) * 100, at(between(4, 8)), 'mpesa', 'Chandarana Wholesalers')
    addExpense('Bleach & stain removers', 'Detergents & Chemicals', between(15, 30) * 100, at(between(18, 22)), 'cash', 'Supa Chem Supplies')
    addExpense('Packaging bags & covers', 'Packaging Materials', between(15, 25) * 100, at(between(12, 15)), 'cash', 'Kamukunji Packaging')
    addExpense('Delivery boda fares', 'Transport', between(6, 14) * 100, at(between(9, 12), 16), 'mpesa', 'Boda riders (various)')
    addExpense('Delivery boda fares', 'Transport', between(5, 12) * 100, at(between(23, 26), 16), 'mpesa', 'Boda riders (various)')
    addExpense('Internet — Safaricom Home Fibre', 'Other', 2999, at(5), 'mpesa', 'Safaricom PLC')
    if (chance(0.35)) addExpense(pick(['Washing machine bearing replaced', 'Dryer belt replacement', 'Plumbing repair — drain pipe', 'Steam iron thermostat repair']), 'Repairs & Maintenance', between(18, 55) * 100, at(between(6, 25), 14), 'cash', pick(['Juakali Repairs, Gikomba', 'Fixit Appliances Ltd']))
    if (m === 9) addExpense('Industrial steam iron', 'Equipment', 14500, at(14), 'bank', 'Hotpoint Appliances')
    if (m === 4) addExpense('Ironing table (commercial)', 'Equipment', 9800, at(9), 'mpesa', 'Hotpoint Appliances')
    if (m === 10) addExpense('Single business permit renewal', 'Other', 7500, at(20), 'bank', 'Nairobi City County')
  }
  expenses.sort((a, b) => a.date.localeCompare(b.date))
  expenses.forEach((e, i) => (e.id = formatId('EXP', i + 1)))

  /* Inventory + movement history (built backwards from current stock) */
  const inventory = []
  const stockMovements = []
  INVENTORY.forEach(([name, category, unit, stock, minStock, unitCost, supplier], i) => {
    const id = formatId('INV', i + 1, 3)
    inventory.push({ id, name, category, unit, stock, minStock, unitCost, supplier, createdAt: iso(subDays(today, 300)), updatedAt: iso(subDays(now, between(0, 6))) })
    let balance = stock
    let at = subHours(now, between(3, 30))
    const moves = []
    for (let k = 0; k < 5; k++) {
      const type = k === 3 ? 'received' : k === 4 && chance(0.3) ? 'adjustment' : 'used'
      const qty = type === 'received' ? Math.max(minStock * 2, between(10, 30)) : type === 'adjustment' ? -between(1, 2) : -Math.max(1, Math.round(minStock * (0.2 + rand() * 0.5)))
      moves.push({ type, qty, at: iso(at), balanceAfter: balance })
      balance = balance - qty
      if (balance < 0) {
        moves[moves.length - 1].qty += balance
        balance = 0
      }
      at = subHours(at, between(20, 140))
    }
    moves.reverse().forEach((mv, k) =>
      stockMovements.push({
        id: `${id}-M${k + 1}`,
        itemId: id,
        type: mv.type,
        quantity: mv.qty,
        balanceAfter: mv.balanceAfter,
        reason: mv.type === 'received' ? `Restock from ${supplier}` : mv.type === 'adjustment' ? 'Stock count correction (spillage)' : 'Daily usage',
        at: mv.at,
        by: mv.type === 'received' ? 'STF-002' : pick(techStaff),
      }),
    )
  })
  stockMovements.sort((a, b) => a.at.localeCompare(b.at))

  /* Notifications derived from the data */
  const notifications = []
  const pushN = (category, title, message, link, at, read) =>
    notifications.push({ id: `NTF-${String(notifications.length + 1).padStart(4, '0')}`, category, title, message, link, createdAt: at, read })
  const cname = (id) => customers.find((c) => c.id === id)?.name
  const live = orders.filter((o) => o.status !== 'cancelled')
  live.slice(-5).forEach((o, i) => pushN('new_order', 'New order received', `${o.id} from ${cname(o.customerId)} — ${o.items.length} garment line(s), ${formatCurrency(o.total)}.`, `/orders/${o.id}`, o.createdAt, i < 2))
  live.filter((o) => o.status === 'ready').slice(-3).forEach((o) => pushN('order_ready', 'Order ready for collection', `${o.id} for ${cname(o.customerId)} is ready.`, `/orders/${o.id}`, o.stages.ready.at, false))
  live.filter((o) => ['received', 'washing', 'drying', 'ironing'].includes(o.status) && new Date(o.dueAt) < now).slice(-3).forEach((o) => pushN('overdue', 'Order overdue', `${o.id} for ${cname(o.customerId)} was due ${format(new Date(o.dueAt), 'dd MMM, h:mm a')}.`, `/orders/${o.id}`, o.dueAt, false))
  payments.slice(-4).forEach((p, i) => pushN('payment', 'Payment received', `${formatCurrency(p.amount)} via ${p.method === 'mpesa' ? 'M-Pesa' : 'Cash'} for ${p.orderId} (${cname(p.customerId)}).`, `/orders/${p.orderId}`, p.paidAt, i < 2))
  inventory.filter((it) => it.stock <= it.minStock).forEach((it) => pushN('low_stock', it.stock === 0 ? 'Out of stock' : 'Low stock alert', `${it.name}: ${it.stock} ${it.unit} left (minimum ${it.minStock}).`, `/inventory?item=${it.id}`, iso(subHours(now, between(2, 30))), false))
  const outstanding = {}
  live.forEach((o) => {
    const paid = payments.filter((p) => p.orderId === o.id).reduce((s, p) => s + p.amount, 0)
    if (o.status === 'delivered' && paid < o.total) outstanding[o.customerId] = (outstanding[o.customerId] || 0) + o.total - paid
  })
  Object.entries(outstanding).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([cid, amt]) => pushN('outstanding', 'Outstanding balance', `${cname(cid)} has ${formatCurrency(amt)} unpaid on collected orders.`, `/customers/${cid}`, iso(subHours(now, between(20, 48))), true))
  pushN('staff', 'Staff activity', 'Kevin Mwangi completed 6 orders yesterday.', '/staff', iso(subHours(now, 15)), true)
  pushN('staff', 'New staff account', 'Mercy Njeri’s account was activated by Grace Wanjiku.', '/staff', iso(subDays(now, 9)), true)
  pushN('system', 'Service prices updated', 'Prices for 10 services were revised. Existing orders keep their original prices.', '/services', iso(subDays(now, 170)), true)
  pushN('system', 'Demo environment ready', 'Demo data loaded. All payments and SMS messages in this system are simulated.', '/settings', iso(subMinutes(now, 1)), false)
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  /* Global activity feed (last 7 days) */
  const activities = []
  const since = subDays(now, 7).toISOString()
  const addA = (type, message, at, by, extra = {}) => activities.push({ id: `ACT-${activities.length + 1}`, type, message, at, by, ...extra })
  orders.filter((o) => o.createdAt >= since).forEach((o) => {
    addA('order_created', `created order ${o.id} for ${cname(o.customerId)}`, o.createdAt, o.createdBy, { orderId: o.id, customerId: o.customerId })
    Object.entries(o.stages).forEach(([stage, s]) => {
      if (stage !== 'received' && s.at >= since) addA('order_status', `moved ${o.id} to ${stage === 'ready' ? 'Ready for Collection' : stage[0].toUpperCase() + stage.slice(1)}`, s.at, s.by, { orderId: o.id, customerId: o.customerId, status: stage })
    })
  })
  payments.filter((p) => p.paidAt >= since).forEach((p) => addA('payment', `recorded ${formatCurrency(p.amount)} ${p.method === 'mpesa' ? 'M-Pesa' : 'cash'} payment for ${p.orderId}`, p.paidAt, p.recordedBy, { orderId: p.orderId, customerId: p.customerId, paymentId: p.id }))
  expenses.filter((e) => e.date >= since).forEach((e) => addA('expense', `recorded expense “${e.title}” (${formatCurrency(e.amount)})`, e.date, e.recordedBy, { expenseId: e.id }))
  stockMovements.filter((m) => m.at >= since && m.type === 'received').forEach((m) => addA('inventory', `received stock for ${inventory.find((i) => i.id === m.itemId).name}`, m.at, m.by, { itemId: m.itemId }))
  customers.filter((c) => c.createdAt >= since).forEach((c) => addA('customer_created', `registered customer ${c.name}`, c.createdAt, c.createdBy, { customerId: c.id }))
  activities.sort((a, b) => b.at.localeCompare(a.at))

  return {
    settings,
    staff,
    services,
    customers,
    orders,
    payments,
    expenses,
    inventory,
    stockMovements,
    notifications,
    activities,
    smsLog: [],
    meta: {
      seedVersion: SEED_VERSION,
      seededAt: iso(now),
      counters: {
        order: 10000 + orders.length,
        customer: customers.length,
        payment: payments.length,
        expense: expenses.length,
        inventory: inventory.length,
        staff: staff.length,
        service: services.length,
        notification: notifications.length,
        activity: activities.length,
        sms: 0,
      },
    },
  }
}

/* small date helpers not worth importing individually above */
function subMinutes(d, m) {
  return addMinutes(d, -m)
}
function subHours(d, h) {
  return addHours(d, -h)
}

