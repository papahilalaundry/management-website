/**
 * Orders. An order has one or more service lines, each measured in its
 * service's unit (kg of laundry, pairs of shoes, m² of carpet, ...) at an
 * agreed price per unit. Garments/items can still be listed and counted, and
 * each one moves through the workflow stages.
 *
 * Each order stores what lists need (customer name/phone, amount paid,
 * balance, payment status, garment count) so pages can be fetched one at a time.
 */
import { orderBy, query, where } from 'firebase/firestore'
import { allocate, bumpStats, col, countOf, dayKey, docRef, fetchAll, fetchOne, fetchPage, transact } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { customerAfter, enrichOrder, logActivity, nowIso, pushNotification, sendSimulatedSms, staffName } from './helpers'
import { orderPaidPatch, writePayment } from './paymentService'
import { db } from './storage'
import { withUnit } from './catalogService'
import { calcOrderTotals, deriveOrderStatusFromGarments, garmentCount, lineTotal, paymentStatusFor } from '../utils/calculations'
import { FEEDBACK_RATINGS, formatQuantity, methodLabel, OPEN_STATUSES, ORDER_STATUS_OPTIONS, pricingUnitMeta, stageIndex, stageLabel, STAGE_VALUES, unitLabel, unitOf } from '../data/constants'
import { can } from '../utils/permissions'
import { uid } from '../utils/generateIds'
import { formatCurrency, roundMoney } from '../utils/formatCurrency'

const ORDER_ID = /^phl-?\d+$/i
export const orderIdFor = (n) => `PHL-${10000 + n}`

/* ---- validation --------------------------------------------------------- */
function validateOrderInput(data, { existing } = {}) {
  const e = {}
  if (!existing && !data.customerId) e.customerId = 'Select or register a customer'

  if (!data.lines?.length) e.lines = 'Add at least one service'
  const existingIds = new Set((existing?.lines ?? []).map((l) => l.serviceId))
  ;(data.lines || []).forEach((l, i) => {
    const svc = db.get('services').find((s) => s.id === l.serviceId)
    if (!svc) { e[`lines.${i}.serviceId`] = 'Select a service'; return }
    if (svc.active === false && !existingIds.has(svc.id)) e[`lines.${i}.serviceId`] = `${svc.name} is currently unavailable`
    const meta = pricingUnitMeta(unitOf(svc))
    const q = Number(l.quantity)
    if (l.quantity === '' || l.quantity == null || Number.isNaN(q) || q <= 0) e[`lines.${i}.quantity`] = `Enter the ${unitLabel(withUnit(svc))} quantity`
    else if (!meta.decimals && !Number.isInteger(q)) e[`lines.${i}.quantity`] = `Use a whole number of ${meta.plural}`
    else if (unitOf(svc) === 'kg' && q > 500) e[`lines.${i}.quantity`] = 'That weight looks too large — check the scale reading'
    if (svc.priceEditable && (l.unitPrice === '' || l.unitPrice == null || Number.isNaN(Number(l.unitPrice)) || Number(l.unitPrice) < 0)) e[`lines.${i}.unitPrice`] = 'Enter the agreed price'
  })

  ;(data.items || []).forEach((it, i) => {
    if (!it.name?.trim()) e[`items.${i}.name`] = 'Garment name is required'
    const q = Number(it.quantity)
    if (!(q > 0) || !Number.isInteger(q)) e[`items.${i}.quantity`] = 'Enter a whole number of pieces'
  })

  if (!data.receivedAt) e.receivedAt = 'Date received is required'
  if (!data.dueAt) e.dueAt = 'Expected completion date is required'
  else if (data.receivedAt && new Date(data.dueAt) < new Date(data.receivedAt)) e.dueAt = 'Completion cannot be earlier than the date received'
  if (data.deliveryAt && data.receivedAt && new Date(data.deliveryAt) < new Date(data.receivedAt)) e.deliveryAt = 'Delivery cannot be before the date received'
  if (Number(data.discount) < 0) e.discount = 'Discount cannot be negative'
  if (Number(data.extraCharges) < 0) e.extraCharges = 'Charges cannot be negative'
  return { errors: e }
}

