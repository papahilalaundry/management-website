/**
 * Customers. Visit statistics (order count, first/last visit, average days
 * between drop-offs, new/regular, amounts billed/paid/outstanding) are stored
 * on each customer and kept up to date by the order and payment services.
 */
import { orderBy, query, where } from 'firebase/firestore'
import { allocate, col, countOf, docRef, fetchAll, fetchOne, fetchPage, sumOf, transact } from './storage'
import { request, notFound, validationError } from './mockApi'
import { enrichCustomer, enrichOrder, logActivity, nowIso, searchTokens, staffName, withWriter } from './helpers'
import { formatId, uid } from '../utils/generateIds'
import { toLocalPhone, validateCustomer } from '../utils/validators'

const CUSTOMER_ID = /^cus-?\d+$/i

async function phoneTaken(phone, exceptId) {
  const rows = await fetchAll(query(col('customers'), where('phone', '==', toLocalPhone(phone))), 2)
  const dup = rows.find((c) => c.id !== exceptId)
  return dup ? { phone: `This number is already registered to ${dup.name} (${dup.id})` } : {}
}

/** Builds the query for the customer list. filters: { type: 'new'|'regular', withBalance } */
function listQuery({ type, withBalance } = {}) {
  const parts = []
  if (type) parts.push(where('clientType', '==', type))
  if (withBalance) parts.push(where('outstanding', '>', 0), orderBy('outstanding', 'desc'))
  else parts.push(orderBy('createdAt', 'desc'))
  return query(col('customers'), ...parts)
}

/** Finds customers by ID, phone (prefix), or name (prefix of any word). Max ~`max` results. */
async function search(text, max = 20) {
  const q = text.trim().toLowerCase()
  if (!q) return []
  if (CUSTOMER_ID.test(q)) {
    const id = `CUS-${q.replace(/\D/g, '').padStart(4, '0')}`
    const c = await fetchOne('customers', id)
    return c ? [c] : []
  }
  const digits = q.replace(/[\s+()-]/g, '')
  if (/^\d{3,}$/.test(digits)) {
    const p = toLocalPhone(digits)
    return fetchAll(query(col('customers'), where('phone', '>=', p), where('phone', '<=', `${p}`), orderBy('phone')), max)
  }
  const first = q.split(/\s+/)[0]
  const [byName, byWord] = await Promise.all([
    fetchAll(query(col('customers'), where('nameLower', '>=', q), where('nameLower', '<=', `${q}`), orderBy('nameLower')), max),
    fetchAll(query(col('customers'), where('searchTokens', 'array-contains', first)), max),
  ])
  const seen = new Map()
  for (const c of [...byName, ...byWord]) if (c.nameLower.includes(q)) seen.set(c.id, c)
  return [...seen.values()].slice(0, max)
}

