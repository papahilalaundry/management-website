import { db } from './storage'
import { request, notFound, validationError } from './mockApi'
import { buildContext, logActivity, nowIso, staffName } from './helpers'
import { formatId } from '../utils/generateIds'
import { formatCurrency, roundMoney } from '../utils/formatCurrency'
import { validateExpense } from '../utils/validators'

function normalize(data) {
  return {
    title: data.title.trim(),
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

export const expenseService = {
  getExpenses() {
    return request(() => {
      const ctx = buildContext()
      return db.get('expenses').map((e) => ({ ...e, recordedByName: staffName(ctx, e.recordedBy) })).sort((a, b) => b.date.localeCompare(a.date))
    }, { permission: 'expenses.view' })
  },

  createExpense(data) {
    return request((user) => {
      const errors = validateExpense(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const expense = { id: formatId('EXP', db.nextCounter('expense')), ...normalize(data), recordedBy: user.id, createdAt: nowIso() }
      db.update('expenses', (list) => [...list, expense])
      logActivity('expense', `recorded expense “${expense.title}” (${formatCurrency(expense.amount)})`, user, { expenseId: expense.id })
      return { ...expense, recordedByName: user.name }
    }, { permission: 'expenses.manage' })
  },

  updateExpense(id, data) {
    return request((user) => {
      const existing = db.get('expenses').find((e) => e.id === id)
      if (!existing) throw notFound('Expense')
      const errors = validateExpense(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...existing, ...normalize(data), updatedAt: nowIso() }
      db.update('expenses', (list) => list.map((e) => (e.id === id ? updated : e)))
      logActivity('expense', `updated expense ${id}`, user, { expenseId: id })
      return updated
    }, { permission: 'expenses.manage' })
  },

  deleteExpense(id) {
    return request((user) => {
      const existing = db.get('expenses').find((e) => e.id === id)
      if (!existing) throw notFound('Expense')
      db.update('expenses', (list) => list.filter((e) => e.id !== id))
      logActivity('expense', `deleted expense “${existing.title}” (${formatCurrency(existing.amount)})`, user)
      return { id }
    }, { permission: 'expenses.manage' })
  },
}
