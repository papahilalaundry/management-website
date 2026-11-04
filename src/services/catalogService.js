/** Laundry services & pricing catalogue. */
import { db } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { logActivity, nowIso } from './helpers'
import { formatId } from '../utils/generateIds'
import { formatCurrency } from '../utils/formatCurrency'
import { validateService } from '../utils/validators'

function usage(serviceId) {
  let orders = 0
  let garments = 0
  for (const o of db.get('orders')) {
    const lines = o.items.filter((i) => i.serviceId === serviceId)
    if (lines.length) {
      orders += 1
      garments += lines.reduce((s, l) => s + (l.pricingModel === 'per_kg' ? 1 : l.quantity), 0)
    }
  }
  return { orderCount: orders, garmentCount: garments }
}

export const catalogService = {
  /** Active services only by default — what order forms need. */
  getServices({ includeInactive = true, withUsage = false } = {}) {
    return request(() => {
      const list = db.get('services').filter((s) => includeInactive || s.active)
      return withUsage ? list.map((s) => ({ ...s, ...usage(s.id) })) : list
    }, { latency: [120, 260] })
  },

  createService(data) {
    return request((user) => {
      const errors = validateService(data)
      if (db.get('services').some((s) => s.name.toLowerCase() === data.name?.trim().toLowerCase())) errors.name = 'A service with this name already exists'
      if (Object.keys(errors).length) throw validationError(errors)
      const service = {
        id: formatId('SRV', db.nextCounter('service'), 2),
        name: data.name.trim(),
        description: data.description?.trim() ?? '',
        pricingModel: data.pricingModel,
        price: Number(data.price),
        active: data.active !== false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.update('services', (list) => [...list, service])
      logActivity('service', `added service “${service.name}” at ${formatCurrency(service.price)}`, user)
      return service
    }, { permission: 'services.manage' })
  },

  updateService(id, data) {
    return request((user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      const errors = validateService(data)
      if (db.get('services').some((s) => s.id !== id && s.name.toLowerCase() === data.name?.trim().toLowerCase())) errors.name = 'A service with this name already exists'
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...existing, name: data.name.trim(), description: data.description?.trim() ?? '', pricingModel: data.pricingModel, price: Number(data.price), active: data.active !== false, updatedAt: nowIso() }
      db.update('services', (list) => list.map((s) => (s.id === id ? updated : s)))
      if (existing.price !== updated.price) logActivity('service', `changed ${updated.name} price from ${formatCurrency(existing.price)} to ${formatCurrency(updated.price)}`, user)
      return updated
    }, { permission: 'services.manage' })
  },

  setServiceActive(id, active) {
    return request((user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      db.update('services', (list) => list.map((s) => (s.id === id ? { ...s, active, updatedAt: nowIso() } : s)))
      logActivity('service', `${active ? 'activated' : 'deactivated'} service “${existing.name}”`, user)
      return { ...existing, active }
    }, { permission: 'services.manage', latency: [120, 250] })
  },

  deleteService(id) {
    return request((user) => {
      const existing = db.get('services').find((s) => s.id === id)
      if (!existing) throw notFound('Service')
      if (usage(id).orderCount > 0) throw new ApiError('This service is used by existing orders and cannot be deleted. Deactivate it instead.', { status: 409 })
      db.update('services', (list) => list.filter((s) => s.id !== id))
      logActivity('service', `deleted service “${existing.name}”`, user)
      return { id }
    }, { permission: 'services.manage' })
  },
}
