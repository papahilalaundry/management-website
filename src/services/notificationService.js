import { orderBy, query, where } from 'firebase/firestore'
import { col, countOf, docRef, fetchAll, fetchOne, fetchPage } from './storage'
import { request, notFound, ApiError } from './mockApi'
import { nowIso, sendSimulatedSms, staffName, withWriter } from './helpers'
import { can } from '../utils/permissions'
import { NOTIFICATION_CATEGORIES, SMS_TEMPLATES } from '../data/constants'

/** Staff don't see finance-related notifications. */
const FINANCE_CATEGORIES = ['payment', 'outstanding', 'system']
const visibleCategories = (user) => (can(user, 'finance.view') ? null : NOTIFICATION_CATEGORIES.map((c) => c.value).filter((c) => !FINANCE_CATEGORIES.includes(c)))

function visibleQuery(user, extra = []) {
  const cats = visibleCategories(user)
  return query(col('notifications'), ...(cats ? [where('category', 'in', cats)] : []), ...extra, orderBy('createdAt', 'desc'))
}

export const notificationService = {
  /**
   * One page of notifications, newest first.
   * @param {object} params { unreadOnly, pageSize, cursor }
   */
  listNotifications({ unreadOnly = false, pageSize = 20, cursor = null } = {}) {
    return request((user) => fetchPage(visibleQuery(user, unreadOnly ? [where('read', '==', false)] : []), { pageSize, cursor }), { permission: 'notifications.view' })
  },

  /** Latest few, for the bell menu. */
  getRecent(max = 8) {
    return request(async (user) => (await fetchPage(visibleQuery(user), { pageSize: max })).rows, { permission: 'notifications.view' })
  },

  getUnreadCount() {
    return request((user) => countOf(visibleQuery(user, [where('read', '==', false)])), { permission: 'notifications.view' })
  },

  markRead(id, read = true) {
    return request(async () => {
      await withWriter(null, (b) => b.update(docRef('notifications', id), { read }))
      return { id, read }
    })
  },

  /** Marks up to 500 unread notifications as read. */
  markAllRead() {
    return request(async (user) => {
      const unread = await fetchAll(visibleQuery(user, [where('read', '==', false)]), 500)
      if (unread.length) await withWriter(null, (b) => unread.forEach((n) => b.update(docRef('notifications', n.id), { read: true })))
      return { ok: true, count: unread.length }
    })
  },

  deleteNotification(id) {
    return request(async () => {
      await withWriter(null, (b) => b.delete(docRef('notifications', id)))
      return { id }
    })
  },

  /** Deletes up to 500 read notifications. */
  clearRead() {
    return request(async (user) => {
      const read = await fetchAll(visibleQuery(user, [where('read', '==', true)]), 500)
      if (read.length) await withWriter(null, (b) => read.forEach((n) => b.delete(docRef('notifications', n.id))))
      return { ok: true, count: read.length }
    })
  },

  /* ---- Simulated SMS (DEMO — nothing is actually sent) ---- */
  /** One page of the SMS log, newest first. */
  getSmsLog({ pageSize = 20, cursor = null } = {}) {
    return request(async () => {
      const page = await fetchPage(query(col('smsLog'), orderBy('sentAt', 'desc')), { pageSize, cursor })
      return { ...page, rows: page.rows.map((s) => ({ ...s, sentByName: staffName(s.sentBy) })) }
    })
  },

  /** Manually (re)send a templated SMS for an order. */
  sendOrderSms(orderId, templateKey) {
    return request(async (user) => {
      if (!SMS_TEMPLATES[templateKey]) throw new ApiError('Unknown SMS template.')
      const order = await fetchOne('orders', orderId)
      if (!order) throw notFound(`Order ${orderId}`)
      const [lastPayment] = await fetchAll(query(col('payments'), where('orderId', '==', orderId), orderBy('paidAt', 'desc')), 1)
      const sms = await withWriter(null, (b) => sendSimulatedSms(b, templateKey, { customer: { id: order.customerId, name: order.customerName, phone: order.customerPhone }, order, amount: lastPayment?.amount ?? 0, balance: order.balance }, user))
      if (!sms) throw new ApiError('SMS simulation is turned off in Settings → Notifications.')
      return { ...sms, sentAt: sms.sentAt ?? nowIso() }
    })
  },
}
