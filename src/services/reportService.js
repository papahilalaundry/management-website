/**
 * Analytics & reporting.
 *
 * ACCOUNTING ASSUMPTIONS (cash basis):
 *  - Revenue = payments actually recorded in the period (M-Pesa + Cash).
 *    Unpaid balances are NOT revenue; they appear as receivables.
 *  - Expenses = expense records dated in the period.
 *  - Net profit = Revenue − Expenses.
 *  - Gross billings = total value of (non-cancelled) orders received in the period.
 *  - Orders are attributed to the period by their "date received".
 */
import {
  addDays, addMonths, addWeeks, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval,
  eachWeekOfInterval, endOfDay, format, startOfDay, startOfMonth, startOfWeek, subDays, subMonths,
} from 'date-fns'
import { db } from './storage'
import { request } from './mockApi'
import { buildContext, enrichOrder, stockStatus } from './helpers'
import { percentChange, sum, lineTotal } from '../utils/calculations'
import { can } from '../utils/permissions'
import { IN_PROGRESS_STATUSES, ORDER_STAGES, OPEN_STATUSES } from '../data/constants'
import { roundMoney } from '../utils/formatCurrency'

const t = (iso) => new Date(iso).getTime()
const within = (iso, from, to) => {
  const x = t(iso)
  return x >= from.getTime() && x <= to.getTime()
}
const range = ({ from, to }) => ({ from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) })

function periodTotals(from, to, data) {
  const orders = data.orders.filter((o) => within(o.receivedAt, from, to))
  const live = orders.filter((o) => o.status !== 'cancelled')
  const revenue = sum(data.payments.filter((p) => within(p.paidAt, from, to)), (p) => p.amount)
  const expenses = sum(data.expenses.filter((e) => within(e.date, from, to)), (e) => e.amount)
  return {
    totalOrders: live.length,
    pending: live.filter((o) => o.status === 'received').length,
    inProgress: live.filter((o) => IN_PROGRESS_STATUSES.includes(o.status)).length,
    completed: live.filter((o) => ['ready', 'delivered'].includes(o.status)).length,
    revenue,
    expenses,
    netProfit: roundMoney(revenue - expenses),
    outstanding: sum(live, (o) => Math.max(0, o.total - (data.ctx.paidByOrder.get(o.id) || 0))),
  }
}

/** Splits [from,to] into n buckets and evaluates periodTotals for sparklines. */
function sparkSeries(from, to, data, n = 10) {
  const span = (to - from) / n
  return Array.from({ length: n }, (_, i) => periodTotals(new Date(from.getTime() + span * i), new Date(from.getTime() + span * (i + 1) - 1), data))
}

function loadData() {
  return { orders: db.get('orders'), payments: db.get('payments'), expenses: db.get('expenses'), ctx: buildContext() }
}

/** Time buckets for charts. granularity: day | week | month */
function buckets(from, to, granularity) {
  if (granularity === 'day') return eachDayOfInterval({ start: from, end: to }).map((d) => ({ start: d, end: endOfDay(d), label: format(d, 'dd MMM'), short: format(d, 'EEE') }))
  if (granularity === 'week')
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((d) => ({ start: d < from ? from : d, end: endOfDay(addDays(addWeeks(d, 1), -1)), label: `Wk ${format(d, 'dd MMM')}`, short: format(d, 'dd MMM') }))
  return eachMonthOfInterval({ start: from, end: to }).map((d) => ({ start: d < from ? from : d, end: endOfDay(addDays(addMonths(d, 1), -1)), label: format(d, 'MMM yyyy'), short: format(d, 'MMM') }))
}

