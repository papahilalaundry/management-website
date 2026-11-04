/**
 * Payments. M-Pesa is SIMULATED: payments are only recorded locally — no
 * Daraja/STK push or any real money movement takes place.
 */
import { db } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { buildContext, enrichOrder, logActivity, nowIso, pushNotification, sendSimulatedSms, staffName } from './helpers'
import { formatId } from '../utils/generateIds'
import { roundMoney, formatCurrency } from '../utils/formatCurrency'
import { validatePayment } from '../utils/validators'

/** Internal: persists a payment (used by createPayment and order creation). */
export function insertPayment(data, user, { silentSms = false } = {}) {
  const order = db.get('orders').find((o) => o.id === data.orderId)
  if (!order) throw notFound(`Order ${data.orderId}`)
  if (order.status === 'cancelled') throw new ApiError('Payments cannot be recorded on a cancelled order.')
  const paid = db.get('payments').filter((p) => p.orderId === order.id).reduce((s, p) => s + p.amount, 0)
  const outstanding = roundMoney(order.total - paid)
  const errors = validatePayment({ ...data, paidAt: data.paidAt || nowIso() }, { outstanding })
  if (Object.keys(errors).length) throw validationError(errors)

  const amount = roundMoney(data.amount)
  const payment = {
    id: formatId('TXN', db.nextCounter('payment'), 6),
    orderId: order.id,
    customerId: order.customerId,
    amount,
    method: data.method,
    reference: data.method === 'mpesa' ? (data.reference?.trim().toUpperCase() ?? '') : '',
    paidAt: new Date(data.paidAt || nowIso()).toISOString(),
    recordedBy: user.id,
    notes: data.notes?.trim() ?? '',
    previousBalance: outstanding,
    balanceAfter: roundMoney(outstanding - amount),
  }
  db.update('payments', (list) => [...list, payment])
  db.update('orders', (list) => list.map((o) => (o.id === order.id ? { ...o, updatedAt: nowIso() } : o)))
  const customer = db.get('customers').find((c) => c.id === order.customerId)
  const methodLabel = payment.method === 'mpesa' ? 'M-Pesa' : 'Cash'
  logActivity('payment', `recorded ${formatCurrency(amount)} ${methodLabel} payment for ${order.id}`, user, { orderId: order.id, customerId: order.customerId, paymentId: payment.id })
  pushNotification('payment', 'Payment received', `${formatCurrency(amount)} via ${methodLabel} for ${order.id} (${customer?.name}).`, `/orders/${order.id}`)
  const sms = silentSms ? null : sendSimulatedSms('payment_received', { customer, order, amount, balance: payment.balanceAfter }, user)
  return { ...payment, sms }
}

export const paymentService = {
  getPayments() {
    return request(() => {
      const ctx = buildContext()
      return db
        .get('payments')
        .map((p) => ({ ...p, customerName: ctx.customers.get(p.customerId)?.name ?? '—', customerPhone: ctx.customers.get(p.customerId)?.phone ?? '', recordedByName: staffName(ctx, p.recordedBy) }))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    }, { permission: 'payments.view' })
  },

  /** Orders that still have a balance — used by the "Record payment" picker. */
  getPayableOrders(customerId) {
    return request(() => {
      const ctx = buildContext()
      return db
        .get('orders')
        .filter((o) => o.status !== 'cancelled' && (!customerId || o.customerId === customerId))
        .map((o) => enrichOrder(o, ctx))
        .filter((o) => o.balance > 0)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    }, { permission: 'payments.record', latency: [100, 220] })
  },

  createPayment(data) {
    return request((user) => {
      const { sms, ...payment } = insertPayment(data, user)
      const ctx = buildContext()
      const order = enrichOrder(db.get('orders').find((o) => o.id === payment.orderId), ctx)
      return { payment: { ...payment, customerName: order.customer.name, customerPhone: order.customer.phone, recordedByName: user.name }, order, sms }
    }, { permission: 'payments.record', latency: [450, 800] })
  },
}
