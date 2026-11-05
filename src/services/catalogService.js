/**
 * Services the business offers. Each one chooses how it is measured and
 * charged (kg, pair, piece, m², panel, fixed job or a custom unit), its price
 * per unit, an optional minimum charge, whether staff may change the price on
 * an order (e.g. shoes that vary pair by pair), and whether orders list the
 * individual garments/items for tracking.
 */
import { query, where } from 'firebase/firestore'
import { allocate, col, countOf, db, docRef, transact } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { logActivity, nowIso, withWriter } from './helpers'
import { formatId } from '../utils/generateIds'
import { formatCurrency } from '../utils/formatCurrency'
import { unitLabel, unitOf } from '../data/constants'
import { validateService } from '../utils/validators'

const usage = async (serviceId) => ({ orderCount: await countOf(query(col('orders'), where('serviceIds', 'array-contains', serviceId))) })

/** Service fields from form data. */
function normalize(data) {
  const unit = data.unit
  return {
    name: data.name.trim(),
    description: data.description?.trim() ?? '',
    unit,
    unitLabel: unit === 'custom' ? data.unitLabel.trim().toLowerCase() : '',
    price: Number(data.price),
    minCharge: data.minCharge === '' || data.minCharge == null ? 0 : Number(data.minCharge),
    priceEditable: !!data.priceEditable,
    trackItems: data.trackItems !== false,
    active: data.active !== false,
  }
}

/** Fills in fields for services saved before units existed. */
export const withUnit = (s) => ({ minCharge: 0, priceEditable: false, trackItems: true, unitLabel: '', ...s, unit: unitOf(s) })
const priceText = (s) => `${formatCurrency(s.price)}/${unitLabel(s)}`

export const catalogService = {
  /** All services (active and inactive by default). withUsage adds orderCount (one count query each). */
  getServices({ includeInactive = true, withUsage = false } = {}) {
    return request(async () => {
      const list = db.get('services').filter((s) => includeInactive || s.active !== false).map(withUnit)
      if (!withUsage) return list
      return Promise.all(list.map(async (s) => ({ ...s, ...(await usage(s.id)) })))
    })
  },

  createService(data) {
    return request(async (user) => {
      const errors = validateService(data)
      if (db.get('services').some((s) => s.name.toLowerCase() === data.name?.trim().toLowerCase())) errors.name = 'A service with this name already exists'
      if (Object.keys(errors).length) throw validationError(errors)
      return transact(async (tx) => {
        const { ids, commit } = await allocate(tx, { service: 1 })
        const service = { id: formatId('SRV', ids.service, 2), ...normalize(data), createdAt: nowIso(), updatedAt: nowIso() }
        commit()
        tx.set(docRef('services', service.id), service)
        logActivity(tx, 'service', `added service “${service.name}” at ${priceText(service)}`, user)
        return service
      })
    }, { permission: 'services.manage' })
  },

  updateService(id, data) {
    return request(async (user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      const errors = validateService(data)
      if (db.get('services').some((s) => s.id !== id && s.name.toLowerCase() === data.name?.trim().toLowerCase())) errors.name = 'A service with this name already exists'
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...existing, ...normalize(data), updatedAt: nowIso() }
      delete updated.pricingModel
      await withWriter(null, (b) => {
        b.set(docRef('services', id), updated)
        if (existing.price !== updated.price || unitOf(existing) !== updated.unit) logActivity(b, 'service', `changed ${updated.name} price from ${priceText(withUnit(existing))} to ${priceText(updated)}`, user)
      })
      return updated
    }, { permission: 'services.manage' })
  },

  setServiceActive(id, active) {
    return request(async (user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      await withWriter(null, (b) => {
        b.update(docRef('services', id), { active, updatedAt: nowIso() })
        logActivity(b, 'service', `${active ? 'activated' : 'deactivated'} service “${existing.name}”`, user)
      })
      return { ...existing, active }
    }, { permission: 'services.manage' })
  },

  deleteService(id) {
    return request(async (user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      if ((await usage(id)).orderCount > 0) throw new ApiError('This service is used by existing orders and cannot be deleted. Deactivate it instead.', { status: 409 })
      await withWriter(null, (b) => {
        b.delete(docRef('services', id))
        logActivity(b, 'service', `deleted service “${existing.name}”`, user)
      })
      return { id }
    }, { permission: 'services.manage' })
  },
}