function seriesFor(from, to, granularity, data, { finance }) {
  return buckets(from, to, granularity).map((b) => {
    const end = b.end > to ? to : b.end
    const orders = data.orders.filter((o) => o.status !== 'cancelled' && within(o.receivedAt, b.start, end))
    const row = { label: b.label, short: b.short, orders: orders.length, garments: orders.reduce((s, o) => s + o.items.reduce((x, i) => x + (i.pricingModel === 'per_kg' ? 1 : i.quantity), 0), 0) }
    if (finance) {
      row.revenue = sum(data.payments.filter((p) => within(p.paidAt, b.start, end)), (p) => p.amount)
      row.expenses = sum(data.expenses.filter((e) => within(e.date, b.start, end)), (e) => e.amount)
      row.profit = roundMoney(row.revenue - row.expenses)
      row.billed = sum(orders, (o) => o.total)
    }
    return row
  })
}

export const autoGranularity = (from, to) => {
  const days = differenceInCalendarDays(to, from) + 1
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
}

function statusDistribution(orders) {
  return [...ORDER_STAGES.map((s) => ({ status: s.value, label: s.short, count: orders.filter((o) => o.status === s.value).length })), { status: 'cancelled', label: 'Cancelled', count: orders.filter((o) => o.status === 'cancelled').length }]
}

