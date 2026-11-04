import { db, resetDemoData } from './storage'
import { request, validationError } from './mockApi'
import { logActivity } from './helpers'
import { isValidEmail } from '../utils/validators'

const SECTION_PERMISSION = {
  business: 'settings.business',
  pricing: 'settings.business',
  notifications: 'settings.notifications',
  system: 'settings.system',
  preferences: 'settings.view',
}

function validateSection(section, values) {
  const e = {}
  if (section === 'business') {
    if (!values.name?.trim()) e.name = 'Business name is required'
    if (!values.phone?.trim()) e.phone = 'Phone number is required'
    if (values.email && !isValidEmail(values.email)) e.email = 'Enter a valid email'
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
  /** Readable by every signed-in user (business info is needed for receipts). */
  getSettings() {
    return request(() => db.get('settings'), { latency: [60, 140] })
  },

  /** Synchronous read for app bootstrap (date format, business name). */
  peekSettings() {
    return structuredClone(db.get('settings'))
  },

  updateSettings(section, values) {
    return request((user) => {
      const errors = validateSection(section, values)
      if (Object.keys(errors).length) throw validationError(errors)
      const next = { ...db.get('settings') }
      const numeric = section === 'pricing' ? Object.fromEntries(Object.entries(values).map(([k, v]) => [k, k === 'taxLabel' ? v : Number(v)])) : values
      next[section] = { ...next[section], ...numeric }
      db.set('settings', next)
      logActivity('settings', `updated ${section} settings`, user)
      return next
    }, { permission: SECTION_PERMISSION[section] ?? 'settings.system' })
  },

  resetDemoData() {
    return request(() => {
      resetDemoData()
      return { ok: true }
    }, { permission: 'settings.system', latency: [600, 900] })
  },
}
