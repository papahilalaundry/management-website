/**
 * Pure business calculations, shared by the services and the UI (e.g. the
 * live order summary) so totals are always computed the same way.
 */
import { OPEN_STATUSES, REGULAR_AFTER_ORDERS, stageIndex, STAGE_VALUES } from '../data/constants'
import { roundMoney } from './formatCurrency'

/** Weight is kept to 0.1 kg. */
export const roundKg = (kg) => Math.round((Number(kg) || 0) * 10) / 10

/** Total garments/items listed on an order (tracked for counting only, not priced). */
export const garmentCount = (items = []) => items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)

/**
 * One service line of an order: quantity × unit price, but never less than
 * the service's minimum charge (if it has one).
 * line: { unit, quantity, unitPrice, minCharge }
 */
export function lineTotal(line) {
  const qty = Math.max(0, Number(line.quantity) || 0)
  const raw = roundMoney(qty * Math.max(0, Number(line.unitPrice) || 0))
  const min = Math.max(0, Number(line.minCharge) || 0)
  return qty > 0 && raw < min ? roundMoney(min) : raw
}

/** Total kilograms across the weight-priced lines of an order. */
export const totalKg = (lines = []) => roundKg(lines.filter((l) => l.unit === 'kg').reduce((s, l) => s + (Number(l.quantity) || 0), 0))

/**
 * @param {object} input  { lines, priority, extraCharges, discount, taxRate }
 * @param {object} pricing settings.pricing { expressSurcharge, urgentSurcharge } (percentages)
 */
export function calcOrderTotals(input, pricing = {}) {
  const lines = input.lines || []
  const subtotal = roundMoney(lines.reduce((sum, l) => sum + lineTotal(l), 0))
  const surchargeRate =
    input.priority === 'express'
      ? Number(pricing.expressSurcharge) || 0
      : input.priority === 'urgent'
        ? Number(pricing.urgentSurcharge) || 0
        : 0
  const surcharge = roundMoney((subtotal * surchargeRate) / 100)
  const extraCharges = roundMoney(Math.max(0, Number(input.extraCharges) || 0))
  const gross = subtotal + surcharge + extraCharges
  const discount = roundMoney(Math.min(Math.max(0, Number(input.discount) || 0), gross))
  const taxRate = Math.max(0, Number(input.taxRate) || 0)
  const taxable = roundMoney(gross - discount)
  const tax = roundMoney((taxable * taxRate) / 100)
  const total = roundMoney(taxable + tax)
  return { weightKg: totalKg(lines), subtotal, surchargeRate, surcharge, extraCharges, discount, taxRate, tax, total }
}

export function paymentStatusFor(total, paid) {
  if (total > 0 && paid >= total - 0.001) return 'paid'
  if (paid > 0) return 'partial'
  return total <= 0 ? 'paid' : 'unpaid'
}

export function isOrderOverdue(order, now = new Date()) {
  if (!OPEN_STATUSES.includes(order.status)) return false
  return new Date(order.dueAt).getTime() < now.getTime()
}

/** Overall order status is the least-advanced status among its garments. */
export function deriveOrderStatusFromGarments(items) {
  if (!items?.length) return null
  const min = Math.min(...items.map((i) => Math.max(0, stageIndex(i.status))))
  return STAGE_VALUES[min]
}

/* ---- Client visit tracking ------------------------------------------------ */
export const clientTypeFor = (orderCount) => ((orderCount || 0) >= REGULAR_AFTER_ORDERS ? 'regular' : 'new')

/** Average days between drop-offs, or null with fewer than two visits. */
export function avgIntervalDays(firstOrderAt, lastOrderAt, orderCount) {
  if (!firstOrderAt || !lastOrderAt || (orderCount || 0) < 2) return null
  const days = (new Date(lastOrderAt) - new Date(firstOrderAt)) / 864e5
  return Math.round((days / (orderCount - 1)) * 10) / 10
}

export const daysSince = (iso, now = new Date()) => (iso ? Math.floor((now - new Date(iso)) / 864e5) : null)

export function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

export const sum = (arr, fn = (x) => x) => roundMoney(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0))