function serviceBreakdown(orders) {
  const map = new Map()
  for (const o of orders) {
    const seen = new Set()
    for (const it of o.items) {
      const row = map.get(it.serviceId) ?? { id: it.serviceId, name: it.serviceName, orders: 0, garments: 0, revenue: 0 }
      if (!seen.has(it.serviceId)) row.orders += 1
      seen.add(it.serviceId)
      row.garments += it.pricingModel === 'per_kg' ? 1 : it.quantity
      row.revenue = roundMoney(row.revenue + lineTotal(it))
      map.set(it.serviceId, row)
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export const reportService = {
  /** One round-trip for everything the dashboard needs. */
  getDashboard({ from, to }) {
    return request((user) => {
      const finance = can(user, 'finance.view')
      const r = range({ from, to })
      const length = r.to - r.from
      const prev = { from: new Date(r.from.getTime() - length - 1), to: new Date(r.from.getTime() - 1) }
      const data = loadData()
      const cur = periodTotals(r.from, r.to, data)
      const before = periodTotals(prev.from, prev.to, data)
      const spark = sparkSeries(r.from, r.to, data)
      const keys = ['totalOrders', 'pending', 'inProgress', 'completed', ...(finance ? ['revenue', 'outstanding', 'expenses', 'netProfit'] : [])]
      const stats = Object.fromEntries(keys.map((k) => [k, { value: cur[k], previous: before[k], change: percentChange(cur[k], before[k]), trend: spark.map((s) => s[k]) }]))

      const ctx = data.ctx
      const inRange = data.orders.filter((o) => within(o.receivedAt, r.from, r.to))
      const enrichedAll = data.orders.map((o) => enrichOrder(o, ctx))
      const now = new Date()
      const todayStart = startOfDay(now)
      const todayEnd = endOfDay(now)
      const schedule = []
      for (const o of enrichedAll) {
        if (['delivered', 'cancelled'].includes(o.status)) continue
        if (o.deliveryAt && within(o.deliveryAt, todayStart, todayEnd)) schedule.push({ type: 'delivery', at: o.deliveryAt, order: o })
        else if (o.pickupAt && within(o.pickupAt, todayStart, todayEnd) && o.status === 'received') schedule.push({ type: 'pickup', at: o.pickupAt, order: o })
        else if (within(o.dueAt, todayStart, todayEnd)) schedule.push({ type: 'collection', at: o.dueAt, order: o })
      }
      schedule.sort((a, b) => a.at.localeCompare(b.at))

      const outstandingByCustomer = new Map()
      for (const o of enrichedAll) {
        if (o.balance > 0 && o.status !== 'cancelled') {
          const row = outstandingByCustomer.get(o.customerId) ?? { customer: o.customer, amount: 0, orders: 0, oldest: o.receivedAt }
          row.amount = roundMoney(row.amount + o.balance)
          row.orders += 1
          if (o.receivedAt < row.oldest) row.oldest = o.receivedAt
          outstandingByCustomer.set(o.customerId, row)
        }
      }

      return {
        range: { from: r.from.toISOString(), to: r.to.toISOString(), previousFrom: prev.from.toISOString(), previousTo: prev.to.toISOString() },
        stats,
        statusDistribution: statusDistribution(inRange).filter((s) => s.status !== 'cancelled'),
        popularServices: serviceBreakdown(inRange.filter((o) => o.status !== 'cancelled')).slice(0, 5).map((s) => (finance ? s : { ...s, revenue: undefined })),
        schedule: schedule.slice(0, 12),
        overdue: enrichedAll.filter((o) => o.isOverdue).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
        recentOrders: [...enrichedAll].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 8),
        lowStock: can(user, 'inventory.view') ? db.get('inventory').filter((i) => stockStatus(i) !== 'in').map((i) => ({ ...i, status: stockStatus(i) })) : [],
        outstandingCustomers: finance ? [...outstandingByCustomer.values()].sort((a, b) => b.amount - a.amount).slice(0, 6) : [],
      }
    }, { permission: 'dashboard.view', latency: [350, 650] })
  },

  /** period: 7d | 30d | 90d | 12m */
  getRevenueAnalytics(period = '30d') {
    return request((user) => {
      const now = new Date()
      const finance = can(user, 'finance.view')
      const cfg = {
        '7d': [startOfDay(subDays(now, 6)), 'day'],
        '30d': [startOfDay(subDays(now, 29)), 'day'],
        '90d': [startOfWeek(subDays(now, 89), { weekStartsOn: 1 }), 'week'],
        '12m': [startOfMonth(subMonths(now, 11)), 'month'],
      }[period] ?? [startOfDay(subDays(now, 29)), 'day']
      return seriesFor(cfg[0], endOfDay(now), cfg[1], loadData(), { finance })
    }, { permission: 'dashboard.view', latency: [200, 400] })
  },

  getProfitAndLoss({ from, to }) {
    return request(() => {
      const r = range({ from, to })
      const data = loadData()
      const payments = data.payments.filter((p) => within(p.paidAt, r.from, r.to))
      const expenses = data.expenses.filter((e) => within(e.date, r.from, r.to))
      const income = [
        { label: 'Laundry services — M-Pesa', amount: sum(payments.filter((p) => p.method === 'mpesa'), (p) => p.amount) },
        { label: 'Laundry services — Cash', amount: sum(payments.filter((p) => p.method === 'cash'), (p) => p.amount) },
      ]
      const byCat = new Map()
      expenses.forEach((e) => byCat.set(e.category, roundMoney((byCat.get(e.category) || 0) + e.amount)))
      const expenseLines = [...byCat.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
      const totalIncome = sum(income, (i) => i.amount)
      const totalExpenses = sum(expenseLines, (e) => e.amount)
      return { from: r.from.toISOString(), to: r.to.toISOString(), income, totalIncome, expenses: expenseLines, totalExpenses, netProfit: roundMoney(totalIncome - totalExpenses), margin: totalIncome ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0 }
    }, { permission: 'reports.view' })
  },

  /** Full report for the Reports page and exports. */
  getReport({ from, to }) {
    return request(() => {
      const r = range({ from, to })
      const data = loadData()
      const ctx = data.ctx
      const granularity = autoGranularity(r.from, r.to)
      const orders = data.orders.filter((o) => within(o.receivedAt, r.from, r.to))
      const live = orders.filter((o) => o.status !== 'cancelled')
      const payments = data.payments.filter((p) => within(p.paidAt, r.from, r.to))
      const expenses = data.expenses.filter((e) => within(e.date, r.from, r.to))

      const revenue = sum(payments, (p) => p.amount)
      const totalExpenses = sum(expenses, (e) => e.amount)
      const billed = sum(live, (o) => o.total)
      const receivables = sum(live, (o) => Math.max(0, o.total - (ctx.paidByOrder.get(o.id) || 0)))
      const byCat = new Map()
      expenses.forEach((e) => byCat.set(e.category, roundMoney((byCat.get(e.category) || 0) + e.amount)))

      const turnaround = data.orders
        .filter((o) => o.stages.ready && within(o.stages.ready.at, r.from, r.to))
        .map((o) => (t(o.stages.ready.at) - t(o.receivedAt)) / 36e5)
      const garmentMap = new Map()
      live.forEach((o) => o.items.forEach((it) => {
        const row = garmentMap.get(it.name) ?? { name: it.name, category: it.category, quantity: 0, orders: 0, revenue: 0 }
        row.quantity += it.pricingModel === 'per_kg' ? 1 : it.quantity
        row.orders += 1
        row.revenue = roundMoney(row.revenue + lineTotal(it))
        garmentMap.set(it.name, row)
      }))
      const staffRows = db.get('staff').map((s) => {
        const assigned = live.filter((o) => o.assignedTo === s.id)
        const recorded = payments.filter((p) => p.recordedBy === s.id)
        return {
          id: s.id, name: s.name, role: s.role, status: s.status,
          assigned: assigned.length,
          completed: assigned.filter((o) => ['ready', 'delivered'].includes(o.status)).length,
          garments: assigned.reduce((x, o) => x + o.items.reduce((y, i) => y + (i.pricingModel === 'per_kg' ? 1 : i.quantity), 0), 0),
          created: live.filter((o) => o.createdBy === s.id).length,
          paymentsRecorded: recorded.length,
          amountCollected: sum(recorded, (p) => p.amount),
        }
      }).filter((s) => s.assigned || s.created || s.paymentsRecorded)

      return {
        range: { from: r.from.toISOString(), to: r.to.toISOString(), granularity },
        financial: {
          revenue,
          mpesa: sum(payments.filter((p) => p.method === 'mpesa'), (p) => p.amount),
          cash: sum(payments.filter((p) => p.method === 'cash'), (p) => p.amount),
          paymentCount: payments.length,
          expenses: totalExpenses,
          netProfit: roundMoney(revenue - totalExpenses),
          margin: revenue ? ((revenue - totalExpenses) / revenue) * 100 : 0,
          billed,
          discounts: sum(live, (o) => o.discount),
          receivables,
          expenseBreakdown: [...byCat.entries()].map(([category, amount]) => ({ category, amount, pct: totalExpenses ? (amount / totalExpenses) * 100 : 0 })).sort((a, b) => b.amount - a.amount),
          series: seriesFor(r.from, r.to, granularity, data, { finance: true }),
          monthly: seriesFor(startOfMonth(r.from), r.to, 'month', data, { finance: true }),
        },
        operational: {
          totalOrders: live.length,
          cancelled: orders.length - live.length,
          completed: live.filter((o) => ['ready', 'delivered'].includes(o.status)).length,
          delivered: live.filter((o) => o.status === 'delivered').length,
          overdue: live.filter((o) => OPEN_STATUSES.includes(o.status) && t(o.dueAt) < Date.now()).length,
          garments: live.reduce((x, o) => x + o.items.reduce((y, i) => y + (i.pricingModel === 'per_kg' ? 1 : i.quantity), 0), 0),
          avgOrderValue: live.length ? roundMoney(billed / live.length) : 0,
          avgTurnaroundHours: turnaround.length ? turnaround.reduce((a, b) => a + b, 0) / turnaround.length : 0,
          byStatus: statusDistribution(orders),
          byService: serviceBreakdown(live),
          topGarments: [...garmentMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
          byPriority: ['normal', 'express', 'urgent'].map((p) => ({ priority: p, count: live.filter((o) => o.priority === p).length })),
          staff: staffRows.sort((a, b) => b.completed - a.completed),
        },
      }
    }, { permission: 'reports.view', latency: [400, 700] })
  },
}
