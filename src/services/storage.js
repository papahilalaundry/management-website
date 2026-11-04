/**
 * Centralised localStorage persistence for the mock backend.
 *
 * Each collection is stored under its own key so a mutation only re-writes
 * the collection that changed. Only the services/ layer should import this
 * module — UI components talk to the services, never to storage directly.
 */
import { generateSeedData, SEED_VERSION } from '../data/mockData'

const PREFIX = 'phl:'
const COLLECTIONS = [
  'settings', 'staff', 'services', 'customers', 'orders', 'payments', 'expenses',
  'inventory', 'stockMovements', 'notifications', 'activities', 'smsLog', 'meta',
]
export const CHANGE_EVENT = 'phl:db-change'

let cache = null

function readKey(name) {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeKey(name, value) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify(value))
  } catch (err) {
    // Quota exceeded or private mode: keep working in-memory for this session.
    console.warn(`[storage] Could not persist "${name}"`, err)
  }
}

function seed() {
  const data = generateSeedData(new Date())
  COLLECTIONS.forEach((name) => writeKey(name, data[name]))
  return data
}

function load() {
  if (cache) return cache
  const meta = readKey('meta')
  if (!meta || meta.seedVersion !== SEED_VERSION) {
    cache = seed()
    return cache
  }
  const data = {}
  for (const name of COLLECTIONS) {
    const value = readKey(name)
    if (value === undefined) {
      cache = seed() // partially missing / corrupt — start fresh
      return cache
    }
    data[name] = value
  }
  cache = data
  return cache
}

function emit(collections) {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { collections } }))
}

export const db = {
  /** Returns the live collection. Treat as read-only; use set()/update() to change it. */
  get(name) {
    return load()[name]
  },
  set(name, value) {
    load()[name] = value
    writeKey(name, value)
    emit([name])
    return value
  },
  update(name, updater) {
    return this.set(name, updater(load()[name]))
  },
  /** Increments and returns a persistent counter (for sequential IDs). */
  nextCounter(key) {
    const meta = load().meta
    meta.counters[key] = (meta.counters[key] || 0) + 1
    this.set('meta', { ...meta })
    return meta.counters[key]
  },
}

export function resetDemoData() {
  COLLECTIONS.forEach((name) => localStorage.removeItem(PREFIX + name))
  cache = seed()
  emit(COLLECTIONS)
}

/* ---- Session (mock auth) ------------------------------------------------ */
const SESSION_KEY = `${PREFIX}session`

export function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? JSON.parse(sessionStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function writeSession(session, remember = true) {
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(SESSION_KEY)
  if (session) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session))
}