/**
 * Stored service lines. The agreed price is fixed on the order: on edit, a
 * line for the same service keeps its price unless the service allows staff
 * to set the price per order.
 */
function snapshotLines(lines, previous = []) {
  return lines.map((l) => {
    const svc = withUnit(db.get('services').find((s) => s.id === l.serviceId))
    const prev = previous.find((p) => (l.id && p.id === l.id) || (!l.id && p.serviceId === svc.id))
    const unitPrice = svc.priceEditable ? Number(l.unitPrice) : prev && prev.serviceId === svc.id ? prev.unitPrice : svc.price
    const line = {
      id: prev?.serviceId === svc.id ? prev.id : uid('l'),
      serviceId: svc.id,
      serviceName: svc.name,
      unit: svc.unit,
      unitLabel: svc.unitLabel ?? '',
      quantity: Number(l.quantity),
      unitPrice,
      minCharge: prev?.serviceId === svc.id ? prev.minCharge ?? 0 : svc.minCharge ?? 0,
      notes: l.notes?.trim() ?? '',
    }
    return { ...line, total: lineTotal(line) }
  })
}

/** Fields derived from the lines, stored for lists and filters. */
const lineFields = (lines) => ({
  serviceIds: [...new Set(lines.map((l) => l.serviceId))],
  serviceNames: [...new Set(lines.map((l) => l.serviceName))],
  serviceSummary: lines.map((l) => `${l.serviceName} (${formatQuantity(l.quantity, l)})`).join(', '),
})

function snapshotItems(items, previous = [], fallbackStatus = 'received') {
  return items.map((it) => {
    const prev = previous.find((p) => p.id && p.id === it.id)
    return {
      id: prev?.id ?? uid('g'),
      category: it.category ?? 'Clothing',
      name: it.name.trim(),
      quantity: Number(it.quantity),
      instructions: it.instructions?.trim() ?? '',
      condition: it.condition?.trim() ?? '',
      status: prev?.status ?? fallbackStatus,
    }
  })
}

const iso = (v) => (v ? new Date(v).toISOString() : null)

