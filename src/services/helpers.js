/**
 * Internal helpers shared by the mock services (not used by UI components).
 * In a real backend, this logic would live on the server.
 */
import { db } from './storage'
import { formatId } from '../utils/generateIds'
import { isOrderOverdue, paymentStatusFor, sum } from '../utils/calculations'
import { roundMoney, formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { SMS_TEMPLATES } from '../data/constants'

const MAX_ACTIVITIES = 600
const MAX_NOTIFICATIONS = 200

export const nowIso = () => new Date().toISOString()

/* ---- lookups ------------------------------------------------------------ */
export function buildContext() {
  const customers = new Map(db.get('customers').map((c) => [c.id, c]))
  const staff = new Map(db.get('staff').map((s) => [s.id, s]))
  const paidByOrder = new Map()
  for (const p of db.get('payments')) paidByOrder.set(p.orderId, (paidByOrder.get(p.orderId) || 0) + p.amount)
  return { customers, staff, paidByOrder, now: new Date() }
}

export const staffName = (ctx, id) => ctx.staff.get(id)?.name ?? 'System'

/** Adds derived fields (customer, paid, balance, statuses) to a stored order. */
export function enrichOrder(order, ctx = buildContext()) {
  const c = ctx.customers.get(order.customerId)
  const amountPaid = roundMoney(ctx.paidByOrder.get(order.id) || 0)
  const cancelled = order.status === 'cancelled'
  const balance = cancelled ? 0 : roundMoney(Math.max(0, order.total - amountPaid))
  return {
    ...order,
    customer: c ? { id: c.id, name: c.name, phone: c.phone, email: c.email, address: c.address } : { id: order.customerId, name: 'Unknown customer', phone: '' },
    amountPaid,
    balance,
    paymentStatus: cancelled && amountPaid === 0 ? 'unpaid' : paymentStatusFor(order.total, amountPaid),
    garmentCount: order.items.reduce((s, i) => s + (i.pricingModel === 'per_kg' ? 1 : Number(i.quantity) || 0), 0),
    serviceNames: [...new Set(order.items.map((i) => i.serviceName))],
    isOverdue: isOrderOverdue(order, ctx.now),
    assignedName: staffName(ctx, order.assignedTo),
    createdByName: staffName(ctx, order.createdBy),
  }
}

/** Outstanding balance across a customer's non-cancelled orders. */
export function customerOutstanding(customerId, ctx = buildContext()) {
  return sum(
    db.get('orders').filter((o) => o.customerId === customerId && o.status !== 'cancelled'),
    (o) => Math.max(0, o.total - (ctx.paidByOrder.get(o.id) || 0)),
  )
}

/* ---- activity log ------------------------------------------------------- */
export function logActivity(type, message, user, extra = {}) {
  const n = db.nextCounter('activity')
  const entry = { id: `ACT-${n}`, type, message, at: nowIso(), by: user?.id ?? null, ...extra }
  db.update('activities', (list) => [entry, ...list].slice(0, MAX_ACTIVITIES))
  return entry
}

/* ---- notifications ------------------------------------------------------ */
const CATEGORY_PREF = {
  new_order: 'orders', order_ready: 'orders', overdue: 'overdue', payment: 'payments',
  outstanding: 'payments', low_stock: 'lowStock',
}

export function pushNotification(category, title, message, link) {
  const prefs = db.get('settings').notifications
  const prefKey = CATEGORY_PREF[category]
  if (prefKey && prefs[prefKey] === false) return null
  const n = db.nextCounter('notification')
  const entry = { id: formatId('NTF', n), category, title, message, link, createdAt: nowIso(), read: false }
  db.update('notifications', (list) => [entry, ...list].slice(0, MAX_NOTIFICATIONS))
  return entry
}

/* ---- simulated SMS ------------------------------------------------------ */
/**
 * DEMO ONLY — no SMS is actually sent. The message is rendered from a template
 * and stored in the SMS log so it can be previewed in the UI.
 */
export function sendSimulatedSms(templateKey, { customer, order, amount, balance }, user) {
  const prefs = db.get('settings').notifications
  if (!prefs.sms || !customer) return null
  const tpl = SMS_TEMPLATES[templateKey]
  const message = tpl.text
    .replace('{name}', customer.name.split(' ')[0])
    .replace('{orderId}', order.id)
    .replace('{date}', formatDate(order.dueAt))
    .replace('{amount}', formatCurrency(amount ?? 0, { decimals: 0 }))
    .replace('{balance}', formatCurrency(balance ?? 0, { decimals: 0 }))
  const n = db.nextCounter('sms')
  const entry = {
    id: formatId('SMS', n, 5),
    template: templateKey,
    templateLabel: tpl.label,
    to: customer.phone,
    customerName: customer.name,
    customerId: customer.id,
    orderId: order.id,
    message,
    sentAt: nowIso(),
    sentBy: user?.id ?? null,
    status: 'simulated',
  }
  db.update('smsLog', (list) => [entry, ...list].slice(0, 300))
  return entry
}

/* ---- inventory ---------------------------------------------------------- */
export const stockStatus = (item) => (item.stock <= 0 ? 'out' : item.stock <= item.minStock ? 'low' : 'in')
