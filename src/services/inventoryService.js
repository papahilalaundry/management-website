import { db } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { buildContext, logActivity, nowIso, pushNotification, staffName, stockStatus } from './helpers'
import { formatId } from '../utils/generateIds'
import { roundMoney } from '../utils/formatCurrency'
import { validateInventoryItem } from '../utils/validators'

const withStatus = (item) => ({ ...item, status: stockStatus(item), stockValue: roundMoney(item.stock * item.unitCost) })

function alertIfLow(before, after) {
  const was = stockStatus(before)
  const now = stockStatus(after)
  if (now === 'in' || now === was) return
  pushNotification(
    'low_stock',
    now === 'out' ? 'Out of stock' : 'Low stock alert',
    `${after.name}: ${after.stock} ${after.unit} left (minimum ${after.minStock}).`,
    `/inventory?item=${after.id}`,
  )
}

export const inventoryService = {
  getInventory() {
    return request(() => db.get('inventory').map(withStatus).sort((a, b) => a.name.localeCompare(b.name)), { permission: 'inventory.view' })
  },

  getStockMovements(itemId) {
    return request(() => {
      const ctx = buildContext()
      const items = new Map(db.get('inventory').map((i) => [i.id, i]))
      return db
        .get('stockMovements')
        .filter((m) => !itemId || m.itemId === itemId)
        .map((m) => ({ ...m, itemName: items.get(m.itemId)?.name ?? 'Deleted item', unit: items.get(m.itemId)?.unit ?? '', byName: staffName(ctx, m.by) }))
        .sort((a, b) => b.at.localeCompare(a.at))
    }, { permission: 'inventory.view', latency: [120, 250] })
  },

  createItem(data) {
    return request((user) => {
      const errors = validateInventoryItem(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const item = {
        id: formatId('INV', db.nextCounter('inventory'), 3),
        name: data.name.trim(),
        category: data.category,
        unit: data.unit,
        stock: Number(data.stock),
        minStock: Number(data.minStock),
        unitCost: Number(data.unitCost),
        supplier: data.supplier?.trim() ?? '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.update('inventory', (list) => [...list, item])
      if (item.stock > 0) {
        db.update('stockMovements', (list) => [...list, { id: `${item.id}-M1`, itemId: item.id, type: 'received', quantity: item.stock, balanceAfter: item.stock, reason: 'Opening stock', at: nowIso(), by: user.id }])
      }
      logActivity('inventory', `added inventory item ${item.name}`, user, { itemId: item.id })
      alertIfLow({ ...item, stock: Infinity }, item)
      return withStatus(item)
    }, { permission: 'inventory.manage' })
  },

  /** Edits item details. Stock levels change only through recordMovement(). */
  updateItem(id, data) {
    return request((user) => {
      const existing = db.get('inventory').find((i) => i.id === id)
      if (!existing) throw notFound('Inventory item')
      const errors = validateInventoryItem({ ...data, stock: existing.stock })
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...existing, name: data.name.trim(), category: data.category, unit: data.unit, minStock: Number(data.minStock), unitCost: Number(data.unitCost), supplier: data.supplier?.trim() ?? '', updatedAt: nowIso() }
      db.update('inventory', (list) => list.map((i) => (i.id === id ? updated : i)))
      logActivity('inventory', `updated inventory item ${updated.name}`, user, { itemId: id })
      alertIfLow(existing, updated)
      return withStatus(updated)
    }, { permission: 'inventory.manage' })
  },

  /**
   * @param {object} data { type: 'received'|'used'|'adjustment', quantity, reason }
   * For adjustments, quantity is the signed change (e.g. -2 after a count).
   */
  recordMovement(id, data) {
    return request((user) => {
      const item = db.get('inventory').find((i) => i.id === id)
      if (!item) throw notFound('Inventory item')
      const errors = {}
      const qty = Number(data.quantity)
      if (!['received', 'used', 'adjustment'].includes(data.type)) errors.type = 'Select a movement type'
      if (Number.isNaN(qty) || qty === 0) errors.quantity = 'Enter a quantity'
      else if (data.type !== 'adjustment' && qty < 0) errors.quantity = 'Quantity must be positive'
      if (!data.reason?.trim()) errors.reason = 'A reason is required for every stock movement'
      if (Object.keys(errors).length) throw validationError(errors)
      const delta = data.type === 'used' ? -Math.abs(qty) : data.type === 'received' ? Math.abs(qty) : qty
      const newStock = roundMoney(item.stock + delta)
      if (newStock < 0) throw validationError({ quantity: `Only ${item.stock} ${item.unit} in stock` }, 'Stock cannot go below zero.')

      const updated = { ...item, stock: newStock, updatedAt: nowIso() }
      db.update('inventory', (list) => list.map((i) => (i.id === id ? updated : i)))
      const movement = { id: `${id}-M${Date.now().toString(36)}`, itemId: id, type: data.type, quantity: delta, balanceAfter: newStock, reason: data.reason.trim(), at: nowIso(), by: user.id }
      db.update('stockMovements', (list) => [...list, movement])
      const verb = data.type === 'received' ? 'received' : data.type === 'used' ? 'used' : 'adjusted'
      logActivity('inventory', `${verb} ${Math.abs(delta)} ${item.unit} of ${item.name}`, user, { itemId: id })
      alertIfLow(item, updated)
      return { item: withStatus(updated), movement }
    }, { permission: 'inventory.manage' })
  },

  deleteItem(id) {
    return request((user) => {
      const existing = db.get('inventory').find((i) => i.id === id)
      if (!existing) throw notFound('Inventory item')
      if (existing.stock > 0) throw new ApiError('Only items with zero stock can be deleted. Record usage or an adjustment first.', { status: 409 })
      db.update('inventory', (list) => list.filter((i) => i.id !== id))
      logActivity('inventory', `deleted inventory item ${existing.name}`, user)
      return { id }
    }, { permission: 'inventory.manage' })
  },
}