export const customerService = {
  /**
   * One page of customers, newest first (or by largest balance with withBalance).
   * @param {object} params { type, withBalance, search, pageSize, cursor }
   * @returns {{ rows, cursor, hasMore }}
   */
  listCustomers({ search: text = '', pageSize = 20, cursor = null, ...filters } = {}) {
    return request(async () => {
      if (text.trim()) {
        let rows = await search(text, 50)
        if (filters.type) rows = rows.filter((c) => (c.clientType ?? 'new') === filters.type)
        if (filters.withBalance) rows = rows.filter((c) => c.outstanding > 0)
        return { rows: rows.map(enrichCustomer), cursor: null, hasMore: false, total: rows.length }
      }
      const page = await fetchPage(listQuery(filters), { pageSize, cursor })
      return { ...page, rows: page.rows.map(enrichCustomer) }
    }, { permission: 'customers.view' })
  },

  /** Number of customers matching the list filters (for "Showing x of N"). */
  countCustomers(filters = {}) {
    return request(() => countOf(listQuery(filters)), { permission: 'customers.view' })
  },

  /** Headline numbers for the customers page. */
  getCustomerStats() {
    return request(async () => {
      const [total, regular, withBalance, outstanding] = await Promise.all([
        countOf(col('customers')),
        countOf(query(col('customers'), where('clientType', '==', 'regular'))),
        countOf(query(col('customers'), where('outstanding', '>', 0))),
        sumOf(query(col('customers'), where('outstanding', '>', 0)), 'outstanding'),
      ])
      return { total, regular, new: total - regular, withBalance, outstanding }
    }, { permission: 'customers.view' })
  },

  /** Lightweight search for pickers (create order, record payment). */
  searchCustomers(text) {
    return request(async () => (await search(text, 8)).map(enrichCustomer), { permission: 'customers.view' })
  },

  /** Every customer matching the filters (for exports). */
  exportCustomers(filters = {}) {
    return request(async () => (await fetchAll(listQuery(filters))).map(enrichCustomer), { permission: 'customers.view' })
  },

  /** Profile with recent orders, payments, feedback and activity. */
  getCustomerById(id) {
    return request(async () => {
      const customer = await fetchOne('customers', id)
      if (!customer) throw notFound(`Customer ${id}`)
      const [orders, payments, activities] = await Promise.all([
        fetchAll(query(col('orders'), where('customerId', '==', id), orderBy('receivedAt', 'desc')), 30),
        fetchAll(query(col('payments'), where('customerId', '==', id), orderBy('paidAt', 'desc')), 30),
        fetchAll(query(col('activities'), where('customerId', '==', id), orderBy('at', 'desc')), 30),
      ])
      const now = new Date()
      return {
        ...enrichCustomer(customer),
        notes: (customer.notes ?? []).map((n) => ({ ...n, byName: staffName(n.by) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        createdByName: staffName(customer.createdBy),
        orders: orders.map((o) => enrichOrder(o, now)),
        hasMoreOrders: orders.length === 30,
        payments: payments.map((p) => ({ ...p, recordedByName: staffName(p.recordedBy) })),
        feedback: orders.filter((o) => o.feedback).map((o) => ({ ...o.feedback, orderId: o.id, byName: staffName(o.feedback.by) })),
        visits: orders.filter((o) => !o.cancelled).map((o) => o.receivedAt).sort(),
        activities: activities.map((a) => ({ ...a, byName: staffName(a.by) })),
      }
    }, { permission: 'customers.view' })
  },

  createCustomer(data) {
    return request(async (user) => {
      const errors = { ...validateCustomer(data), ...(data.phone ? await phoneTaken(data.phone) : {}) }
      if (Object.keys(errors).length) throw validationError(errors)
      const customer = await transact(async (tx) => {
        const { ids, commit } = await allocate(tx, { customer: 1 })
        const name = data.name.trim()
        const phone = toLocalPhone(data.phone)
        const c = {
          id: formatId('CUS', ids.customer),
          name,
          nameLower: name.toLowerCase(),
          searchTokens: searchTokens(name),
          phone,
          email: data.email?.trim() ?? '',
          address: data.address?.trim() ?? '',
          notes: data.note?.trim() ? [{ id: uid('n'), text: data.note.trim(), createdAt: nowIso(), by: user.id }] : [],
          createdAt: nowIso(),
          createdBy: user.id,
          orderCount: 0,
          firstOrderAt: null,
          lastOrderAt: null,
          avgIntervalDays: null,
          clientType: 'new',
          totalBilled: 0,
          totalPaid: 0,
          outstanding: 0,
        }
        commit()
        tx.set(docRef('customers', c.id), c)
        logActivity(tx, 'customer_created', `registered customer ${c.name}`, user, { customerId: c.id })
        return c
      })
      return enrichCustomer(customer)
    }, { permission: 'customers.create' })
  },

  updateCustomer(id, data) {
    return request(async (user) => {
      const existing = await fetchOne('customers', id)
      if (!existing) throw notFound(`Customer ${id}`)
      const errors = { ...validateCustomer(data), ...(data.phone ? await phoneTaken(data.phone, id) : {}) }
      if (Object.keys(errors).length) throw validationError(errors)
      const name = data.name.trim()
      const patch = {
        name, nameLower: name.toLowerCase(), searchTokens: searchTokens(name),
        phone: toLocalPhone(data.phone), email: data.email?.trim() ?? '', address: data.address?.trim() ?? '', updatedAt: nowIso(),
      }
      await withWriter(null, (b) => {
        b.update(docRef('customers', id), patch)
        logActivity(b, 'customer_updated', `updated customer ${name}`, user, { customerId: id })
      })
      // Orders and payments keep a copy of the name/phone for fast lists; refresh the open ones.
      if (name !== existing.name || patch.phone !== existing.phone) {
        const open = await fetchAll(query(col('orders'), where('customerId', '==', id), where('isOpen', '==', true)), 400)
        if (open.length) {
          await withWriter(null, (b) => open.forEach((o) => b.update(docRef('orders', o.id), { customerName: name, customerNameLower: name.toLowerCase(), customerPhone: patch.phone })))
        }
      }
      return enrichCustomer({ ...existing, ...patch })
    }, { permission: 'customers.edit' })
  },

  addCustomerNote(id, text) {
    return request(async (user) => {
      if (!text?.trim()) throw validationError({ text: 'Note cannot be empty' })
      const note = { id: uid('n'), text: text.trim(), createdAt: nowIso(), by: user.id }
      await transact(async (tx) => {
        const snap = await tx.get(docRef('customers', id))
        if (!snap.exists()) throw notFound(`Customer ${id}`)
        tx.update(docRef('customers', id), { notes: [...(snap.data().notes ?? []), note] })
        logActivity(tx, 'customer_note', `added a note to customer ${id}`, user, { customerId: id })
      })
      return { ...note, byName: user.name }
    }, { permission: 'customers.edit' })
  },
}
