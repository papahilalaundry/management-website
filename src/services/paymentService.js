/**
 * Payments. Each payment records the mode (Paybill, M-Pesa number or Cash),
 * the estimated amount the client was expected to pay, the amount actually
 * paid, the date paid, and — for M-Pesa — the payer's name and M-Pesa code.
 *
 * M-Pesa is NOT integrated: payments are entered by staff from the M-Pesa
 * message; no money moves through this system.
 */
import { orderBy, query, where } from 'firebase/firestore'
import { allocate, bumpStats, col, countOf, docRef, fetchAll, fetchOne, fetchPage, sumOf, transact } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { customerAfter, enrichOrder, logActivity, nowIso, pushNotification, sendSimulatedSms, staffName } from './helpers'
import { loadDailyStats, totalsBetween } from './stats'
import { formatId, uid } from '../utils/generateIds'
import { roundMoney, formatCurrency } from '../utils/formatCurrency'
import { paymentStatusFor } from '../utils/calculations'
import { isMpesaMethod, methodLabel } from '../data/constants'
import { validatePayment } from '../utils/validators'

const withNames = (p) => ({ ...p, recordedByName: staffName(p.recordedBy), customerPhone: p.customerPhone ?? '' })

/**
 * Internal, inside a transaction: validates and writes a payment for `order`
 * (as it is before the payment). The caller updates the order and customer.
 * @returns {object} the payment
 */
export function writePayment(tx, { id, order, data, user }) {
  if (order.cancelled) throw new ApiError('Payments cannot be recorded on a cancelled order.')
  const outstanding = roundMoney(order.balance)
  const paidAt = data.paidAt ? new Date(data.paidAt).toISOString() : nowIso()
  const errors = validatePayment({ ...data, orderId: order.id, paidAt }, { outstanding })
  if (Object.keys(errors).length) throw validationError(errors)

  const amount = roundMoney(data.amount)
  const mpesa = isMpesaMethod(data.method)
  const payment = {
    id: formatId('TXN', id, 6),
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    customerNameLower: order.customerName.toLowerCase(),
    customerPhone: order.customerPhone,
    method: data.method,
    expectedAmount: data.expectedAmount === '' || data.expectedAmount == null ? outstanding : roundMoney(data.expectedAmount),
    amount,
    payerName: mpesa ? data.payerName.trim() : '',
    payerNameLower: mpesa ? data.payerName.trim().toLowerCase() : '',
    reference: mpesa ? (data.reference?.trim().toUpperCase() ?? '') : '',
    paidAt,
    recordedBy: user.id,
    notes: data.notes?.trim() ?? '',
    previousBalance: outstanding,
    balanceAfter: roundMoney(outstanding - amount),
    createdAt: nowIso(),
  }
  tx.set(docRef('payments', payment.id), payment)
  bumpStats(tx, paidAt, { revenue: amount, payments: 1, revenueByMethod: { [data.method]: amount } })
  return payment
}

/** The order fields after adding `amount` to what has been paid. */
export function orderPaidPatch(order, amount) {
  const amountPaid = roundMoney((order.amountPaid || 0) + amount)
  return { amountPaid, balance: roundMoney(Math.max(0, order.total - amountPaid)), paymentStatus: paymentStatusFor(order.total, amountPaid) }
}

/* ---- list queries ---------------------------------------------------------- */
function listQuery({ from, to, method } = {}) {
  const parts = []
  if (method) parts.push(where('method', '==', method))
  if (from) parts.push(where('paidAt', '>=', from))
  if (to) parts.push(where('paidAt', '<=', to))
  return query(col('payments'), ...parts, orderBy('paidAt', 'desc'))
}

async function search(text) {
  const q = text.trim()
  if (/^txn-?\d+$/i.test(q)) {
    const p = await fetchOne('payments', formatId('TXN', Number(q.replace(/\D/g, '')), 6))
    return p ? [p] : []
  }
  if (/^phl-?\d+$/i.test(q)) return fetchAll(query(col('payments'), where('orderId', '==', `PHL-${q.replace(/\D/g, '')}`)), 50)
  if (/^[a-z0-9]{10}$/i.test(q) && /\d/.test(q) && /[a-z]/i.test(q)) {
    const byRef = await fetchAll(query(col('payments'), where('reference', '==', q.toUpperCase())), 10)
    if (byRef.length) return byRef
  }
  const l = q.toLowerCase()
  const [byCustomer, byPayer] = await Promise.all([
    fetchAll(query(col('payments'), where('customerNameLower', '>=', l), where('customerNameLower', '<=', `${l}`), orderBy('customerNameLower')), 50),
    fetchAll(query(col('payments'), where('payerNameLower', '>=', l), where('payerNameLower', '<=', `${l}`), orderBy('payerNameLower')), 50),
  ])
  return [...new Map([...byCustomer, ...byPayer].map((p) => [p.id, p])).values()]
}

