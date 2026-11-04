import { db } from './storage'
import { request, notFound, ApiError } from './mockApi'
import { buildContext, nowIso, sendSimulatedSms, staffName } from './helpers'
import { can } from '../utils/permissions'
import { SMS_TEMPLATES } from '../data/constants'

/** Staff don't see finance-related notifications. */
const visibleTo = (user) => (n) => can(user, 'finance.view') || !['payment', 'outstanding', 'system'].includes(n.category)

export const notificationService = {
  getNotifications() {
    return request((user) => db.get('notifications').filter(visibleTo(user)), { permission: 'notifications.view', latency: [100, 220] })
  },

  markRead(id, read = true) {
    return request(() => {
      if (!db.get('notifications').some((n) => n.id === id)) throw notFound('Notification')
      db.update('notifications', (list) => list.map((n) => (n.id === id ? { ...n, read } : n)))
      return { id, read }
    }, { latency: [60, 140] })
  },

  markAllRead() {
    return request((user) => {
      const visible = visibleTo(user)
      db.update('notifications', (list) => list.map((n) => (visible(n) ? { ...n, read: true } : n)))
      return { ok: true }
    }, { latency: [100, 200] })
  },

  deleteNotification(id) {
    return request(() => {
      db.update('notifications', (list) => list.filter((n) => n.id !== id))
      return { id }
    }, { latency: [80, 160] })
  },

  clearRead() {
    return request((user) => {
      const visible = visibleTo(user)
      db.update('notifications', (list) => list.filter((n) => !(visible(n) && n.read)))
      return { ok: true }
    })
  },

  /* ---- Simulated SMS (DEMO — nothing is actually sent) ---- */
  getSmsLog() {
    return request(() => {
      const ctx = buildContext()
      return db.get('smsLog').map((s) => ({ ...s, sentByName: staffName(ctx, s.sentBy) }))
    }, { latency: [100, 200] })
  },

  /** Manually (re)send a templated SMS for an order. */
  sendOrderSms(orderId, templateKey) {
    return request((user) => {
      if (!SMS_TEMPLATES[templateKey]) throw new ApiError('Unknown SMS template.')
      const order = db.get('orders').find((o) => o.id === orderId)
      if (!order) throw notFound(`Order ${orderId}`)
      const ctx = buildContext()
      const customer = ctx.customers.get(order.customerId)
      const paid = ctx.paidByOrder.get(order.id) || 0
      const lastPayment = [...db.get('payments')].reverse().find((p) => p.orderId === orderId)
      const sms = sendSimulatedSms(templateKey, { customer, order, amount: lastPayment?.amount ?? 0, balance: Math.max(0, order.total - paid) }, user)
      if (!sms) throw new ApiError('SMS simulation is turned off in Settings → Notifications.')
      return { ...sms, sentAt: sms.sentAt ?? nowIso() }
    }, { latency: [500, 900] })
  },
}
