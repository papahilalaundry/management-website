/**
 * Analytics & reporting.
 *
 * ACCOUNTING ASSUMPTIONS (cash basis):
 *  - Revenue = payments actually received in the period (Paybill + M-Pesa number + Cash).
 *    Unpaid balances are NOT revenue; they appear as receivables.
 *  - Expenses = expense records dated in the period.
 *  - Net profit = Revenue − Expenses.
 *  - Gross billings = total value of (non-cancelled) orders received in the period.
 *
 * Totals and charts come from the daily summary documents (see stats.js), so
 * they don't read individual orders. Only the full Reports page reads the
 * orders and payments inside the chosen range, for its breakdowns.
 */
import {
  addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval,
  eachWeekOfInterval, endOfDay, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths,
} from 'date-fns'
import { orderBy, query, where } from 'firebase/firestore'
import { col, countOf, db, fetchAll, sumOf } from './storage'
import { request } from './mockApi'
import { enrichOrder, nowIso, stockStatus } from './helpers'
import { loadDailyStats, totalsBetween } from './stats'
import { percentChange, sum } from '../utils/calculations'
import { can } from '../utils/permissions'
import { IN_PROGRESS_STATUSES, ORDER_STAGES, OPEN_STATUSES, PAYMENT_METHODS, methodLabel } from '../data/constants'
import { roundMoney } from '../utils/formatCurrency'

const range = ({ from, to }) => ({ from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) })
const isoOf = (d) => d.toISOString()

/** Time buckets for charts. granularity: day | week | month */
function buckets(from, to, granularity) {
  if (granularity === 'day') return eachDayOfInterval({ start: from, end: to }).map((d) => ({ start: d, end: endOfDay(d), label: format(d, 'dd MMM'), short: format(d, 'EEE') }))
  if (granularity === 'week')
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((d) => ({ start: d < from ? from : d, end: endOfDay(addDays(addWeeks(d, 1), -1)), label: `Wk ${format(d, 'dd MMM')}`, short: format(d, 'dd MMM') }))
  return eachMonthOfInterval({ start: from, end: to }).map((d) => ({ start: d < from ? from : d, end: endOfDay(addDays(addMonths(d, 1), -1)), label: format(d, 'MMM yyyy'), short: format(d, 'MMM') }))
}

/** Chart rows from daily stats: { label, short, orders, kg, garments, revenue?, expenses?, profit?, billed? } */
function seriesFor(days, from, to, granularity, { finance }) {
  return buckets(from, to, granularity).map((b) => {
    const t = totalsBetween(days, isoOf(b.start), isoOf(b.end > to ? to : b.end))
    const row = { label: b.label, short: b.short, orders: t.orders, kg: t.kg, garments: t.garments }
    if (finance) Object.assign(row, { revenue: t.revenue, expenses: t.expenses, profit: t.netProfit, billed: t.billed })
    return row
  })
}

export const autoGranularity = (from, to) => {
  const days = differenceInCalendarDays(to, from) + 1
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
}

/** Splits [from,to] into n buckets of totals for sparklines. */
function sparkSeries(days, from, to, n = 10) {
  const span = (to - from) / n
  return Array.from({ length: n }, (_, i) => totalsBetween(days, isoOf(new Date(from.getTime() + span * i)), isoOf(new Date(from.getTime() + span * (i + 1) - 1))))
}

const methodBreakdown = (byMethod = {}) => {
  const total = Object.values(byMethod).reduce((s, v) => s + v, 0)
  return PAYMENT_METHODS.map((m) => ({ method: m.value, label: m.label, amount: roundMoney(byMethod[m.value] || 0), pct: total ? ((byMethod[m.value] || 0) / total) * 100 : 0 }))
}

/** Current number of orders in each status (server-side counts). */
async function statusCounts() {
  const statuses = [...ORDER_STAGES.map((s) => s.value), 'cancelled']
  const counts = await Promise.all(statuses.map((s) => countOf(query(col('orders'), where('status', '==', s)))))
  return Object.fromEntries(statuses.map((s, i) => [s, counts[i]]))
}