export const paymentService = {
  /**
   * One page of payments, newest first.
   * @param {object} params { from, to (ISO), method, search, pageSize, cursor }
   */
  listPayments({ search: text = '', pageSize = 20, cursor = null, ...filters } = {}) {
    return request(async () => {
      if (text.trim()) {
        const rows = (await search(text))
          .filter((p) => (!filters.method || p.method === filters.method) && (!filters.from || p.paidAt >= filters.from) && (!filters.to || p.paidAt <= filters.to))
          .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
        return { rows: rows.map(withNames), cursor: null, hasMore: false, total: rows.length }
      }
      const page = await fetchPage(listQuery(filters), { pageSize, cursor })
      return { ...page, rows: page.rows.map(withNames) }
    }, { permission: 'payments.view' })
  },

  countPayments(filters = {}) {
    return request(() => countOf(listQuery(filters)), { permission: 'payments.view' })
  },

  exportPayments(filters = {}) {
    return request(async () => (await fetchAll(listQuery(filters))).map(withNames), { permission: 'payments.view' })
  },

  /** Totals for a date range (from the daily summaries) plus today's and outstanding balances. */
  getPaymentStats({ from, to }) {
    return request(async () => {
      const now = nowIso()
      const lo = from < now ? from : now
      const days = await loadDailyStats(lo, to > now ? to : now)
      const period = totalsBetween(days, from, to)
      const today = totalsBetween(days, now, now)
      const owing = query(col('orders'), where('balance', '>', 0))
      const [outstanding, outstandingCount] = await Promise.all([sumOf(owing, 'balance'), countOf(owing)])
      return {
        total: period.revenue,
        count: period.payments,
        byMethod: period.revenueByMethod,
        today: today.revenue,
        todayCount: today.payments,
        outstanding: roundMoney(outstanding),
        outstandingCount,
      }
    }, { permission: 'payments.view' })
  },

  /** Orders that still have a balance — used by the "Record payment" picker. */
  getPayableOrders(customerId) {
    return request(async () => {
      const parts = customerId ? [where('customerId', '==', customerId)] : []
      const rows = await fetchAll(query(col('orders'), ...parts, where('balance', '>', 0), orderBy('balance', 'desc')), 50)
      const now = new Date()
      return rows.map((o) => enrichOrder(o, now)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    }, { permission: 'payments.record' })
  },

  /**
   * @param data { orderId, method: paybill|mpesa_number|cash, amount, expectedAmount, payerName, reference, paidAt, notes }
   */
  createPayment(data) {
    return request(async (user) => {
      const result = await transact(async (tx) => {
        const orderSnap = await tx.get(docRef('orders', data.orderId ?? '-'))
        if (!data.orderId || !orderSnap.exists()) throw notFound(`Order ${data.orderId ?? ''}`.trim())
        const order = orderSnap.data()
        const customerSnap = await tx.get(docRef('customers', order.customerId))
        const { ids, commit } = await allocate(tx, { payment: 1 })

        const payment = writePayment(tx, { id: ids.payment, order, data, user })
        commit()
        const patch = orderPaidPatch(order, payment.amount)
        const label = methodLabel(payment.method)
        tx.update(docRef('orders', order.id), {
          ...patch,
          updatedAt: nowIso(),
          history: [...order.history, { id: uid('h'), type: 'payment', message: `${formatCurrency(payment.amount)} paid via ${label}${payment.payerName ? ` by ${payment.payerName}` : ''}`, at: nowIso(), by: user.id }],
        })
        if (customerSnap.exists()) tx.update(customerSnap.ref, customerAfter(customerSnap.data(), { paid: payment.amount, outstanding: -payment.amount }))
        logActivity(tx, 'payment', `recorded ${formatCurrency(payment.amount)} ${label} payment for ${order.id}`, user, { orderId: order.id, customerId: order.customerId, paymentId: payment.id })
        pushNotification(tx, 'payment', 'Payment received', `${formatCurrency(payment.amount)} via ${label} for ${order.id} (${order.customerName}).`, `/orders/${order.id}`)
        const updated = { ...order, ...patch }
        const sms = sendSimulatedSms(tx, 'payment_received', { customer: { id: order.customerId, name: order.customerName, phone: order.customerPhone }, order, amount: payment.amount, balance: patch.balance }, user)
        return { payment, order: updated, sms }
      })
      return { payment: { ...withNames(result.payment), recordedByName: user.name }, order: enrichOrder(result.order), sms: result.sms }
    }, { permission: 'payments.record' })
  },
}
