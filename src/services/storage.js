/**
 * Firestore data access shared by the services layer.
 *
 * Small reference collections (settings, staff, services, inventory) are kept
 * fully in memory and live, so the services can read them synchronously with
 * db.get(name). Everything else (orders, customers, payments, ...) is queried
 * page by page with the helpers below — nothing large is loaded up front.
 *
 * Only the services/ layer should import this module.
 */
import {
  collection, doc, getAggregateFromServer, getCountFromServer, getDoc, getDocs, increment, limit,
  onSnapshot, query, runTransaction, startAfter, sum as fsSum, writeBatch,
} from 'firebase/firestore'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, firestore } from '../firebase'
import { DEFAULT_SETTINGS } from '../data/defaults'
import { ApiError } from './errors'

export { firestore }
export const CHANGE_EVENT = 'phl:db-change'

export function emit(collections) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { collections } }))
}

/* ---- references ----------------------------------------------------------- */
export const col = (name) => collection(firestore, name)
export const docRef = (name, id) => doc(firestore, name, String(id))
/**
 * Wraps a batch/transaction so we know which collections it wrote to, and
 * announce them with CHANGE_EVENT once the write succeeds (pages listening
 * with useAsync({ live }) / usePagedQuery({ watch }) then refresh).
 */
function tracked(writer, touched) {
  const wrapped = {
    get: (...a) => writer.get(...a),
    set: (r, ...rest) => { touched.add(r.parent.id); writer.set(r, ...rest); return wrapped },
    update: (r, ...rest) => { touched.add(r.parent.id); writer.update(r, ...rest); return wrapped },
    delete: (r) => { touched.add(r.parent.id); writer.delete(r); return wrapped },
  }
  return wrapped
}

export const newBatch = () => {
  const touched = new Set()
  const batch = writeBatch(firestore)
  const wrapped = tracked(batch, touched)
  wrapped.commit = async () => {
    await batch.commit()
    if (touched.size) emit([...touched])
  }
  return wrapped
}

export const transact = async (fn) => {
  const touched = new Set()
  const result = await runTransaction(firestore, (tx) => fn(tracked(tx, touched)))
  if (touched.size) emit([...touched])
  return result
}

/* ---- reference data (small, live) ----------------------------------------- */
const REF_LISTS = {
  staff: (a, b) => a.id.localeCompare(b.id),
  services: (a, b) => a.name.localeCompare(b.name),
  inventory: (a, b) => a.name.localeCompare(b.name),
}
const ref = { settings: DEFAULT_SETTINGS, staff: [], services: [], inventory: [] }

function withDefaults(settings) {
  const out = { ...DEFAULT_SETTINGS, ...settings }
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (DEFAULT_SETTINGS[k] && typeof DEFAULT_SETTINGS[k] === 'object') out[k] = { ...DEFAULT_SETTINGS[k], ...(settings?.[k] ?? {}) }
  }
  return out
}

export const db = {
  /** settings | staff | services | inventory. Treat as read-only. */
  get(name) {
    if (!(name in ref)) throw new Error(`[storage] "${name}" is not reference data — query it instead`)
    return ref[name]
  },
}

function listenDoc(path, onData) {
  return new Promise((resolve) => {
    let first = true
    const off = onSnapshot(path, (snap) => {
      onData(snap.exists() ? snap.data() : null)
      if (first) { first = false; resolve(off) }
    }, (err) => {
      console.error('[storage] listener failed', err)
      if (first) { first = false; resolve(off) }
    })
  })
}

function listenList(name) {
  return new Promise((resolve, reject) => {
    let first = true
    const off = onSnapshot(col(name), (snap) => {
      ref[name] = snap.docs.map((d) => d.data()).sort(REF_LISTS[name])
      if (first) { first = false; resolve(off) } else emit([name])
    }, (err) => {
      console.error(`[storage] listening to ${name} failed`, err)
      if (first) { first = false; reject(err) }
    })
  })
}

/* ---- session ------------------------------------------------------------- */
let session = null // { uid, staffId }
let sessionListeners = []

export const getSession = () => session

