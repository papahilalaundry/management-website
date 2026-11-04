import { db } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { buildContext, enrichOrder, logActivity, nowIso, pushNotification, sendSimulatedSms, staffName } from './helpers'
import { insertPayment } from './paymentService'
import { calcOrderTotals, deriveOrderStatusFromGarments } from '../utils/calculations'
import { stageIndex, stageLabel, STAGE_VALUES } from '../data/constants'
import { can } from '../utils/permissions'
import { uid } from '../utils/generateIds'
import { formatCurrency } from '../utils/formatCurrency'
import { isValidMpesaRef } from '../utils/validators'

/* ---- validation --------------------------------------------------------- */
function validateOrderInput(data, { existing } = {}) {
  const e = {}
  const customers = db.get('customers')
  if (!data.customerId) e.customerId = 'Select or register a customer'
  else if (!customers.some((c) => c.id === data.customerId)) e.customerId = 'Customer not found'

  if (!data.items?.length) e.items = 'Add at least one garment'
  const services = db.get('services')
  ;(data.items || []).forEach((it, i) => {
    if (!it.name?.trim()) e[`items.${i}.name`] = 'Garment name is required'
    if (!(Number(it.quantity) > 0)) e[`items.${i}.quantity`] = 'Quantity must be greater than zero'
    if (it.unitPrice === '' || Number.isNaN(Number(it.unitPrice)) || Number(it.unitPrice) < 0) e[`items.${i}.unitPrice`] = 'Price cannot be negative'
    const svc = services.find((s) => s.id === it.serviceId)
    if (!svc) e[`items.${i}.serviceId`] = 'Select a service'
    else if (!svc.active && !existing?.items.some((x) => x.serviceId === svc.id)) e[`items.${i}.serviceId`] = `${svc.name} is currently unavailable`
  })

  if (!data.receivedAt) e.receivedAt = 'Date received is required'
  if (!data.dueAt) e.dueAt = 'Expected completion date is required'
  else if (data.receivedAt && new Date(data.dueAt) < new Date(data.receivedAt)) e.dueAt = 'Completion cannot be earlier than the date received'
  if (data.deliveryAt && data.receivedAt && new Date(data.deliveryAt) < new Date(data.receivedAt)) e.deliveryAt = 'Delivery cannot be before the date received'
  if (data.pickupAt && data.receivedAt && new Date(data.pickupAt) > new Date(data.dueAt || data.pickupAt)) e.pickupAt = 'Pickup should be on or before the completion date'
  if (Number(data.discount) < 0) e.discount = 'Discount cannot be negative'
  if (Number(data.extraCharges) < 0) e.extraCharges = 'Charges cannot be negative'
  return e
}

function snapshotItems(items, previous = []) {
  const services = db.get('services')
  return items.map((it) => {
    const svc = services.find((s) => s.id === it.serviceId)
    const prev = previous.find((p) => p.id === it.id)
    return {
      id: prev?.id ?? uid('g'),
      category: it.category,
      name: it.name.trim(),
      quantity: Number(it.quantity),
      serviceId: svc.id,
      serviceName: svc.name,
      pricingModel: svc.pricingModel,
      unitPrice: Number(it.unitPrice), // agreed price is saved on the order; later price changes don't affect it
      instructions: it.instructions?.trim() ?? '',
      condition: it.condition?.trim() ?? '',
      status: prev?.status ?? it.status ?? 'received',
    }
  })
}