/** Status changes, history entries and payments merged into one timeline. */
function buildTimeline(order, payments) {
  const events = (order.history ?? []).filter((h) => h.type !== 'payment').map((h) => ({ ...h, byName: staffName(h.by) }))
  Object.entries(order.stages ?? {}).forEach(([stage, s]) => {
    if (stage === 'received') return
    events.push({ id: `stage-${stage}`, type: 'status', status: stage, message: `Status changed to ${stageLabel(stage)}`, note: s.note, at: s.at, by: s.by, byName: staffName(s.by) })
  })
  payments.forEach((p) =>
    events.push({ id: p.id, type: 'payment', message: `Payment of ${formatCurrency(p.amount)} via ${methodLabel(p.method)}${p.payerName ? ` from ${p.payerName}` : ''}${p.reference ? ` (${p.reference})` : ''}${p.accountNumber ? `, account ${p.accountNumber}` : ''}`, at: p.paidAt, by: p.recordedBy, byName: staffName(p.recordedBy) }),
  )
  if (order.feedback) events.push({ id: 'feedback', type: 'feedback', message: `Client feedback recorded${order.feedback.rating ? ` (${order.feedback.rating}/5)` : ''}`, note: order.feedback.comment, at: order.feedback.at, by: order.feedback.by, byName: staffName(order.feedback.by) })
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

/** Marks stages up to `target` complete; returns notifications/SMS to write. */
function advanceStages(tx, order, target, user, note = '') {
  const from = stageIndex(order.status)
  const to = stageIndex(target)
  const at = nowIso()
  for (let i = from + 1; i <= to; i++) {
    order.stages[STAGE_VALUES[i]] = { at, by: user.id, note: i === to ? note : 'Auto-completed' }
  }
  order.status = target
  order.isOpen = OPEN_STATUSES.includes(target)
  if (target === 'delivered') order.deliveredAt = at
  const customer = { id: order.customerId, name: order.customerName, phone: order.customerPhone }
  let sms = null
  if (to >= stageIndex('ready') && from < stageIndex('ready')) {
    pushNotification(tx, 'order_ready', 'Order ready for collection', `${order.id} for ${order.customerName} is ready.`, `/orders/${order.id}`)
    if (target === 'ready') sms = sendSimulatedSms(tx, 'order_ready', { customer, order }, user)
  }
  if (target === 'delivered') sms = sendSimulatedSms(tx, 'order_delivered', { customer, order }, user)
  logActivity(tx, 'order_status', `moved ${order.id} to ${stageLabel(target)}`, user, { orderId: order.id, customerId: order.customerId, status: target })
  return sms
}

/** Reads an order inside a transaction, or throws 404. */
async function txOrder(tx, id) {
  const snap = await tx.get(docRef('orders', id))
  if (!snap.exists()) throw notFound(`Order ${id}`)
  return structuredClone(snap.data())
}

/* ---- list queries ------------------------------------------------------- */
/**
 * filters: { status: 'all'|stage|'cancelled', payment, service, staff, customerId, from, to (ISO) }
 * Equality filters are combined with the receivedAt order; Firestore merges
 * the single-field composite indexes declared in firestore.indexes.json.
 */
function listQuery({ status = 'all', payment, service, staff, customerId, from, to } = {}) {
  const parts = []
  if (status === 'all') parts.push(where('cancelled', '==', false))
  else if (status) parts.push(where('status', '==', status))
  if (payment) parts.push(where('paymentStatus', '==', payment))
  if (service) parts.push(where('serviceIds', 'array-contains', service))
  if (staff) parts.push(where('assignedTo', '==', staff))
  if (customerId) parts.push(where('customerId', '==', customerId))
  if (from) parts.push(where('receivedAt', '>=', from))
  if (to) parts.push(where('receivedAt', '<=', to))
  return query(col('orders'), ...parts, orderBy('receivedAt', 'desc'))
}

function matches(o, { status = 'all', payment, service, staff, customerId, from, to } = {}) {
  if (status === 'all' ? o.cancelled : status && o.status !== status) return false
  if (payment && o.paymentStatus !== payment) return false
  if (service && !(o.serviceIds ?? [o.serviceId]).includes(service)) return false
  if (staff && o.assignedTo !== staff) return false
  if (customerId && o.customerId !== customerId) return false
  if (from && o.receivedAt < from) return false
  if (to && o.receivedAt > to) return false
  return true
}

/** Order ID, phone prefix or customer-name prefix. */
async function search(text) {
  const q = text.trim().toLowerCase()
  if (ORDER_ID.test(q) || /^\d{5}$/.test(q)) {
    const o = await fetchOne('orders', `PHL-${q.replace(/\D/g, '')}`)
    return o ? [o] : []
  }
  const digits = q.replace(/[\s+()-]/g, '')
  if (/^\d{3,}$/.test(digits)) {
    const p = digits.startsWith('254') ? `0${digits.slice(3)}` : digits
    return fetchAll(query(col('orders'), where('customerPhone', '>=', p), where('customerPhone', '<=', `${p}`), orderBy('customerPhone')), 100)
  }
  return fetchAll(query(col('orders'), where('customerNameLower', '>=', q), where('customerNameLower', '<=', `${q}`), orderBy('customerNameLower')), 100)
}

const overdueQuery = () => query(col('orders'), where('isOpen', '==', true), where('dueAt', '<', nowIso()), orderBy('dueAt'))

/* ---- public API --------------------------------------------------------- */
export const orderService = {
  /**
   * One page of orders, newest first.
   * @param {object} params filters (see listQuery) + { search, overdue, pageSize, cursor }
   * @returns {{ rows, cursor, hasMore, total? }} total is set when all matches are returned at once (search/overdue)
   */
  listOrders({ search: text = '', overdue = false, pageSize = 20, cursor = null, ...filters } = {}) {
    return request(async () => {
      const now = new Date()
      if (text.trim() || overdue) {
        let rows = text.trim() ? await search(text) : await fetchAll(overdueQuery(), 500)
        rows = rows.filter((o) => matches(o, { ...filters, status: text.trim() && (filters.status ?? 'all') === 'all' ? '' : filters.status }) && (!overdue || (o.isOpen && o.dueAt < now.toISOString())))
        rows.sort((a, b) => (overdue ? a.dueAt.localeCompare(b.dueAt) : b.receivedAt.localeCompare(a.receivedAt)))
        return { rows: rows.map((o) => enrichOrder(o, now)), cursor: null, hasMore: false, total: rows.length }
      }
      const page = await fetchPage(listQuery(filters), { pageSize, cursor })
      return { ...page, rows: page.rows.map((o) => enrichOrder(o, now)) }
    }, { permission: 'orders.view' })
  },

  countOrders(filters = {}) {
    return request(() => countOf(listQuery(filters)), { permission: 'orders.view' })
  },

  /** { all, received, washing, ..., delivered, cancelled, overdue } counted on the server. */
  getStatusCounts() {
    return request(async () => {
      const keys = ['all', ...ORDER_STATUS_OPTIONS.map((s) => s.value)]
      const counts = await Promise.all(keys.map((k) => countOf(k === 'all' ? query(col('orders'), where('cancelled', '==', false)) : query(col('orders'), where('status', '==', k)))))
      const out = Object.fromEntries(keys.map((k, i) => [k, counts[i]]))
      out.overdue = await countOf(overdueQuery())
      return out
    }, { permission: 'orders.view' })
  },

  /** Every order matching the filters (for exports). */
  exportOrders({ search: text = '', overdue = false, ...filters } = {}) {
    return request(async () => {
      if (text.trim() || overdue) return (await orderService.listOrders({ search: text, overdue, ...filters })).rows
      const now = new Date()
      return (await fetchAll(listQuery(filters))).map((o) => enrichOrder(o, now))
    }, { permission: 'orders.view' })
  },

  getOrderById(id) {
    return request(async () => {
      const order = await fetchOne('orders', id)
      if (!order) throw notFound(`Order ${id}`)
      const payments = await fetchAll(query(col('payments'), where('orderId', '==', id), orderBy('paidAt')), 200)
      const customer = await fetchOne('customers', order.customerId)
      const enriched = enrichOrder(order)
      return {
        ...enriched,
        feedback: order.feedback ? { ...order.feedback, byName: staffName(order.feedback.by) } : null,
        customer: customer ? { ...enriched.customer, email: customer.email, address: customer.address, clientType: customer.clientType, orderCount: customer.orderCount } : enriched.customer,
        payments: payments.map((p) => ({ ...p, recordedByName: staffName(p.recordedBy) })),
        timeline: buildTimeline(order, payments),
        stageDetails: Object.fromEntries(Object.entries(order.stages).map(([k, v]) => [k, { ...v, byName: staffName(v.by) }])),
      }
    }, { permission: 'orders.view' })
  },

  /**
   * data: { customerId, lines[{ serviceId, quantity, unitPrice (only used if the service allows it), notes }],
   *         items[{category,name,quantity,instructions,condition}] (optional garment/item list),
   *         priority, receivedAt, dueAt, pickupAt, deliveryAt, assignedTo, extraCharges, discount, notes,
   *         payment?: { method, amount, expectedAmount, payerName, reference, accountNumber, paidAt } }
   */
  createOrder(data) {
    return request(async (user) => {
      const { errors } = validateOrderInput(data)
      const discount = Number(data.discount) || 0
      if (discount > 0 && !can(user, 'orders.discount')) errors.discount = 'Only managers and admins can apply discounts'
      if (Object.keys(errors).length) throw validationError(errors)
      const pay = data.payment && Number(data.payment.amount) > 0 ? data.payment : null

      const result = await transact(async (tx) => {
        const customerSnap = await tx.get(docRef('customers', data.customerId))
        if (!customerSnap.exists()) throw validationError({ customerId: 'Customer not found' })
        const customer = customerSnap.data()
        const { ids, commit } = await allocate(tx, { order: 1, payment: pay ? 1 : 0 })

        const settings = db.get('settings')
        const items = snapshotItems(data.items ?? [])
        const lines = snapshotLines(data.lines)
        const totals = calcOrderTotals({ lines, priority: data.priority, extraCharges: data.extraCharges, discount, taxRate: settings.pricing.taxRate }, settings.pricing)
        const at = nowIso()
        const receivedAt = iso(data.receivedAt)
        const order = {
          id: orderIdFor(ids.order),
          customerId: customer.id,
          customerName: customer.name,
          customerNameLower: customer.name.toLowerCase(),
          customerPhone: customer.phone,
          lines,
          ...lineFields(lines),
          items,
          garmentCount: garmentCount(items),
          priority: data.priority || 'normal',
          receivedAt,
          dueAt: iso(data.dueAt),
          pickupAt: iso(data.pickupAt),
          deliveryAt: iso(data.deliveryAt),
          deliveredAt: null,
          assignedTo: data.assignedTo || null,
          status: 'received',
          isOpen: true,
          cancelled: false,
          stages: { received: { at: receivedAt, by: user.id } },
          notes: data.notes?.trim() ?? '',
          ...totals,
          amountPaid: 0,
          balance: totals.total,
          paymentStatus: paymentStatusFor(totals.total, 0),
          feedback: null,
          createdBy: user.id,
          createdAt: at,
          updatedAt: at,
          cancelledAt: null,
          cancelReason: '',
          history: [{ id: uid('h'), type: 'created', message: `Order created: ${lineFields(lines).serviceSummary}${items.length ? `; ${garmentCount(items)} items listed` : ''}`, at, by: user.id }],
        }

        let payment = null
        if (pay) {
          payment = writePayment(tx, { id: ids.payment, order, data: { ...pay, notes: pay.notes ?? 'Paid at drop-off' }, user })
          Object.assign(order, orderPaidPatch(order, payment.amount))
        }
        commit()
        tx.set(docRef('orders', order.id), order)
        tx.update(customerSnap.ref, customerAfter(customer, { orders: 1, orderAt: receivedAt, billed: order.total, paid: payment?.amount ?? 0, outstanding: order.balance }))
        bumpStats(tx, receivedAt, { orders: 1, billed: order.total, kg: order.weightKg, garments: order.garmentCount })
        logActivity(tx, 'order_created', `created order ${order.id} for ${customer.name}`, user, { orderId: order.id, customerId: customer.id })
        pushNotification(tx, 'new_order', 'New order received', `${order.id} from ${customer.name} — ${order.serviceSummary}, ${formatCurrency(order.total)}.`, `/orders/${order.id}`)
        const sms = sendSimulatedSms(tx, 'order_received', { customer, order }, user)
        return { order, payment, sms }
      })
      return { order: enrichOrder(result.order), payment: result.payment, sms: result.sms }
    }, { permission: 'orders.create' })
  },

  updateOrder(id, data) {
    return request(async (user) => {
      const result = await transact(async (tx) => {
        const order = await txOrder(tx, id)
        if (order.cancelled) throw new ApiError('Cancelled orders cannot be edited.')
        if (order.status === 'delivered' && !can(user, 'orders.discount')) throw new ApiError('Only managers can edit delivered orders.', { status: 403 })
        const { errors } = validateOrderInput(data, { existing: order })
        const discount = Number(data.discount) || 0
        if (discount !== order.discount && !can(user, 'orders.discount')) errors.discount = 'Only managers and admins can change discounts'
        if (Object.keys(errors).length) throw validationError(errors)
        const customerSnap = await tx.get(docRef('customers', order.customerId))

        const items = snapshotItems(data.items ?? [], order.items, order.status)
        const lines = snapshotLines(data.lines, order.lines ?? [])
        const totals = calcOrderTotals({ lines, priority: data.priority, extraCharges: data.extraCharges, discount, taxRate: order.taxRate }, db.get('settings').pricing)
        if (totals.total + 0.001 < order.amountPaid) throw validationError({ lines: `New total (${formatCurrency(totals.total)}) is less than the amount already paid (${formatCurrency(order.amountPaid)}).` })

        const before = { at: order.receivedAt, total: order.total, kg: order.weightKg, garments: order.garmentCount, balance: order.balance }
        const receivedAt = iso(data.receivedAt)
        Object.assign(order, {
          lines,
          ...lineFields(lines),
          items,
          garmentCount: garmentCount(items),
          priority: data.priority,
          receivedAt,
          dueAt: iso(data.dueAt),
          pickupAt: iso(data.pickupAt),
          deliveryAt: iso(data.deliveryAt),
          assignedTo: data.assignedTo || null,
          notes: data.notes?.trim() ?? '',
          ...totals,
          balance: roundMoney(Math.max(0, totals.total - order.amountPaid)),
          paymentStatus: paymentStatusFor(totals.total, order.amountPaid),
          updatedAt: nowIso(),
        })
        order.stages.received = { ...order.stages.received, at: receivedAt }
        order.history.push({ id: uid('h'), type: 'edited', message: `Order details updated (${order.serviceSummary}; total ${formatCurrency(order.total)})`, at: nowIso(), by: user.id })

        tx.set(docRef('orders', id), order)
        if (customerSnap.exists()) tx.update(customerSnap.ref, customerAfter(customerSnap.data(), { orderAt: receivedAt, billed: order.total - before.total, outstanding: order.balance - before.balance }))
        if (dayKey(before.at) === dayKey(receivedAt)) {
          bumpStats(tx, receivedAt, { billed: order.total - before.total, kg: order.weightKg - before.kg, garments: order.garmentCount - before.garments })
        } else {
          bumpStats(tx, before.at, { orders: -1, billed: -before.total, kg: -before.kg, garments: -before.garments })
          bumpStats(tx, receivedAt, { orders: 1, billed: order.total, kg: order.weightKg, garments: order.garmentCount })
        }
        logActivity(tx, 'order_edited', `edited order ${id}`, user, { orderId: id, customerId: order.customerId })
        return order
      })
      return { order: enrichOrder(result) }
    }, { permission: 'orders.edit' })
  },

  updateOrderStatus(id, status, note = '') {
    return request(async (user) => {
      const result = await transact(async (tx) => {
        const order = await txOrder(tx, id)
        if (order.cancelled) throw new ApiError('This order has been cancelled.')
        if (!STAGE_VALUES.includes(status)) throw new ApiError('Invalid status.')
        const from = stageIndex(order.status)
        const to = stageIndex(status)
        if (to === from) throw new ApiError(`Order is already ${stageLabel(status)}.`)
        let sms = null
        if (to < from) {
          if (!can(user, 'orders.cancel')) throw new ApiError('Only managers can move an order back to an earlier stage.', { status: 403 })
          STAGE_VALUES.slice(to + 1).forEach((s) => delete order.stages[s])
          order.status = status
          order.isOpen = OPEN_STATUSES.includes(status)
          if (status !== 'delivered') order.deliveredAt = null
          order.items.forEach((it) => { if (stageIndex(it.status) > to) it.status = status })
          order.history.push({ id: uid('h'), type: 'status_reverted', message: `Status reverted to ${stageLabel(status)}${note ? ` — ${note}` : ''}`, at: nowIso(), by: user.id })
          logActivity(tx, 'order_status', `reverted ${id} to ${stageLabel(status)}`, user, { orderId: id, customerId: order.customerId })
        } else {
          order.items.forEach((it) => { if (stageIndex(it.status) < to) it.status = status })
          sms = advanceStages(tx, order, status, user, note)
        }
        order.updatedAt = nowIso()
        tx.set(docRef('orders', id), order)
        return { order, sms }
      })
      return { order: enrichOrder(result.order), sms: result.sms }
    }, { permission: 'orders.updateStatus' })
  },

  updateGarmentStatus(orderId, itemId, status) {
    return request(async (user) => {
      const result = await transact(async (tx) => {
        const order = await txOrder(tx, orderId)
        if (order.cancelled) throw new ApiError('This order has been cancelled.')
        const item = order.items.find((i) => i.id === itemId)
        if (!item) throw notFound('Garment')
        if (stageIndex(status) < stageIndex(item.status) && !can(user, 'orders.cancel')) throw new ApiError('Only managers can move a garment back.', { status: 403 })
        const previous = item.status
        item.status = status
        order.history.push({ id: uid('h'), type: 'garment', message: `${item.name} (×${item.quantity}) moved from ${stageLabel(previous)} to ${stageLabel(status)}`, at: nowIso(), by: user.id })
        const derived = deriveOrderStatusFromGarments(order.items)
        let sms = null
        if (stageIndex(derived) > stageIndex(order.status)) sms = advanceStages(tx, order, derived, user, 'All garments reached this stage')
        else if (stageIndex(derived) < stageIndex(order.status)) {
          STAGE_VALUES.slice(stageIndex(derived) + 1).forEach((s) => delete order.stages[s])
          order.status = derived
          order.isOpen = OPEN_STATUSES.includes(derived)
          if (derived !== 'delivered') order.deliveredAt = null
        }
        order.updatedAt = nowIso()
        tx.set(docRef('orders', orderId), order)
        return { order, sms }
      })
      return { order: enrichOrder(result.order), sms: result.sms }
    }, { permission: 'orders.updateStatus' })
  },

  cancelOrder(id, reason) {
    return request(async (user) => {
      if (!reason?.trim()) throw validationError({ reason: 'Please give a reason for cancelling' })
      const result = await transact(async (tx) => {
        const order = await txOrder(tx, id)
        if (order.cancelled) throw new ApiError('Order is already cancelled.')
        if (order.status === 'delivered') throw new ApiError('Delivered orders cannot be cancelled.')
        const customerSnap = await tx.get(docRef('customers', order.customerId))
        const balanceBefore = order.balance
        Object.assign(order, { status: 'cancelled', cancelled: true, isOpen: false, balance: 0, cancelledAt: nowIso(), cancelReason: reason.trim(), updatedAt: nowIso() })
        order.history.push({ id: uid('h'), type: 'cancelled', message: `Order cancelled: ${reason.trim()}`, at: order.cancelledAt, by: user.id })
        tx.set(docRef('orders', id), order)
        if (customerSnap.exists()) tx.update(customerSnap.ref, customerAfter(customerSnap.data(), { orders: -1, billed: -order.total, outstanding: -balanceBefore }))
        bumpStats(tx, order.receivedAt, { orders: -1, cancelled: 1, billed: -order.total, kg: -order.weightKg, garments: -order.garmentCount })
        logActivity(tx, 'order_cancelled', `cancelled order ${id}`, user, { orderId: id, customerId: order.customerId })
        return order
      })
      return { order: enrichOrder(result) }
    }, { permission: 'orders.cancel' })
  },

  /** Client comments/feedback on an order. data: { rating?: 1–5, comment } */
  saveFeedback(id, data) {
    return request(async (user) => {
      const rating = data.rating ? Number(data.rating) : null
      const comment = data.comment?.trim() ?? ''
      const errors = {}
      if (rating !== null && !FEEDBACK_RATINGS.some((r) => r.value === rating)) errors.rating = 'Choose a rating from 1 to 5'
      if (!comment && rating === null) errors.comment = 'Enter the client’s comment or choose a rating'
      if (Object.keys(errors).length) throw validationError(errors)
      const feedback = { rating, comment, at: nowIso(), by: user.id }
      const order = await transact(async (tx) => {
        const o = await txOrder(tx, id)
        tx.update(docRef('orders', id), { feedback, updatedAt: nowIso() })
        logActivity(tx, 'feedback', `recorded client feedback for ${id}${rating ? ` (${rating}/5)` : ''}`, user, { orderId: id, customerId: o.customerId })
        return { ...o, feedback }
      })
      return { order: enrichOrder(order), feedback: { ...feedback, byName: user.name } }
    }, { permission: 'orders.edit' })
  },
}
