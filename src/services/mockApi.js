/**
 * Simulated HTTP layer.
 *
 * `request()` wraps every mock endpoint so it behaves like a network call:
 * it is async, has latency, can fail, enforces auth/permissions and returns
 * deep copies (so UI code can never mutate the "database" by accident).
 *
 * To connect a real backend, replace the body of each service function with
 * a fetch/axios call (see README) — the UI only depends on the function
 * signatures and the ApiError shape.
 */
import { db, readSession } from './storage'
import { can } from '../utils/permissions'

export class ApiError extends Error {
  constructor(message, { status = 400, fields = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields // { fieldName: message } for validation errors
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function currentUser() {
  const session = readSession()
  if (!session) return null
  const user = db.get('staff').find((s) => s.id === session.userId)
  return user && user.status === 'active' ? user : null
}

/**
 * @param {Function} handler  (user) => result
 * @param {object}   options  { permission, latency: [min,max], auth }
 */
export async function request(handler, { permission, latency = [180, 420], auth = true } = {}) {
  const system = db.get('settings')?.system ?? {}
  if (system.latency !== false) await sleep(latency[0] + Math.random() * (latency[1] - latency[0]))
  if (system.simulateErrors && Math.random() < 0.12) {
    throw new ApiError('Network error: the server did not respond. Please try again.', { status: 503 })
  }
  const user = auth ? currentUser() : null
  if (auth && !user) throw new ApiError('Your session has expired. Please sign in again.', { status: 401 })
  if (permission && !can(user, permission)) {
    throw new ApiError('You do not have permission to perform this action.', { status: 403 })
  }
  const result = await handler(user)
  return result === undefined ? result : structuredClone(result)
}

export function validationError(fields, message = 'Please correct the highlighted fields.') {
  return new ApiError(message, { status: 422, fields })
}

export function notFound(what) {
  return new ApiError(`${what} not found.`, { status: 404 })
}
