/** Error shape every service throws, so the UI can show messages and per-field errors. */
export class ApiError extends Error {
  constructor(message, { status = 400, fields = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields // { fieldName: message } for validation errors
  }
}

export function validationError(fields, message = 'Please correct the highlighted fields.') {
  return new ApiError(message, { status: 422, fields })
}

export function notFound(what) {
  return new ApiError(`${what} not found.`, { status: 404 })
}

/** Turns Firebase errors into friendly ApiErrors. */
export function toApiError(err) {
  if (err instanceof ApiError) return err
  const code = err?.code ?? ''
  if (code === 'permission-denied') return new ApiError('You do not have permission to do this, or your session has ended. Try signing in again.', { status: 403 })
  if (code === 'unavailable' || code === 'deadline-exceeded') return new ApiError('Cannot reach the database. Check your internet connection and try again.', { status: 503 })
  if (code === 'failed-precondition' && /index/i.test(err.message)) {
    console.error('[firestore] Missing index:', err.message)
    return new ApiError('This view needs a database index that is still being built. Please try again in a few minutes.', { status: 503 })
  }
  if (code === 'aborted') return new ApiError('Someone else changed this record at the same time. Please try again.', { status: 409 })
  console.error(err)
  return new ApiError(err?.message || 'Something went wrong. Please try again.', { status: 500 })
}
