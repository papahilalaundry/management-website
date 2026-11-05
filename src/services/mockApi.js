/**
 * Request wrapper used by every service: checks the signed-in user and their
 * role permission, then runs the Firestore work and normalises errors.
 * (The security rules in backend/firestore.rules enforce access on the server.)
 */
import { db, getSession } from './storage'
import { can } from '../utils/permissions'
import { ApiError, toApiError } from './errors'

export { ApiError, validationError, notFound } from './errors'

export function currentUser() {
  const session = getSession()
  if (!session) return null
  const user = db.get('staff').find((s) => s.id === session.staffId)
  return user && user.status === 'active' ? user : null
}

/**
 * @param {Function} handler  async (user) => result
 * @param {object}   options  { permission, auth = true }
 */
export async function request(handler, { permission, auth = true } = {}) {
  const user = auth ? currentUser() : null
  if (auth && !user) throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
  if (permission && !can(user, permission)) {
    throw new ApiError('You do not have permission to perform this action.', { status: 403 })
  }
  try {
    return await handler(user)
  } catch (err) {
    throw toApiError(err)
  }
}