/** Loads the signed-in user's profile and the reference data. */
export async function openSession(user) {
  const profile = await getDoc(docRef('users', user.uid))
  if (!profile.exists()) throw new ApiError('This login is not linked to a staff account. Ask an administrator.', { status: 403 })
  if (profile.data().active === false) throw new ApiError('This account has been deactivated. Please contact your administrator.', { status: 403 })
  closeListeners()
  session = { uid: user.uid, staffId: profile.data().staffId }
  sessionListeners = await Promise.all(Object.keys(REF_LISTS).map(listenList))
  emit(['session', ...Object.keys(REF_LISTS)])
  return session
}

function closeListeners() {
  sessionListeners.forEach((off) => off())
  sessionListeners = []
}

export function closeSession() {
  closeListeners()
  session = null
  Object.keys(REF_LISTS).forEach((k) => (ref[k] = []))
  emit(['session'])
}

let starting = null

/**
 * Must finish before the app renders: loads settings (public) and restores a
 * signed-in session if there is one.
 */
export function initStorage() {
  if (!starting) {
    starting = (async () => {
      await listenDoc(docRef('app', 'settings'), (data) => {
        ref.settings = withDefaults(data)
        emit(['settings'])
      })
      await new Promise((resolve) => {
        let first = true
        onAuthStateChanged(auth, async (user) => {
          if (first) {
            first = false
            if (user) {
              try {
                await openSession(user)
              } catch (err) {
                console.warn('[storage] could not restore session', err)
                await signOut(auth)
              }
            }
            resolve()
          } else if (!user && session) {
            closeSession() // signed out elsewhere (other tab, account removed)
          }
        })
      })
    })()
  }
  return starting
}

/* ---- queries --------------------------------------------------------------- */
/**
 * Fetches one page. `cursor` is the opaque value returned with the previous page.
 * @returns {{ rows: object[], cursor: any, hasMore: boolean }}
 */
export async function fetchPage(q, { pageSize = 20, cursor = null } = {}) {
  const snap = await getDocs(cursor ? query(q, startAfter(cursor), limit(pageSize + 1)) : query(q, limit(pageSize + 1)))
  const docs = snap.docs.slice(0, pageSize)
  return { rows: docs.map((d) => d.data()), cursor: docs.at(-1) ?? null, hasMore: snap.docs.length > pageSize }
}

/** Reads every match up to `max` (for exports and bounded report ranges). */
export async function fetchAll(q, max = 5000) {
  const snap = await getDocs(query(q, limit(max)))
  return snap.docs.map((d) => d.data())
}

export async function fetchOne(name, id) {
  const snap = await getDoc(docRef(name, id))
  return snap.exists() ? snap.data() : null
}

export const countOf = async (q) => (await getCountFromServer(q)).data().count
export const sumOf = async (q, field) => (await getAggregateFromServer(q, { total: fsSum(field) })).data().total ?? 0

/* ---- sequential IDs ------------------------------------------------------- */
const countersRef = () => docRef('app', 'counters')

/**
 * Inside a transaction: reserves the next number for each key, e.g.
 * const { ids, commit } = await allocate(tx, { order: 1, payment: 1 })  → ids.order === 10235
 * Call before any writes in the transaction, and call commit() once writing.
 */
export async function allocate(tx, keys) {
  const snap = await tx.get(countersRef())
  const current = snap.exists() ? snap.data() : {}
  const ids = {}
  const next = {}
  for (const [k, n] of Object.entries(keys)) {
    if (!n) continue
    ids[k] = (current[k] || 0) + 1
    next[k] = (current[k] || 0) + n
  }
  return { ids, commit: () => Object.keys(next).length && tx.set(countersRef(), next, { merge: true }) }
}

/* ---- daily statistics ------------------------------------------------------ */
/** Business day in Nairobi time (UTC+3, no daylight saving), e.g. "2026-11-05". */
export const dayKey = (iso) => new Date(new Date(iso).getTime() + 3 * 36e5).toISOString().slice(0, 10)

function increments(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v === 'object') {
      const nested = increments(v)
      if (Object.keys(nested).length) out[k] = nested
    } else if (Number(v)) out[k] = increment(Number(v))
  }
  return out
}

/**
 * Adds to the counters of the business day containing `iso`. Fields: orders,
 * cancelled, billed, kg, garments, newCustomers, revenue, payments,
 * revenueByMethod{}, expenses, expenseByCategory{}. Works with a transaction or batch.
 */
export function bumpStats(writer, iso, fields) {
  const inc = increments(fields)
  if (!Object.keys(inc).length) return
  writer.set(docRef('stats', dayKey(iso)), { date: dayKey(iso), ...inc }, { merge: true })
}
