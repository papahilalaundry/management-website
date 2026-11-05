/**
 * Firebase connection for the Papa Hila website.
 *
 * These values identify the Firebase project; they are not secrets (every
 * Firebase web app ships them to the browser). Access to the data is
 * controlled by Firebase Authentication plus the Firestore security rules in
 * backend/firestore.rules.
 */
import { deleteApp, initializeApp } from 'firebase/app'
import { getAuth, inMemoryPersistence, initializeAuth, setPersistence } from 'firebase/auth'
import { initializeFirestore, memoryLocalCache, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: 'AIzaSyAiwVYN3I6N26KZjlkH7dSrfhBYB3wSELs',
  authDomain: 'management-system-49171.firebaseapp.com',
  projectId: 'management-system-49171',
  storageBucket: 'management-system-49171.firebasestorage.app',
  messagingSenderId: '555014040887',
  appId: '1:555014040887:web:673879352665da4618feb2',
  measurementId: 'G-GF4TE8H774',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)

// In the browser, keep a copy of fetched data in IndexedDB so pages open fast
// and keep working offline (changes sync when the connection returns).
const canPersist = typeof window !== 'undefined' && typeof indexedDB !== 'undefined'

export const firestore = initializeFirestore(firebaseApp, {
  localCache: canPersist ? persistentLocalCache({ tabManager: persistentMultipleTabManager() }) : memoryLocalCache(),
  ignoreUndefinedProperties: true,
})

/**
 * Runs `fn(auth)` against a temporary, separate Firebase app. Used by admins to
 * create other staff accounts: creating a user with the client SDK signs in as
 * that user, and doing it on a throwaway app keeps the admin signed in.
 */
export async function withSecondaryAuth(fn) {
  const app = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  try {
    const secondary = initializeAuth(app, { persistence: inMemoryPersistence })
    await setPersistence(secondary, inMemoryPersistence)
    return await fn(secondary)
  } finally {
    await deleteApp(app)
  }
}
