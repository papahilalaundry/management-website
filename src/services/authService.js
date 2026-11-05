/**
 * Sign-in with Firebase Authentication. Staff type only their username; the
 * login email is username@papahilalaundry.com behind the scenes.
 * Each Auth user is linked to a staff record through users/{uid}.
 */
import { browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { closeSession, docRef, openSession } from './storage'
import { currentUser } from './mockApi'
import { ApiError, toApiError, validationError } from './errors'
import { logActivity, nowIso, withWriter } from './helpers'
import { normalizeUsername, usernameToEmail } from '../data/constants'

export const authErrorMessage = (err) => {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'The username or password you entered is incorrect.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact your administrator.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a few minutes and try again.'
    case 'auth/network-request-failed':
      return 'Cannot reach the server. Check your internet connection.'
    default:
      return null
  }
}

export const authService = {
  /** @param {{ username, password, remember }} credentials */
  async login({ username, password, remember = true }) {
    const errors = {}
    if (!normalizeUsername(username)) errors.username = 'Username is required'
    if (!password) errors.password = 'Password is required'
    if (Object.keys(errors).length) throw validationError(errors)
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      const cred = await signInWithEmailAndPassword(auth, usernameToEmail(username), password)
      try {
        await openSession(cred.user)
      } catch (err) {
        await signOut(auth)
        throw err
      }
      const user = currentUser()
      if (!user) {
        await authService.logout()
        throw new ApiError('This account has been deactivated. Please contact your administrator.', { status: 403 })
      }
      await withWriter(null, (b) => {
        b.update(docRef('staff', user.id), { lastActiveAt: nowIso() })
        logActivity(b, 'auth', 'signed in', user)
      }).catch((e) => console.warn('[auth] could not record sign-in', e))
      return { ...user }
    } catch (err) {
      const msg = authErrorMessage(err)
      throw msg ? new ApiError(msg, { status: 401 }) : toApiError(err)
    }
  },

  async logout() {
    closeSession()
    await signOut(auth)
  },

  /** The signed-in staff member (restored before the app renders), or null. */
  restoreSession() {
    const user = currentUser()
    return user ? { ...user } : null
  },
}
