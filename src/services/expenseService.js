import { orderBy, query, where } from 'firebase/firestore'
import { allocate, bumpStats, col, countOf, docRef, fetchAll, fetchPage, transact } from './storage'
import { request, notFound, validationError } from './mockApi'
import { logActivity, nowIso, staffName } from './helpers'
import { loadDailyStats, totalsBetween } from './stats'
import { formatId } from '../utils/generateIds'
import { formatCurrency, roundMoney } from '../utils/formatCurrency'
import { validateExpense } from '../utils/validators'

function normalize(data) {
  return {
    title: data.title.trim(),
    titleLower: data.title.trim().toLowerCase(),
    category: data.category,
    amount: roundMoney(data.amount),
    date: new Date(data.date).toISOString(),
    method: data.method,
    vendor: data.vendor?.trim() ?? '',
    reference: data.reference?.trim() ?? '',
    notes: data.notes?.trim() ?? '',
    attachmentName: data.attachmentName ?? '',
  }
}

const withNames = (e) => ({ ...e, recordedByName: staffName(e.recordedBy) })
const statFields = (e, sign = 1) => ({ expenses: sign * e.amount, expenseByCategory: { [e.category]: sign * e.amount } })

function listQuery({ from, to, category, method } = {}) {
  const parts = []
  if (category) parts.push(where('category', '==', category))
  if (method) parts.push(where('method', '==', method))
  if (from) parts.push(where('date', '>=', from))
  if (to) parts.push(where('date', '<=', to))
  return query(col('expenses'), ...parts, orderBy('date', 'desc'))
}

export const expenseService = {
  /**
   * One page of expenses, newest first.
   * @param {object} params { from, to, category, method, search, pageSize, cursor }
   * search matches the start of the title within the other filters.
   */
  listExpenses({ search = '', pageSize = 20, cursor = null, ...filters } = {}) {
    return request(async () => {
      const q = search.trim().toLowerCase()
      if (q) {
        const rows = (await fetchAll(listQuery(filters), 1000)).filter((e) => e.titleLower?.includes(q) || e.vendor?.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
        return { rows: rows.map(withNames), cursor: null, hasMore: false, total: rows.length }
      }
      const page = await fetchPage(listQuery(filters), { pageSize, cursor })
      return { ...page, rows: page.rows.map(withNames) }
    }, { permission: 'expenses.view' })
  },

  countExpenses(filters = {}) {
    return request(() => countOf(listQuery(filters)), { permission: 'expenses.view' })
  },

  exportExpenses(filters = {}) {
    return request(async () => (await fetchAll(listQuery(filters))).map(withNames), { permission: 'expenses.view' })
  },

  /** Totals for a date range from the daily summaries: { total, byCategory } */
  getExpenseStats({ from, to }) {
    return request(async () => {
      const t = totalsBetween(await loadDailyStats(from, to), from, to)
      return { total: t.expenses, byCategory: t.expenseByCategory }
    }, { permission: 'expenses.view' })
  },

  createExpense(data) {
    return request(async (user) => {
      const errors = validateExpense(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const expense = await transact(async (tx) => {
        const { ids, commit } = await allocate(tx, { expense: 1 })
        const e = { id: formatId('EXP', ids.expense), ...normalize(data), recordedBy: user.id, createdAt: nowIso() }
        commit()
        tx.set(docRef('expenses', e.id), e)
        bumpStats(tx, e.date, statFields(e))
        logActivity(tx, 'expense', `recorded expense “${e.title}” (${formatCurrency(e.amount)})`, user, { expenseId: e.id })
        return e
      })
      return { ...expense, recordedByName: user.name }
    }, { permission: 'expenses.manage' })
  },

  updateExpense(id, data) {
    return request(async (user) => {
      const errors = validateExpense(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = await transact(async (tx) => {
        const snap = await tx.get(docRef('expenses', id))
        if (!snap.exists()) throw notFound('Expense')
        const existing = snap.data()
        const next = { ...existing, ...normalize(data), updatedAt: nowIso() }
        tx.set(docRef('expenses', id), next)
        bumpStats(tx, existing.date, statFields(existing, -1))
        bumpStats(tx, next.date, statFields(next))
        logActivity(tx, 'expense', `updated expense ${id}`, user, { expenseId: id })
        return next
      })
      return withNames(updated)
    }, { permission: 'expenses.manage' })
  },

  deleteExpense(id) {
    return request(async (user) => {
      await transact(async (tx) => {
        const snap = await tx.get(docRef('expenses', id))
        if (!snap.exists()) throw notFound('Expense')
        const existing = snap.data()
        tx.delete(docRef('expenses', id))
        bumpStats(tx, existing.date, statFields(existing, -1))
        logActivity(tx, 'expense', `deleted expense “${existing.title}” (${formatCurrency(existing.amount)})`, user)
      })
      return { id }
    }, { permission: 'expenses.manage' })
  },
}
