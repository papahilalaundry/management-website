/**
 * ⚠️ SIMULATED AUTHENTICATION — FOR DEMO/DEVELOPMENT ONLY.
 *
 * Credentials are checked against plain-text passwords in localStorage and the
 * "session" is just a user id stored in the browser. This provides NO real
 * security. Before production, replace this module with a backend that:
 *   - hashes passwords (bcrypt/argon2) and never sends them to the client,
 *   - issues httpOnly, secure session cookies or short-lived JWTs,
 *   - enforces role permissions on every API endpoint,
 *   - rate-limits login attempts.
 */
import { db, readSession, writeSession } from './storage'
import { request, ApiError, validationError, currentUser } from './mockApi'
import { logActivity, nowIso } from './helpers'
import { isValidEmail } from '../utils/validators'

const toPublic = ({ password, ...rest }) => rest // eslint-disable-line no-unused-vars

export const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@papahila.com', password: 'Admin123!' },
  { role: 'Manager', email: 'manager@papahila.com', password: 'Manager123!' },
  { role: 'Staff', email: 'staff@papahila.com', password: 'Staff123!' },
]

export const authService = {
  login({ email, password, remember }) {
    return request(() => {
      const errors = {}
      if (!email?.trim()) errors.email = 'Email is required'
      else if (!isValidEmail(email)) errors.email = 'Enter a valid email address'
      if (!password) errors.password = 'Password is required'
      if (Object.keys(errors).length) throw validationError(errors)

      const user = db.get('staff').find((s) => s.email.toLowerCase() === email.trim().toLowerCase())
      if (!user || user.password !== password) throw new ApiError('The email or password you entered is incorrect.', { status: 401 })
      if (user.status !== 'active') throw new ApiError('This account has been deactivated. Please contact your administrator.', { status: 403 })

      writeSession({ userId: user.id, issuedAt: nowIso() }, remember)
      db.update('staff', (list) => list.map((s) => (s.id === user.id ? { ...s, lastActiveAt: nowIso() } : s)))
      logActivity('auth', 'signed in', user)
      return toPublic(user)
    }, { auth: false, latency: [600, 1000] })
  },

  logout() {
    writeSession(null)
    return Promise.resolve()
  },

  /** Synchronous session restore on page load. */
  restoreSession() {
    if (!readSession()) return null
    const user = currentUser()
    if (!user) {
      writeSession(null)
      return null
    }
    return toPublic(user)
  },
}
