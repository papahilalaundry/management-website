/**
 * Internal helpers shared by the services (not used by UI components).
 */
import { db, docRef, newBatch } from './storage'
import { avgIntervalDays, clientTypeFor, isOrderOverdue } from '../utils/calculations'
import { roundMoney, formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { SMS_TEMPLATES } from '../data/constants'

export const nowIso = () => new Date().toISOString()

/** Unique, roughly time-ordered id for log-style records (activities, notifications, SMS). */
export const logId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`

/** Lowercase words of a name, plus the full lowercase name, for prefix/word search. */
export function searchTokens(...parts) {
  const words = parts.filter(Boolean).join(' ').toLowerCase().split(/[\s,.-]+/).filter(Boolean)
  return [...new Set(words)]
}

/* ---- lookups ------------------------------------------------------------ */
export const staffName = (id) => db.get('staff').find((s) => s.id === id)?.name ?? (id ? 'Former staff' : 'System')

/** Adds display fields to a stored order (everything else is stored on the order). */
export function enrichOrder(raw, now = new Date()) {
  // Orders saved before multi-service lines had one kg service.
  const order = raw.lines ? raw : {
    ...raw,
    lines: raw.serviceId ? [{ id: 'l_legacy', serviceId: raw.serviceId, serviceName: raw.serviceName, unit: 'kg', unitLabel: '', quantity: raw.weightKg ?? 0, unitPrice: raw.ratePerKg ?? 0, minCharge: 0, total: raw.subtotal ?? 0, notes: '' }] : [],
    serviceIds: raw.serviceId ? [raw.serviceId] : [],
    serviceNames: raw.serviceName ? [raw.serviceName] : [],
    serviceSummary: raw.serviceName ? `${raw.serviceName} (${raw.weightKg} kg)` : '',
  }
  return {
    ...order,
    customer: { id: order.customerId, name: order.customerName, phone: order.customerPhone },
    isOverdue: isOrderOverdue(order, now),
    assignedName: order.assignedTo ? staffName(order.assignedTo) : 'Unassigned',
    createdByName: staffName(order.createdBy),
  }
}

/** Adds derived visit fields to a stored customer. */
export function enrichCustomer(c) {
  return {
    ...c,
    totalOrders: c.orderCount ?? 0,
    totalSpent: c.totalPaid ?? 0,
    lastOrderAt: c.lastOrderAt ?? null,
    clientType: clientTypeFor(c.orderCount),
    avgIntervalDays: avgIntervalDays(c.firstOrderAt, c.lastOrderAt, c.orderCount),
  }
}

/**
 * Returns the customer fields to write after a change.
 * delta: { orders: ±1, orderAt (iso, for new orders), billed, paid, outstanding }
 */
export function customerAfter(c, delta) {
  const orderCount = Math.max(0, (c.orderCount || 0) + (delta.orders || 0))
  let { firstOrderAt = null, lastOrderAt = null } = c
  if (delta.orderAt) {
    if (!firstOrderAt || delta.orderAt < firstOrderAt) firstOrderAt = delta.orderAt
    if (!lastOrderAt || delta.orderAt > lastOrderAt) lastOrderAt = delta.orderAt
  }
  return {
    orderCount,
    firstOrderAt,
    lastOrderAt,
    totalBilled: roundMoney((c.totalBilled || 0) + (delta.billed || 0)),
    totalPaid: roundMoney((c.totalPaid || 0) + (delta.paid || 0)),
    outstanding: roundMoney(Math.max(0, (c.outstanding || 0) + (delta.outstanding || 0))),
    clientType: clientTypeFor(orderCount),
    avgIntervalDays: avgIntervalDays(firstOrderAt, lastOrderAt, orderCount),
    updatedAt: nowIso(),
  }
}

/* ---- writes that ride along with a transaction or batch ------------------ */
/** Runs fn(batch) and commits, or uses the given writer if one is passed. */
export async function withWriter(writer, fn) {
  if (writer) return fn(writer)
  const batch = newBatch()
  const out = fn(batch)
  await batch.commit()
  return out
}

export function logActivity(writer, type, message, user, extra = {}) {
  const entry = { id: logId('ACT'), type, message, at: nowIso(), by: user?.id ?? null, ...extra }
  writer.set(docRef('activities', entry.id), entry)
  return entry
}

const CATEGORY_PREF = {
  new_order: 'orders', order_ready: 'orders', overdue: 'overdue', payment: 'payments',
  outstanding: 'payments', low_stock: 'lowStock',
}

export function pushNotification(writer, category, title, message, link) {
  const prefs = db.get('settings').notifications
  const prefKey = CATEGORY_PREF[category]
  if (prefKey && prefs[prefKey] === false) return null
  const entry = { id: logId('NTF'), category, title, message, link, createdAt: nowIso(), read: false }
  writer.set(docRef('notifications', entry.id), entry)
  return entry
}

/**
 * DEMO ONLY — no SMS is actually sent. The message is rendered from a template
 * and stored in the SMS log so it can be previewed in the UI.
 * customer: { id, name, phone }
 */
export function sendSimulatedSms(writer, templateKey, { customer, order, amount, balance }, user) {
  const prefs = db.get('settings').notifications
  if (!prefs.sms || !customer) return null
  const tpl = SMS_TEMPLATES[templateKey]
  const message = tpl.text
    .replace('{name}', customer.name.split(' ')[0])
    .replace('{orderId}', order.id)
    .replace('{date}', formatDate(order.dueAt))
    .replace('{amount}', formatCurrency(amount ?? 0, { decimals: 0 }))
    .replace('{balance}', formatCurrency(balance ?? 0, { decimals: 0 }))
  const entry = {
    id: logId('SMS'),
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
  writer.set(docRef('smsLog', entry.id), entry)
  return entry
}

/* ---- inventory ---------------------------------------------------------- */
export const stockStatus = (item) => (item.stock <= 0 ? 'out' : item.stock <= item.minStock ? 'low' : 'in')
