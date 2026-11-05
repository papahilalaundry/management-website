import { db, docRef } from './storage'
import { request, validationError } from './mockApi'
import { logActivity, withWriter } from './helpers'
import { isValidEmail } from '../utils/validators'
import { resetDemoData } from '../data/seed'

const SECTION_PERMISSION = {
  business: 'settings.business',
  pricing: 'settings.business',
  notifications: 'settings.notifications',
  preferences: 'settings.view',
}

function validateSection(section, values) {
  const e = {}
  if (section === 'business') {
    if (!values.name?.trim()) e.name = 'Business name is required'
    if (values.email && !isValidEmail(values.email)) e.email = 'Enter a valid email'
    if (values.paybillNumber && !/^\d{5,7}$/.test(String(values.paybillNumber).trim())) e.paybillNumber = 'Paybill numbers are 5–7 digits'
  }
  if (section === 'pricing') {
    for (const k of ['taxRate', 'expressSurcharge', 'urgentSurcharge']) {
      const v = Number(values[k])
      if (Number.isNaN(v) || v < 0 || v > 100) e[k] = 'Enter a percentage between 0 and 100'
    }
    if (Number(values.deliveryFee) < 0 || Number.isNaN(Number(values.deliveryFee))) e.deliveryFee = 'Fee cannot be negative'
  }
  return e
}

export const settingsService = {
  /** Readable by everyone (business info is needed on the login page and receipts). */
  getSettings() {
    return Promise.resolve(structuredClone(db.get('settings')))
  },

  /** Synchronous read for app bootstrap (date format, business name). */
  peekSettings() {
    return structuredClone(db.get('settings'))
  },

  updateSettings(section, values) {
    return request(async (user) => {
      const errors = validateSection(section, values)
      if (Object.keys(errors).length) throw validationError(errors)
      const numeric = section === 'pricing' ? Object.fromEntries(Object.entries(values).map(([k, v]) => [k, k === 'taxLabel' ? v : Number(v)])) : values
      const next = { ...db.get('settings'), [section]: { ...db.get('settings')[section], ...numeric } }
      await withWriter(null, (b) => {
        b.set(docRef('app', 'settings'), { [section]: next[section] }, { merge: true })
        logActivity(b, 'settings', `updated ${section} settings`, user)
      })
      return next
    }, { permission: SECTION_PERMISSION[section] ?? 'settings.system' })
  },

  /** Admin only: replaces customers, orders, payments, expenses, inventory and logs with a small demo set. Staff accounts are kept. */
  resetDemoData() {
    return request(async (user) => {
      await resetDemoData({ staff: db.get('staff'), by: user })
      return { ok: true }
    }, { permission: 'settings.system' })
  },
}
