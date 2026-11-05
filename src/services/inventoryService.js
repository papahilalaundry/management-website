import { orderBy, query, where } from 'firebase/firestore'
import { allocate, col, db, docRef, fetchPage, transact } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { logActivity, logId, nowIso, pushNotification, staffName, stockStatus, withWriter } from './helpers'
import { formatId } from '../utils/generateIds'
import { roundMoney } from '../utils/formatCurrency'
import { validateInventoryItem } from '../utils/validators'

const withStatus = (item) => ({ ...item, status: stockStatus(item), stockValue: roundMoney(item.stock * item.unitCost) })

function alertIfLow(writer, before, after) {
  const was = stockStatus(before)
  const now = stockStatus(after)
  if (now === 'in' || now === was) return
  pushNotification(
    writer,
    'low_stock',
    now === 'out' ? 'Out of stock' : 'Low stock alert',
    `${after.name}: ${after.stock} ${after.unit} left (minimum ${after.minStock}).`,
    `/inventory?item=${after.id}`,
  )
}

export const inventoryService = {
  getInventory() {
    return request(async () => db.get('inventory').map(withStatus), { permission: 'inventory.view' })
  },

  /**
   * One page of stock movements, newest first (optionally for one item).
   * @returns {{ rows, cursor, hasMore }}
   */
  getStockMovements(itemId, { pageSize = 20, cursor = null } = {}) {
    return request(async () => {
      const items = new Map(db.get('inventory').map((i) => [i.id, i]))
      const q = query(col('stockMovements'), ...(itemId ? [where('itemId', '==', itemId)] : []), orderBy('at', 'desc'))
      const page = await fetchPage(q, { pageSize, cursor })
      return {
        ...page,
        rows: page.rows.map((m) => ({ ...m, itemName: items.get(m.itemId)?.name ?? 'Deleted item', unit: items.get(m.itemId)?.unit ?? '', byName: staffName(m.by) })),
      }
    }, { permission: 'inventory.view' })
  },

  createItem(data) {
    return request(async (user) => {
      const errors = validateInventoryItem(data)
      if (Object.keys(errors).length) throw validationError(errors)
      const item = await transact(async (tx) => {
        const { ids, commit } = await allocate(tx, { inventory: 1 })
        const it = {
          id: formatId('INV', ids.inventory, 3),
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
        commit()
        tx.set(docRef('inventory', it.id), it)
        if (it.stock > 0) {
          const m = { id: logId('MOV'), itemId: it.id, type: 'received', quantity: it.stock, balanceAfter: it.stock, reason: 'Opening stock', at: nowIso(), by: user.id }
          tx.set(docRef('stockMovements', m.id), m)
        }
        logActivity(tx, 'inventory', `added inventory item ${it.name}`, user, { itemId: it.id })
        alertIfLow(tx, { ...it, stock: Infinity }, it)
        return it
      })
      return withStatus(item)
    }, { permission: 'inventory.manage' })
  },

  /** Edits item details. Stock levels change only through recordMovement(). */
  updateItem(id, data) {
    return request(async (user) => {
      const existing = db.get('inventory').find((i) => i.id === id)
      if (!existing) throw notFound('Inventory item')
      const errors = validateInventoryItem({ ...data, stock: existing.stock })
      if (Object.keys(errors).length) throw validationError(errors)
      const patch = { name: data.name.trim(), category: data.category, unit: data.unit, minStock: Number(data.minStock), unitCost: Number(data.unitCost), supplier: data.supplier?.trim() ?? '', updatedAt: nowIso() }
      const updated = { ...existing, ...patch }
      await withWriter(null, (b) => {
        b.update(docRef('inventory', id), patch)
        logActivity(b, 'inventory', `updated inventory item ${updated.name}`, user, { itemId: id })
        alertIfLow(b, existing, updated)
      })
      return withStatus(updated)
    }, { permission: 'inventory.manage' })
  },

  /**
   * @param {object} data { type: 'received'|'used'|'adjustment', quantity, reason }
   * For adjustments, quantity is the signed change (e.g. -2 after a count).
   */
  recordMovement(id, data) {
    return request(async (user) => {
      const errors = {}
      const qty = Number(data.quantity)
      if (!['received', 'used', 'adjustment'].includes(data.type)) errors.type = 'Select a movement type'
      if (Number.isNaN(qty) || qty === 0) errors.quantity = 'Enter a quantity'
      else if (data.type !== 'adjustment' && qty < 0) errors.quantity = 'Quantity must be positive'
      if (!data.reason?.trim()) errors.reason = 'A reason is required for every stock movement'
      if (Object.keys(errors).length) throw validationError(errors)
      return transact(async (tx) => {
        const snap = await tx.get(docRef('inventory', id))
        if (!snap.exists()) throw notFound('Inventory item')
        const item = snap.data()
        const delta = data.type === 'used' ? -Math.abs(qty) : data.type === 'received' ? Math.abs(qty) : qty
        const newStock = roundMoney(item.stock + delta)
        if (newStock < 0) throw validationError({ quantity: `Only ${item.stock} ${item.unit} in stock` }, 'Stock cannot go below zero.')
        const updated = { ...item, stock: newStock, updatedAt: nowIso() }
        tx.update(docRef('inventory', id), { stock: newStock, updatedAt: updated.updatedAt })
        const movement = { id: logId('MOV'), itemId: id, type: data.type, quantity: delta, balanceAfter: newStock, reason: data.reason.trim(), at: nowIso(), by: user.id }
        tx.set(docRef('stockMovements', movement.id), movement)
        const verb = data.type === 'received' ? 'received' : data.type === 'used' ? 'used' : 'adjusted'
        logActivity(tx, 'inventory', `${verb} ${Math.abs(delta)} ${item.unit} of ${item.name}`, user, { itemId: id })
        alertIfLow(tx, item, updated)
        return { item: withStatus(updated), movement }
      })
    }, { permission: 'inventory.manage' })
  },

  deleteItem(id) {
    return request(async (user) => {
      const existing = db.get('inventory').find((i) => i.id === id)
      if (!existing) throw notFound('Inventory item')
      if (existing.stock > 0) throw new ApiError('Only items with zero stock can be deleted. Record usage or an adjustment first.', { status: 409 })
      await withWriter(null, (b) => {
        b.delete(docRef('inventory', id))
        logActivity(b, 'inventory', `deleted inventory item ${existing.name}`, user)
      })
      return { id }
    }, { permission: 'inventory.manage' })
  },
}
