/**
 * Daily summary documents (collection "stats", one per business day) let the
 * dashboard, payments, expenses and reports show totals and charts without
 * reading every order or payment. They are updated by the services in the
 * same transaction as the change they summarise.
 */
import { orderBy, query, where } from 'firebase/firestore'
import { col, dayKey, fetchAll } from './storage'
import { roundMoney } from '../utils/formatCurrency'

export { dayKey }

/** Daily stats docs between two instants (inclusive), as a Map dayKey -> doc. */
export async function loadDailyStats(fromIso, toIso) {
  const rows = await fetchAll(query(col('stats'), where('date', '>=', dayKey(fromIso)), where('date', '<=', dayKey(toIso)), orderBy('date')), 800)
  return new Map(rows.map((r) => [r.date, r]))
}

const EMPTY = () => ({ orders: 0, cancelled: 0, billed: 0, kg: 0, garments: 0, revenue: 0, payments: 0, revenueByMethod: {}, expenses: 0, expenseByCategory: {} })

const addMap = (into, from = {}) => {
  for (const [k, v] of Object.entries(from)) into[k] = roundMoney((into[k] || 0) + (Number(v) || 0))
}

/** Sums the stats docs whose day falls in [fromIso, toIso]. */
export function totalsBetween(days, fromIso, toIso) {
  const a = dayKey(fromIso)
  const b = dayKey(toIso)
  const t = EMPTY()
  for (const [key, d] of days) {
    if (key < a || key > b) continue
    for (const k of ['orders', 'cancelled', 'garments', 'payments']) t[k] += Number(d[k]) || 0
    for (const k of ['billed', 'revenue', 'expenses']) t[k] = roundMoney(t[k] + (Number(d[k]) || 0))
    t.kg = Math.round((t.kg + (Number(d.kg) || 0)) * 10) / 10
    addMap(t.revenueByMethod, d.revenueByMethod)
    addMap(t.expenseByCategory, d.expenseByCategory)
  }
  t.netProfit = roundMoney(t.revenue - t.expenses)
  return t
}
