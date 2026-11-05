/**
 * Small, dependency-free validation helpers. Each validator returns an
 * object of { field: message } — empty when valid. Used by both forms (for
 * inline errors) and the mock API (server-side style validation).
 */

import { isMpesaMethod, PAYMENT_METHOD_VALUES, PRICING_UNITS } from '../data/constants'

const PRICING_UNIT_VALUES = PRICING_UNITS.map((u) => u.value)

export const normalizePhone = (phone = '') => String(phone).replace(/[\s()-]/g, '')

/** Accepts 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, 2541XXXXXXXX */
export function isValidKenyanPhone(phone) {
  return /^(?:\+?254|0)(?:7|1)\d{8}$/.test(normalizePhone(phone))
}

/** Store phones in local 07XX format */
export function toLocalPhone(phone) {
  const p = normalizePhone(phone)
  if (p.startsWith('+254')) return `0${p.slice(4)}`
  if (p.startsWith('254')) return `0${p.slice(3)}`
  return p
}

export function displayPhone(phone) {
  const p = toLocalPhone(phone)
  return p.length === 10 ? `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : phone
}

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())

/** M-Pesa confirmation codes are 10 uppercase alphanumeric characters. */
export const isValidMpesaRef = (ref) => /^[A-Z0-9]{10}$/.test(String(ref).trim().toUpperCase())

export const hasErrors = (errors) => Object.keys(errors).length > 0

export function validateCustomer(data) {
  const e = {}
  if (!data.name?.trim()) e.name = 'Full name is required'
  else if (data.name.trim().length < 3) e.name = 'Enter the customer’s full name'
  if (!data.phone?.trim()) e.phone = 'Phone number is required'
  else if (!isValidKenyanPhone(data.phone)) e.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678'
  if (data.email?.trim() && !isValidEmail(data.email)) e.email = 'Enter a valid email address'
  return e
}

/**
 * @param data { orderId, method, amount (actually paid), expectedAmount (estimated), payerName, reference, paidAt }
 */
export function validatePayment(data, { outstanding } = {}) {
  const e = {}
  const amount = Number(data.amount)
  if (!data.orderId) e.orderId = 'Select an order'
  if (!data.amount || Number.isNaN(amount) || amount <= 0) e.amount = 'Amount paid must be greater than zero'
  else if (outstanding != null && amount > outstanding + 0.001)
    e.amount = 'Amount cannot exceed the outstanding balance'
  if (data.expectedAmount !== undefined && data.expectedAmount !== '' && data.expectedAmount !== null) {
    const exp = Number(data.expectedAmount)
    if (Number.isNaN(exp) || exp < 0) e.expectedAmount = 'Estimated amount cannot be negative'
  }
  if (!PAYMENT_METHOD_VALUES.includes(data.method)) e.method = 'Select Paybill, M-Pesa number or Cash'
  if (isMpesaMethod(data.method) && !data.payerName?.trim()) e.payerName = 'Enter the name shown on the M-Pesa message'
  if (isMpesaMethod(data.method) && data.reference?.trim() && !isValidMpesaRef(data.reference))
    e.reference = 'M-Pesa codes are 10 letters/digits, e.g. SKD4H7J2LQ'
  if (!data.paidAt) e.paidAt = 'Payment date is required'
  else if (new Date(data.paidAt).getTime() > Date.now() + 5 * 60e3) e.paidAt = 'Payment date cannot be in the future'
  return e
}

export function validateExpense(data) {
  const e = {}
  if (!data.title?.trim()) e.title = 'Expense title is required'
  if (!data.category) e.category = 'Select a category'
  const amount = Number(data.amount)
  if (!data.amount || Number.isNaN(amount) || amount <= 0) e.amount = 'Amount must be greater than zero'
  if (!data.date) e.date = 'Date is required'
  if (!data.method) e.method = 'Select a payment method'
  return e
}

export function validateInventoryItem(data) {
  const e = {}
  if (!data.name?.trim()) e.name = 'Item name is required'
  if (!data.category) e.category = 'Select a category'
  if (!data.unit) e.unit = 'Select a unit'
  if (data.stock === '' || Number(data.stock) < 0 || Number.isNaN(Number(data.stock))) e.stock = 'Stock cannot be negative'
  if (data.minStock === '' || Number(data.minStock) < 0) e.minStock = 'Threshold cannot be negative'
  if (data.unitCost === '' || Number(data.unitCost) < 0) e.unitCost = 'Cost cannot be negative'
  return e
}

export function validateService(data) {
  const e = {}
  if (!data.name?.trim()) e.name = 'Service name is required'
  if (!PRICING_UNIT_VALUES.includes(data.unit)) e.unit = 'Choose how this service is measured'
  if (data.unit === 'custom' && !data.unitLabel?.trim()) e.unitLabel = 'Name the unit, e.g. "seat" or "bag"'
  if (data.price === '' || data.price == null || Number.isNaN(Number(data.price)) || Number(data.price) < 0) e.price = 'Enter a price (0 or more)'
  if (data.minCharge !== '' && data.minCharge != null && (Number.isNaN(Number(data.minCharge)) || Number(data.minCharge) < 0)) e.minCharge = 'Minimum charge cannot be negative'
  return e
}

export const isValidUsername = (u) => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(u).trim().toLowerCase())

export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Use at least 8 characters'
  if (!/[A-Z]/.test(pw) || !/d/.test(pw)) return 'Include an uppercase letter and a number'
  return null
}

/** @param {object} opts { creating } — a password is required only when creating an account. */
export function validateStaff(data, { creating = false } = {}) {
  const e = {}
  if (!data.name?.trim()) e.name = 'Full name is required'
  if (creating) {
    if (!data.username?.trim()) e.username = 'Username is required'
    else if (!isValidUsername(data.username)) e.username = '3–30 characters: letters, numbers, dot, dash or underscore'
    const pw = validatePassword(data.password)
    if (pw) e.password = pw
  }
  if (!data.phone?.trim()) e.phone = 'Phone number is required'
  else if (!isValidKenyanPhone(data.phone)) e.phone = 'Enter a valid Kenyan number'
  if (!data.role) e.role = 'Select a role'
  return e
}
