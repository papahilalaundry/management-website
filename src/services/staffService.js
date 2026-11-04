import { db } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { buildContext, enrichOrder, logActivity, nowIso, pushNotification } from './helpers'
import { formatId } from '../utils/generateIds'
import { displayPhone, isValidKenyanPhone, toLocalPhone, validateStaff } from '../utils/validators'

/** Never send passwords to the UI. */
const publicStaff = ({ password, ...rest }) => rest // eslint-disable-line no-unused-vars

function ordersHandled(staffId, orders) {
  return orders.filter((o) => o.assignedTo === staffId || o.createdBy === staffId).length
}

export const staffService = {
  /** Basic list of active staff for pickers (assignment). Available to all roles. */
  getAssignableStaff() {
    return request(() => db.get('staff').filter((s) => s.status === 'active').map(({ id, name, role, title }) => ({ id, name, role, title })), { latency: [80, 160] })
  },

  getStaff() {
    return request(() => {
      const orders = db.get('orders')
      return db.get('staff').map((s) => ({ ...publicStaff(s), ordersHandled: ordersHandled(s.id, orders) }))
    }, { permission: 'staff.view' })
  },

  getStaffById(id) {
    return request(() => {
      const staff = db.get('staff').find((s) => s.id === id)
      if (!staff) throw notFound('Staff member')
      const ctx = buildContext()
      const orders = db.get('orders')
      const assigned = orders.filter((o) => o.assignedTo === id).map((o) => enrichOrder(o, ctx)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      return {
        ...publicStaff(staff),
        ordersHandled: ordersHandled(id, orders),
        assignedOrders: assigned.slice(0, 25),
        openAssigned: assigned.filter((o) => ['received', 'washing', 'drying', 'ironing'].includes(o.status)).length,
        paymentsRecorded: db.get('payments').filter((p) => p.recordedBy === id).length,
        activities: db.get('activities').filter((a) => a.by === id).slice(0, 30),
      }
    }, { permission: 'staff.view' })
  },

  createStaff(data) {
    return request((user) => {
      const errors = validateStaff(data)
      if (db.get('staff').some((s) => s.email.toLowerCase() === data.email?.trim().toLowerCase())) errors.email = 'This email is already in use'
      if (Object.keys(errors).length) throw validationError(errors)
      const member = {
        id: formatId('STF', db.nextCounter('staff'), 3),
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: displayPhone(toLocalPhone(data.phone)),
        role: data.role,
        title: data.title?.trim() ?? '',
        status: data.status ?? 'active',
        password: 'Welcome123!', // DEMO default password
        joinedAt: nowIso(),
        lastActiveAt: null,
      }
      db.update('staff', (list) => [...list, member])
      logActivity('staff', `added ${member.role} account for ${member.name}`, user)
      pushNotification('staff', 'New staff account', `${member.name} was added as ${member.role} by ${user.name}.`, '/staff')
      return publicStaff(member)
    }, { permission: 'staff.manage' })
  },

  updateStaff(id, data) {
    return request((user) => {
      const list = db.get('staff')
      const existing = list.find((s) => s.id === id)
      if (!existing) throw notFound('Staff member')
      const errors = validateStaff(data)
      if (list.some((s) => s.id !== id && s.email.toLowerCase() === data.email?.trim().toLowerCase())) errors.email = 'This email is already in use'
      if (Object.keys(errors).length) throw validationError(errors)

      // Guard rails: nobody can change their own role or deactivate themselves,
      // and the business must always keep at least one active admin.
      if (id === user.id && data.role !== existing.role) throw new ApiError('You cannot change your own role.', { status: 403 })
      if (id === user.id && data.status === 'inactive') throw new ApiError('You cannot deactivate your own account.', { status: 403 })
      const activeAdmins = list.filter((s) => s.role === 'admin' && s.status === 'active')
      if (existing.role === 'admin' && existing.status === 'active' && (data.role !== 'admin' || data.status === 'inactive') && activeAdmins.length <= 1)
        throw new ApiError('At least one active administrator is required.', { status: 409 })

      const updated = { ...existing, name: data.name.trim(), email: data.email.trim().toLowerCase(), phone: displayPhone(toLocalPhone(data.phone)), role: data.role, title: data.title?.trim() ?? '', status: data.status }
      db.update('staff', (l) => l.map((s) => (s.id === id ? updated : s)))
      if (existing.role !== updated.role) logActivity('staff', `changed ${updated.name}'s role from ${existing.role} to ${updated.role}`, user)
      else if (existing.status !== updated.status) logActivity('staff', `${updated.status === 'active' ? 'activated' : 'deactivated'} ${updated.name}`, user)
      else logActivity('staff', `updated ${updated.name}'s profile`, user)
      return publicStaff(updated)
    }, { permission: 'staff.manage' })
  },

  setStaffStatus(id, status) {
    const existing = db.get('staff').find((s) => s.id === id)
    if (!existing) return Promise.reject(notFound('Staff member'))
    return staffService.updateStaff(id, { ...existing, status })
  },

  /** Any signed-in user can update their own name/phone (never their role). */
  updateOwnProfile(data) {
    return request((user) => {
      const errors = {}
      if (!data.name?.trim()) errors.name = 'Name is required'
      if (data.phone && !isValidKenyanPhone(data.phone)) errors.phone = 'Enter a valid Kenyan number'
      if (Object.keys(errors).length) throw validationError(errors)
      const updated = { ...db.get('staff').find((s) => s.id === user.id), name: data.name.trim(), phone: data.phone ? displayPhone(toLocalPhone(data.phone)) : '' }
      db.update('staff', (l) => l.map((s) => (s.id === user.id ? updated : s)))
      logActivity('staff', 'updated their profile', user)
      return publicStaff(updated)
    })
  },

  changeOwnPassword({ current, next }) {
    return request((user) => {
      const me = db.get('staff').find((s) => s.id === user.id)
      const errors = {}
      if (me.password !== current) errors.current = 'Current password is incorrect'
      if (!next || next.length < 8) errors.next = 'Use at least 8 characters'
      else if (!/[A-Z]/.test(next) || !/\d/.test(next)) errors.next = 'Include an uppercase letter and a number'
      if (Object.keys(errors).length) throw validationError(errors)
      db.update('staff', (l) => l.map((s) => (s.id === user.id ? { ...s, password: next } : s)))
      return { ok: true }
    })
  },
}
