import { db } from './storage'
import { request, notFound, validationError } from './mockApi'
import { buildContext, enrichOrder, logActivity, nowIso, staffName } from './helpers'
import { formatId, uid } from '../utils/generateIds'
import { sum } from '../utils/calculations'
import { toLocalPhone, validateCustomer } from '../utils/validators'

function customerSummary(customer, ctx, orders) {
  const own = orders.filter((o) => o.customerId === customer.id)
  const live = own.filter((o) => o.status !== 'cancelled')
  const lastOrder = own.reduce((max, o) => (o.receivedAt > max ? o.receivedAt : max), '')
  return {
    ...customer,
    totalOrders: live.length,
    totalSpent: sum(db.get('payments').filter((p) => p.customerId === customer.id), (p) => p.amount),
    outstanding: sum(live, (o) => Math.max(0, o.total - (ctx.paidByOrder.get(o.id) || 0))),
    lastOrderAt: lastOrder || null,
    activeOrders: live.filter((o) => !['delivered'].includes(o.status)).length,
  }
}

function checkUniquePhone(phone, exceptId) {
  const p = toLocalPhone(phone)
  const dup = db.get('customers').find((c) => toLocalPhone(c.phone) === p && c.id !== exceptId)
  return dup ? { phone: `This number is already registered to ${dup.name} (${dup.id})` } : {}
}

export const customerService = {
  getCustomers() {
    return request(() => {
      const ctx = buildContext()
      const orders = db.get('orders')
      return db.get('customers').map((c) => customerSummary(c, ctx, orders)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }, { permission: 'customers.view' })
  },

  /** Lightweight search for pickers (create order, record payment). */
  searchCustomers(query) {
    return request(() => {
      const q = query.trim().toLowerCase().replace(/\s/g, '')
      if (!q) return []
      return db
        .get('customers')
        .filter((c) => c.name.toLowerCase().replace(/\s/g, '').includes(q) || c.phone.includes(q) || c.id.toLowerCase().includes(q))
        .slice(0, 8)
    }, { permission: 'customers.view', latency: [80, 180] })
  },

  getCustomerById(id) {
    return request(() => {
      const customer = db.get('customers').find((c) => c.id === id)
      if (!customer) throw notFound(`Customer ${id}`)
      const ctx = buildContext()
      const orders = db.get('orders')
      return {
        ...customerSummary(customer, ctx, orders),
        notes: customer.notes.map((n) => ({ ...n, byName: staffName(ctx, n.by) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        createdByName: staffName(ctx, customer.createdBy),
        orders: orders.filter((o) => o.customerId === id).map((o) => enrichOrder(o, ctx)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
        payments: db.get('payments').filter((p) => p.customerId === id).map((p) => ({ ...p, recordedByName: staffName(ctx, p.recordedBy) })).sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
        activities: db.get('activities').filter((a) => a.customerId === id).slice(0, 40).map((a) => ({ ...a, byName: staffName(ctx, a.by) })),
      }
    }, { permission: 'customers.view' })
  },

  createCustomer(data) {
    return request((user) => {
      const errors = { ...validateCustomer(data), ...(data.phone ? checkUniquePhone(data.phone) : {}) }
      if (Object.keys(errors).length) throw validationError(errors)
      const customer = {
        id: formatId('CUS', db.nextCounter('customer')),
        name: data.name.trim(),
        phone: toLocalPhone(data.phone),
        email: data.email?.trim() ?? '',
        address: data.address?.trim() ?? '',
        notes: data.note?.trim() ? [{ id: uid('n'), text: data.note.trim(), createdAt: nowIso(), by: user.id }] : [],
        createdAt: nowIso(),
        createdBy: user.id,
      }
      db.update('customers', (list) => [...list, customer])
      logActivity('customer_created', `registered customer ${customer.name}`, user, { customerId: customer.id })
      return customer
    }, { permission: 'customers.create' })
  },

  updateCustomer(id, data) {
    return request((user) => {
      const existing = db.get('customers').find((c) => c.id === id)
      if (!existing) throw notFound(`Customer ${id}`)
      const errors = { ...validateCustomer(data), ...(data.phone ? checkUniquePhone(data.phone, id) : {}) }
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...existing, name: data.name.trim(), phone: toLocalPhone(data.phone), email: data.email?.trim() ?? '', address: data.address?.trim() ?? '', updatedAt: nowIso() }
      db.update('customers', (list) => list.map((c) => (c.id === id ? updated : c)))
      logActivity('customer_updated', `updated customer ${updated.name}`, user, { customerId: id })
      return updated
    }, { permission: 'customers.edit' })
  },

  addCustomerNote(id, text) {
    return request((user) => {
      if (!text?.trim()) throw validationError({ text: 'Note cannot be empty' })
      const note = { id: uid('n'), text: text.trim(), createdAt: nowIso(), by: user.id }
      db.update('customers', (list) => list.map((c) => (c.id === id ? { ...c, notes: [...c.notes, note] } : c)))
      logActivity('customer_note', `added a note to customer ${id}`, user, { customerId: id })
      return { ...note, byName: user.name }
    }, { permission: 'customers.edit', latency: [120, 250] })
  },
}