export const reportService = {
  /** Everything the dashboard needs, without reading every order. */
  getDashboard({ from, to }) {
    return request(async (user) => {
      const finance = can(user, 'finance.view')
      const r = range({ from, to })
      const length = r.to - r.from
      const prev = { from: new Date(r.from.getTime() - length - 1), to: new Date(r.from.getTime() - 1) }
      const now = new Date()
      const todayStart = isoOf(startOfDay(now))
      const todayEnd = isoOf(endOfDay(now))
      const open = (field) => query(col('orders'), where('isOpen', '==', true), where(field, '>=', todayStart), where(field, '<=', todayEnd), orderBy(field))
      const owing = query(col('orders'), where('balance', '>', 0))

      const [days, counts, dueToday, deliveriesToday, pickupsToday, overdueRows, overdueCount, recent, outstanding, owingCustomers] = await Promise.all([
        loadDailyStats(isoOf(prev.from), isoOf(r.to)),
        statusCounts(),
        fetchAll(open('dueAt'), 20),
        fetchAll(open('deliveryAt'), 20),
        fetchAll(open('pickupAt'), 20),
        fetchAll(query(col('orders'), where('isOpen', '==', true), where('dueAt', '<', nowIso()), orderBy('dueAt')), 10),
        countOf(query(col('orders'), where('isOpen', '==', true), where('dueAt', '<', nowIso()))),
        fetchAll(query(col('orders'), orderBy('receivedAt', 'desc')), 8),
        finance ? sumOf(owing, 'balance') : 0,
        finance ? fetchAll(query(col('customers'), where('outstanding', '>', 0), orderBy('outstanding', 'desc')), 6) : [],
      ])

      const cur = totalsBetween(days, isoOf(r.from), isoOf(r.to))
      const before = totalsBetween(days, isoOf(prev.from), isoOf(prev.to))
      const spark = sparkSeries(days, r.from, r.to)
      const stat = (k, value = cur[k]) => ({ value, previous: before[k], change: percentChange(value, before[k]), trend: spark.map((s) => s[k]) })
      const live = (value) => ({ value, previous: null, change: null, trend: [] })

      const stats = {
        totalOrders: stat('orders'),
        kg: stat('kg'),
        pending: live(counts.received),
        inProgress: live(IN_PROGRESS_STATUSES.reduce((s, k) => s + counts[k], 0)),
        ready: live(counts.ready),
        ...(finance ? { revenue: stat('revenue'), expenses: stat('expenses'), netProfit: stat('netProfit'), outstanding: live(roundMoney(outstanding)) } : {}),
      }

      const schedule = []
      const seen = new Set()
      for (const o of deliveriesToday) { seen.add(o.id); schedule.push({ type: 'delivery', at: o.deliveryAt, order: enrichOrder(o, now) }) }
      for (const o of pickupsToday) if (!seen.has(o.id) && o.status === 'received') { seen.add(o.id); schedule.push({ type: 'pickup', at: o.pickupAt, order: enrichOrder(o, now) }) }
      for (const o of dueToday) if (!seen.has(o.id)) schedule.push({ type: 'collection', at: o.dueAt, order: enrichOrder(o, now) })
      schedule.sort((a, b) => a.at.localeCompare(b.at))

      return {
        range: { from: isoOf(r.from), to: isoOf(r.to), previousFrom: isoOf(prev.from), previousTo: isoOf(prev.to) },
        stats,
        statusDistribution: ORDER_STAGES.map((s) => ({ status: s.value, label: s.short, count: counts[s.value] })),
        paymentMethods: finance ? methodBreakdown(cur.revenueByMethod) : [],
        schedule: schedule.slice(0, 12),
        overdue: overdueRows.map((o) => enrichOrder(o, now)),
        overdueCount,
        recentOrders: recent.map((o) => enrichOrder(o, now)),
        lowStock: can(user, 'inventory.view') ? db.get('inventory').filter((i) => stockStatus(i) !== 'in').map((i) => ({ ...i, status: stockStatus(i) })) : [],
        outstandingCustomers: owingCustomers.map((c) => ({ customer: { id: c.id, name: c.name, phone: c.phone }, amount: c.outstanding, orders: c.orderCount, oldest: c.lastOrderAt })),
      }
    }, { permission: 'dashboard.view' })
  },

  /** period: 7d | 30d | 90d | 12m — chart rows from the daily summaries. */
  getRevenueAnalytics(period = '30d') {
    return request(async (user) => {
      const now = new Date()
      const finance = can(user, 'finance.view')
      const [start, granularity] = {
        '7d': [startOfDay(subDays(now, 6)), 'day'],
        '30d': [startOfDay(subDays(now, 29)), 'day'],
        '90d': [startOfWeek(subDays(now, 89), { weekStartsOn: 1 }), 'week'],
        '12m': [startOfMonth(subMonths(now, 11)), 'month'],
      }[period] ?? [startOfDay(subDays(now, 29)), 'day']
      const end = endOfDay(now)
      const days = await loadDailyStats(isoOf(start), isoOf(end))
      return seriesFor(days, start, end, granularity, { finance })
    }, { permission: 'dashboard.view' })
  },

  getProfitAndLoss({ from, to }) {
    return request(async () => {
      const r = range({ from, to })
      const t = totalsBetween(await loadDailyStats(isoOf(r.from), isoOf(r.to)), isoOf(r.from), isoOf(r.to))
      const income = PAYMENT_METHODS.map((m) => ({ label: `Laundry services — ${m.label}`, amount: roundMoney(t.revenueByMethod[m.value] || 0) }))
      const expenseLines = Object.entries(t.expenseByCategory).filter(([, v]) => v).map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
      return { from: isoOf(r.from), to: isoOf(r.to), income, totalIncome: t.revenue, expenses: expenseLines, totalExpenses: t.expenses, netProfit: t.netProfit, margin: t.revenue ? (t.netProfit / t.revenue) * 100 : 0 }
    }, { permission: 'reports.view' })
  },

  /** Full report for the Reports page and exports (reads orders and payments in the range). */
  getReport({ from, to }) {
    return request(async () => {
      const r = range({ from, to })
      const fromIso = isoOf(r.from)
      const toIso = isoOf(r.to)
      const granularity = autoGranularity(r.from, r.to)
      const [days, orders, payments, receivables, newCustomers, regularCustomers, totalCustomers] = await Promise.all([
        loadDailyStats(isoOf(startOfMonth(r.from)), toIso),
        fetchAll(query(col('orders'), where('receivedAt', '>=', fromIso), where('receivedAt', '<=', toIso), orderBy('receivedAt')), 5000),
        fetchAll(query(col('payments'), where('paidAt', '>=', fromIso), where('paidAt', '<=', toIso), orderBy('paidAt')), 5000),
        sumOf(query(col('orders'), where('balance', '>', 0)), 'balance'),
        countOf(query(col('customers'), where('createdAt', '>=', fromIso), where('createdAt', '<=', toIso))),
        countOf(query(col('customers'), where('clientType', '==', 'regular'))),
        countOf(col('customers')),
      ])
      const t = totalsBetween(days, fromIso, toIso)
      const live = orders.filter((o) => !o.cancelled)

      const turnaround = live.filter((o) => o.stages?.ready).map((o) => (new Date(o.stages.ready.at) - new Date(o.receivedAt)) / 36e5)
      const garmentMap = new Map()
      live.forEach((o) => o.items.forEach((it) => {
        const row = garmentMap.get(it.name) ?? { name: it.name, category: it.category, quantity: 0, orders: 0 }
        row.quantity += it.quantity
        row.orders += 1
        garmentMap.set(it.name, row)
      }))
      // Per service: orders using it, quantity in its unit, and value of its lines (before surcharges/discounts).
      const serviceMap = new Map()
      live.map((o) => enrichOrder(o)).forEach((o) => {
        for (const l of o.lines) {
          const row = serviceMap.get(l.serviceId) ?? { id: l.serviceId, name: l.serviceName, unit: l.unit, unitLabel: l.unitLabel, orders: 0, quantity: 0, kg: 0, garments: 0, revenue: 0 }
          row.orders += 1
          row.quantity = Math.round((row.quantity + l.quantity) * 10) / 10
          if (l.unit === 'kg') row.kg = row.quantity
          row.garments += o.garmentCount
          row.revenue = roundMoney(row.revenue + (l.total ?? 0))
          serviceMap.set(l.serviceId, row)
        }
      })
      const staffRows = db.get('staff').map((s) => {
        const assigned = live.filter((o) => o.assignedTo === s.id)
        const recorded = payments.filter((p) => p.recordedBy === s.id)
        return {
          id: s.id, name: s.name, role: s.role, status: s.status,
          assigned: assigned.length,
          completed: assigned.filter((o) => ['ready', 'delivered'].includes(o.status)).length,
          kg: Math.round(assigned.reduce((x, o) => x + (o.weightKg || 0), 0) * 10) / 10,
          garments: assigned.reduce((x, o) => x + o.garmentCount, 0),
          created: live.filter((o) => o.createdBy === s.id).length,
          paymentsRecorded: recorded.length,
          amountCollected: sum(recorded, (p) => p.amount),
        }
      }).filter((s) => s.assigned || s.created || s.paymentsRecorded)

      const expected = sum(payments, (p) => p.expectedAmount ?? p.amount)
      const billed = sum(live, (o) => o.total)
      const kg = Math.round(live.reduce((x, o) => x + (o.weightKg || 0), 0) * 10) / 10
      return {
        range: { from: fromIso, to: toIso, granularity },
        financial: {
          revenue: t.revenue,
          byMethod: methodBreakdown(t.revenueByMethod),
          paymentCount: t.payments,
          expectedPayments: expected,
          shortfall: roundMoney(expected - t.revenue),
          expenses: t.expenses,
          netProfit: t.netProfit,
          margin: t.revenue ? (t.netProfit / t.revenue) * 100 : 0,
          billed,
          discounts: sum(live, (o) => o.discount),
          receivables: roundMoney(receivables),
          expenseBreakdown: Object.entries(t.expenseByCategory).filter(([, v]) => v).map(([category, amount]) => ({ category, amount, pct: t.expenses ? (amount / t.expenses) * 100 : 0 })).sort((a, b) => b.amount - a.amount),
          series: seriesFor(days, r.from, r.to, granularity, { finance: true }),
          monthly: seriesFor(days, startOfMonth(r.from), r.to, 'month', { finance: true }),
        },
        operational: {
          totalOrders: live.length,
          cancelled: orders.length - live.length,
          completed: live.filter((o) => ['ready', 'delivered'].includes(o.status)).length,
          delivered: live.filter((o) => o.status === 'delivered').length,
          overdue: live.filter((o) => OPEN_STATUSES.includes(o.status) && o.dueAt < nowIso()).length,
          kg,
          garments: live.reduce((x, o) => x + o.garmentCount, 0),
          avgKgPerOrder: live.length ? Math.round((kg / live.length) * 10) / 10 : 0,
          avgOrderValue: live.length ? roundMoney(billed / live.length) : 0,
          avgTurnaroundHours: turnaround.length ? turnaround.reduce((a, b) => a + b, 0) / turnaround.length : 0,
          byStatus: [...ORDER_STAGES.map((s) => ({ status: s.value, label: s.short, count: orders.filter((o) => o.status === s.value).length })), { status: 'cancelled', label: 'Cancelled', count: orders.length - live.length }],
          byService: [...serviceMap.values()].sort((a, b) => b.revenue - a.revenue),
          topGarments: [...garmentMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
          byPriority: ['normal', 'express', 'urgent'].map((p) => ({ priority: p, count: live.filter((o) => o.priority === p).length })),
          staff: staffRows.sort((a, b) => b.completed - a.completed),
          feedback: live.filter((o) => o.feedback).map((o) => ({ orderId: o.id, customerName: o.customerName, ...o.feedback })),
        },
        clients: {
          total: totalCustomers,
          regular: regularCustomers,
          new: totalCustomers - regularCustomers,
          newInPeriod: newCustomers,
          returningInPeriod: new Set(live.filter((o) => o.receivedAt).map((o) => o.customerId)).size,
        },
      }
    }, { permission: 'reports.view' })
  },
}

export { methodLabel }
