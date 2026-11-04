/**
 * Pure business calculations. These are shared by the mock API and the UI
 * (e.g. the live order summary) so totals are always computed the same way.
 */
import { OPEN_STATUSES, stageIndex, STAGE_VALUES } from '../data/constants'
import { roundMoney } from './formatCurrency'

export const lineTotal = (item) => roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))

/**
 * @param {object} input  { items, priority, extraCharges, discount, taxRate }
 * @param {object} pricing settings.pricing { expressSurcharge, urgentSurcharge } (percentages)
 */
export function calcOrderTotals(input, pricing = {}) {
  const subtotal = roundMoney((input.items || []).reduce((sum, it) => sum + lineTotal(it), 0))
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
  return { subtotal, surchargeRate, surcharge, extraCharges, discount, taxRate, tax, total }
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
  if (!items?.length) return 'received'
  const min = Math.min(...items.map((i) => Math.max(0, stageIndex(i.status))))
  return STAGE_VALUES[min]
}

export function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

export const sum = (arr, fn = (x) => x) => roundMoney(arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0))
