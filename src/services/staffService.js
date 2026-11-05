/**
 * Staff accounts. Each staff member has a Firebase Auth login
 * (username@papahilalaundry.com) linked through users/{uid}, which also holds
 * their role and active flag for the security rules.
 */
import { orderBy, query, where } from 'firebase/firestore'
import { createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { auth, withSecondaryAuth } from '../firebase'
import { allocate, col, countOf, db, docRef, fetchAll, transact } from './storage'
import { request, notFound, validationError, ApiError } from './mockApi'
import { enrichOrder, logActivity, nowIso, pushNotification, staffName, withWriter } from './helpers'
import { formatId } from '../utils/generateIds'
import { displayPhone, isValidKenyanPhone, toLocalPhone, validatePassword, validateStaff } from '../utils/validators'
import { normalizeUsername, usernameToEmail } from '../data/constants'

const ordersHandled = (staffId) => countOf(query(col('orders'), where('assignedTo', '==', staffId)))

export const staffService = {
  /** Basic list of active staff for pickers (assignment). Available to all roles. */
  getAssignableStaff() {
    return request(async () => db.get('staff').filter((s) => s.status === 'active').map(({ id, name, role, title }) => ({ id, name, role, title })))
  },

  getStaff() {
    return request(async () => Promise.all(db.get('staff').map(async (s) => ({ ...s, ordersHandled: await ordersHandled(s.id) }))), { permission: 'staff.view' })
  },

  getStaffById(id) {
    return request(async () => {
      const staff = db.get('staff').find((s) => s.id === id)
      if (!staff) throw notFound('Staff member')
      const [assigned, total, openAssigned, paymentsRecorded, activities] = await Promise.all([
        fetchAll(query(col('orders'), where('assignedTo', '==', id), orderBy('receivedAt', 'desc')), 25),
        ordersHandled(id),
        countOf(query(col('orders'), where('assignedTo', '==', id), where('isOpen', '==', true))),
        countOf(query(col('payments'), where('recordedBy', '==', id))),
        fetchAll(query(col('activities'), where('by', '==', id), orderBy('at', 'desc')), 30),
      ])
      const now = new Date()
      return {
        ...staff,
        ordersHandled: total,
        assignedOrders: assigned.map((o) => enrichOrder(o, now)),
        openAssigned,
        paymentsRecorded,
        activities: activities.map((a) => ({ ...a, byName: staffName(a.by) })),
      }
    }, { permission: 'staff.view' })
  },

  /** data: { name, username, password, phone, role, title, status } */
  createStaff(data) {
    return request(async (user) => {
      const errors = validateStaff(data, { creating: true })
      const username = normalizeUsername(data.username)
      if (!errors.username && db.get('staff').some((s) => s.username === username)) errors.username = 'This username is already taken'
      if (Object.keys(errors).length) throw validationError(errors)

      let uid
      try {
        uid = await withSecondaryAuth(async (a) => (await createUserWithEmailAndPassword(a, usernameToEmail(username), data.password)).user.uid)
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') throw validationError({ username: 'This username is already taken' })
        if (err.code === 'auth/weak-password') throw validationError({ password: 'Choose a stronger password' })
        throw err
      }

      return transact(async (tx) => {
        const { ids, commit } = await allocate(tx, { staff: 1 })
        const member = {
          id: formatId('STF', ids.staff, 3),
          uid,
          username,
          email: usernameToEmail(username),
          name: data.name.trim(),
          phone: displayPhone(toLocalPhone(data.phone)),
          role: data.role,
          title: data.title?.trim() ?? '',
          status: data.status ?? 'active',
          joinedAt: nowIso(),
          lastActiveAt: null,
        }
        commit()
        tx.set(docRef('staff', member.id), member)
        tx.set(docRef('users', uid), { staffId: member.id, username, role: member.role, active: member.status === 'active' })
        logActivity(tx, 'staff', `added ${member.role} account for ${member.name} (${username})`, user)
        pushNotification(tx, 'staff', 'New staff account', `${member.name} was added as ${member.role} by ${user.name}.`, '/staff')
        return member
      })
    }, { permission: 'staff.manage' })
  },

  /** Updates profile, role and status (username and password are not changed here). */
  updateStaff(id, data) {
    return request(async (user) => {
      const list = db.get('staff')
      const existing = list.find((s) => s.id === id)
      if (!existing) throw notFound('Staff member')
      const errors = validateStaff(data)
      if (Object.keys(errors).length) throw validationError(errors)

      // Guard rails: nobody can change their own role or deactivate themselves,
      // and the business must always keep at least one active admin.
      if (id === user.id && data.role !== existing.role) throw new ApiError('You cannot change your own role.', { status: 403 })
      if (id === user.id && data.status === 'inactive') throw new ApiError('You cannot deactivate your own account.', { status: 403 })
      const activeAdmins = list.filter((s) => s.role === 'admin' && s.status === 'active')
      if (existing.role === 'admin' && existing.status === 'active' && (data.role !== 'admin' || data.status === 'inactive') && activeAdmins.length <= 1)
        throw new ApiError('At least one active administrator is required.', { status: 409 })

      const updated = { ...existing, name: data.name.trim(), phone: displayPhone(toLocalPhone(data.phone)), role: data.role, title: data.title?.trim() ?? '', status: data.status }
      await withWriter(null, (b) => {
        b.set(docRef('staff', id), updated)
        if (existing.uid) b.set(docRef('users', existing.uid), { staffId: id, username: existing.username, role: updated.role, active: updated.status === 'active' })
        if (existing.role !== updated.role) logActivity(b, 'staff', `changed ${updated.name}'s role from ${existing.role} to ${updated.role}`, user)
        else if (existing.status !== updated.status) logActivity(b, 'staff', `${updated.status === 'active' ? 'activated' : 'deactivated'} ${updated.name}`, user)
        else logActivity(b, 'staff', `updated ${updated.name}'s profile`, user)
      })
      return updated
    }, { permission: 'staff.manage' })
  },

  setStaffStatus(id, status) {
    const existing = db.get('staff').find((s) => s.id === id)
    if (!existing) return Promise.reject(notFound('Staff member'))
    return staffService.updateStaff(id, { ...existing, status })
  },

  /** Any signed-in user can update their own name/phone (never their role). */
  updateOwnProfile(data) {
    return request(async (user) => {
      const errors = {}
      if (!data.name?.trim()) errors.name = 'Name is required'
      if (data.phone && !isValidKenyanPhone(data.phone)) errors.phone = 'Enter a valid Kenyan number'
      if (Object.keys(errors).length) throw validationError(errors)
      const patch = { name: data.name.trim(), phone: data.phone ? displayPhone(toLocalPhone(data.phone)) : '', updatedAt: nowIso() }
      await withWriter(null, (b) => {
        b.update(docRef('staff', user.id), patch)
        logActivity(b, 'staff', 'updated their profile', user)
      })
      return { ...user, ...patch }
    })
  },

  /** Records that the signed-in user finished or skipped the guided tour. */
  markTourDone() {
    return request(async (user) => {
      const at = nowIso()
      await withWriter(null, (b) => b.update(docRef('staff', user.id), { tourDoneAt: at, updatedAt: at }))
      return { tourDoneAt: at }
    })
  },

  /** Changes the signed-in user's Firebase Auth password. */
  changeOwnPassword({ current, next }) {
    return request(async () => {
      const errors = {}
      if (!current) errors.current = 'Enter your current password'
      const pw = validatePassword(next)
      if (pw) errors.next = pw
      if (Object.keys(errors).length) throw validationError(errors)
      const me = auth.currentUser
      if (!me) throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
      try {
        await reauthenticateWithCredential(me, EmailAuthProvider.credential(me.email, current))
      } catch (err) {
        if (['auth/invalid-credential', 'auth/wrong-password'].includes(err.code)) throw validationError({ current: 'Current password is incorrect' })
        if (err.code === 'auth/too-many-requests') throw new ApiError('Too many attempts. Wait a few minutes and try again.', { status: 429 })
        throw err
      }
      await updatePassword(me, next)
      return { ok: true }
    })
  },
}