/** Status changes, history entries and payments merged into one timeline. */
function buildTimeline(order, ctx) {
  const events = [...order.history.map((h) => ({ ...h, byName: staffName(ctx, h.by) }))]
  Object.entries(order.stages).forEach(([stage, s]) => {
    if (stage === 'received') return
    events.push({ id: `stage-${stage}`, type: 'status', status: stage, message: `Status changed to ${stageLabel(stage)}`, note: s.note, at: s.at, by: s.by, byName: staffName(ctx, s.by) })
  })
  db.get('payments').filter((p) => p.orderId === order.id).forEach((p) =>
    events.push({ id: p.id, type: 'payment', message: `Payment of ${formatCurrency(p.amount)} received via ${p.method === 'mpesa' ? 'M-Pesa' : 'Cash'}${p.reference ? ` (${p.reference})` : ''}`, at: p.paidAt, by: p.recordedBy, byName: staffName(ctx, p.recordedBy) }),
  )
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

function saveOrder(order) {
  order.updatedAt = nowIso()
  db.update('orders', (list) => list.map((o) => (o.id === order.id ? order : o)))
  return order
}

function findOrder(id) {
  const order = db.get('orders').find((o) => o.id === id)
  if (!order) throw notFound(`Order ${id}`)
  return structuredClone(order)
}

/** Marks stages up to `target` complete, triggering notifications + SMS. */
function advanceStages(order, target, user, note = '') {
  const from = stageIndex(order.status)
  const to = stageIndex(target)
  const at = nowIso()
  for (let i = from + 1; i <= to; i++) {
    const stage = STAGE_VALUES[i]
    order.stages[stage] = { at, by: user.id, note: i === to ? note : 'Auto-completed' }
  }
  order.status = target
  const ctx = buildContext()
  const customer = ctx.customers.get(order.customerId)
  let sms = null
  if (to >= stageIndex('ready') && from < stageIndex('ready')) {
    pushNotification('order_ready', 'Order ready for collection', `${order.id} for ${customer?.name} is ready.`, `/orders/${order.id}`)
    if (target === 'ready') sms = sendSimulatedSms('order_ready', { customer, order }, user)
  }
  if (target === 'delivered') sms = sendSimulatedSms('order_delivered', { customer, order }, user)
  logActivity('order_status', `moved ${order.id} to ${stageLabel(target)}`, user, { orderId: order.id, customerId: order.customerId, status: target })
  return sms
}

/* ---- public API --------------------------------------------------------- */
export const orderService = {
  getOrders(params = {}) {
    return request(() => {
      const ctx = buildContext()
      let list = db.get('orders')
      if (params.customerId) list = list.filter((o) => o.customerId === params.customerId)
      if (params.assignedTo) list = list.filter((o) => o.assignedTo === params.assignedTo)
      const enriched = list.map((o) => enrichOrder(o, ctx)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      return params.limit ? enriched.slice(0, params.limit) : enriched
    }, { permission: 'orders.view' })
  },

  getOrderById(id) {
    return request(() => {
      const order = db.get('orders').find((o) => o.id === id)
      if (!order) throw notFound(`Order ${id}`)
      const ctx = buildContext()
      const enriched = enrichOrder(order, ctx)
      const customer = ctx.customers.get(order.customerId)
      return {
        ...enriched,
        customer: customer ?? enriched.customer,
        payments: db.get('payments').filter((p) => p.orderId === id).map((p) => ({ ...p, recordedByName: staffName(ctx, p.recordedBy) })).sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
        timeline: buildTimeline(order, ctx),
        stageDetails: Object.fromEntries(Object.entries(order.stages).map(([k, v]) => [k, { ...v, byName: staffName(ctx, v.by) }])),
      }
    }, { permission: 'orders.view' })
  },

  createOrder(data) {
    return request((user) => {
      const errors = validateOrderInput(data)
      const discount = Number(data.discount) || 0
      if (discount > 0 && !can(user, 'orders.discount')) errors.discount = 'Only managers and admins can apply discounts'
      const settings = db.get('settings')
      const items = Object.keys(errors).length ? [] : snapshotItems(data.items)
      const totals = calcOrderTotals({ items, priority: data.priority, extraCharges: data.extraCharges, discount, taxRate: settings.pricing.taxRate }, settings.pricing)
      const pay = data.payment && Number(data.payment.amount) > 0 ? data.payment : null
      if (pay) {
        if (Number(pay.amount) > totals.total + 0.001) errors['payment.amount'] = 'Payment cannot exceed the order total'
        if (!['mpesa', 'cash'].includes(pay.method)) errors['payment.method'] = 'Select a payment method'
        if (pay.method === 'mpesa' && pay.reference?.trim() && !isValidMpesaRef(pay.reference)) errors['payment.reference'] = 'M-Pesa codes are 10 letters/digits'
      }
      if (Object.keys(errors).length) throw validationError(errors)

      const id = `PHL-${db.nextCounter('order') + 1}`
      const at = nowIso()
      const order = {
        id,
        customerId: data.customerId,
        items,
        priority: data.priority || 'normal',
        receivedAt: new Date(data.receivedAt).toISOString(),
        dueAt: new Date(data.dueAt).toISOString(),
        pickupAt: data.pickupAt ? new Date(data.pickupAt).toISOString() : null,
        deliveryAt: data.deliveryAt ? new Date(data.deliveryAt).toISOString() : null,
        assignedTo: data.assignedTo || null,
        status: 'received',
        stages: { received: { at: new Date(data.receivedAt).toISOString(), by: user.id } },
        notes: data.notes?.trim() ?? '',
        ...totals,
        createdBy: user.id,
        createdAt: at,
        updatedAt: at,
        cancelledAt: null,
        cancelReason: '',
        history: [
          { id: uid('h'), type: 'created', message: `Order created with ${items.reduce((s, i) => s + i.quantity, 0)} garments across ${items.length} line${items.length > 1 ? 's' : ''}`, at, by: user.id },
        ],
      }
      db.update('orders', (list) => [...list, order])

      const customer = db.get('customers').find((c) => c.id === order.customerId)
      logActivity('order_created', `created order ${id} for ${customer.name}`, user, { orderId: id, customerId: customer.id })
      pushNotification('new_order', 'New order received', `${id} from ${customer.name} — ${items.length} garment line(s), ${formatCurrency(order.total)}.`, `/orders/${id}`)

      let payment = null
      if (pay) payment = insertPayment({ orderId: id, amount: Number(pay.amount), method: pay.method, reference: pay.reference, paidAt: at, notes: 'Paid at drop-off' }, user, { silentSms: true })
      const sms = sendSimulatedSms('order_received', { customer, order }, user)
      return { order: enrichOrder(order), payment, sms }
    }, { permission: 'orders.create', latency: [400, 700] })
  },

  updateOrder(id, data) {
    return request((user) => {
      const order = findOrder(id)
      if (order.status === 'cancelled') throw new ApiError('Cancelled orders cannot be edited.')
      if (order.status === 'delivered' && !can(user, 'orders.discount')) throw new ApiError('Only managers can edit delivered orders.', { status: 403 })
      const errors = validateOrderInput({ ...data, customerId: data.customerId ?? order.customerId }, { existing: order })
      const discount = Number(data.discount) || 0
      if (discount !== order.discount && !can(user, 'orders.discount')) errors.discount = 'Only managers and admins can change discounts'
      if (Object.keys(errors).length) throw validationError(errors)

      const items = snapshotItems(data.items, order.items).map((it) => (order.items.some((p) => p.id === it.id) ? it : { ...it, status: order.status }))
      const totals = calcOrderTotals({ items, priority: data.priority, extraCharges: data.extraCharges, discount, taxRate: order.taxRate }, db.get('settings').pricing)
      const paid = db.get('payments').filter((p) => p.orderId === id).reduce((s, p) => s + p.amount, 0)
      if (totals.total + 0.001 < paid) throw validationError({ items: `New total (${formatCurrency(totals.total)}) is less than the amount already paid (${formatCurrency(paid)}).` })

      Object.assign(order, {
        customerId: data.customerId ?? order.customerId,
        items,
        priority: data.priority,
        receivedAt: new Date(data.receivedAt).toISOString(),
        dueAt: new Date(data.dueAt).toISOString(),
        pickupAt: data.pickupAt ? new Date(data.pickupAt).toISOString() : null,
        deliveryAt: data.deliveryAt ? new Date(data.deliveryAt).toISOString() : null,
        assignedTo: data.assignedTo || null,
        notes: data.notes?.trim() ?? '',
        ...totals,
      })
      order.history.push({ id: uid('h'), type: 'edited', message: `Order details updated (total ${formatCurrency(order.total)})`, at: nowIso(), by: user.id })
      saveOrder(order)
      logActivity('order_edited', `edited order ${id}`, user, { orderId: id, customerId: order.customerId })
      return { order: enrichOrder(order) }
    }, { permission: 'orders.edit' })
  },

  updateOrderStatus(id, status, note = '') {
    return request((user) => {
      const order = findOrder(id)
      if (order.status === 'cancelled') throw new ApiError('This order has been cancelled.')
      if (!STAGE_VALUES.includes(status)) throw new ApiError('Invalid status.')
      const from = stageIndex(order.status)
      const to = stageIndex(status)
      if (to === from) throw new ApiError(`Order is already ${stageLabel(status)}.`)
      let sms = null
      if (to < from) {
        if (!can(user, 'orders.cancel')) throw new ApiError('Only managers can move an order back to an earlier stage.', { status: 403 })
        STAGE_VALUES.slice(to + 1).forEach((s) => delete order.stages[s])
        order.status = status
        order.items.forEach((it) => { if (stageIndex(it.status) > to) it.status = status })
        order.history.push({ id: uid('h'), type: 'status_reverted', message: `Status reverted to ${stageLabel(status)}${note ? ` — ${note}` : ''}`, at: nowIso(), by: user.id })
        logActivity('order_status', `reverted ${id} to ${stageLabel(status)}`, user, { orderId: id, customerId: order.customerId })
      } else {
        order.items.forEach((it) => { if (stageIndex(it.status) < to) it.status = status })
        sms = advanceStages(order, status, user, note)
      }
      saveOrder(order)
      return { order: enrichOrder(order), sms }
    }, { permission: 'orders.updateStatus' })
  },

  updateGarmentStatus(orderId, itemId, status) {
    return request((user) => {
      const order = findOrder(orderId)
      if (order.status === 'cancelled') throw new ApiError('This order has been cancelled.')
      const item = order.items.find((i) => i.id === itemId)
      if (!item) throw notFound('Garment')
      if (stageIndex(status) < stageIndex(item.status) && !can(user, 'orders.cancel')) throw new ApiError('Only managers can move a garment back.', { status: 403 })
      const previous = item.status
      item.status = status
      order.history.push({ id: uid('h'), type: 'garment', message: `${item.name} (×${item.quantity}) moved from ${stageLabel(previous)} to ${stageLabel(status)}`, at: nowIso(), by: user.id })
      const derived = deriveOrderStatusFromGarments(order.items)
      let sms = null
      if (stageIndex(derived) > stageIndex(order.status)) sms = advanceStages(order, derived, user, 'All garments reached this stage')
      else if (stageIndex(derived) < stageIndex(order.status)) {
        STAGE_VALUES.slice(stageIndex(derived) + 1).forEach((s) => delete order.stages[s])
        order.status = derived
      }
      saveOrder(order)
      return { order: enrichOrder(order), sms }
    }, { permission: 'orders.updateStatus', latency: [120, 260] })
  },

  cancelOrder(id, reason) {
    return request((user) => {
      const order = findOrder(id)
      if (order.status === 'cancelled') throw new ApiError('Order is already cancelled.')
      if (order.status === 'delivered') throw new ApiError('Delivered orders cannot be cancelled.')
      if (!reason?.trim()) throw validationError({ reason: 'Please give a reason for cancelling' })
      order.status = 'cancelled'
      order.cancelledAt = nowIso()
      order.cancelReason = reason.trim()
      order.history.push({ id: uid('h'), type: 'cancelled', message: `Order cancelled: ${reason.trim()}`, at: order.cancelledAt, by: user.id })
      saveOrder(order)
      logActivity('order_cancelled', `cancelled order ${id}`, user, { orderId: id, customerId: order.customerId })
      return { order: enrichOrder(order) }
    }, { permission: 'orders.cancel' })
  },
}
