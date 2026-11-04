/**
 * Human-readable sequential IDs (e.g. PHL-10234, CUS-0021).
 * Counters live in the mock DB "meta" collection so they survive refreshes.
 */
export function formatId(prefix, n, pad = 4) {
  return `${prefix}-${String(n).padStart(pad, '0')}`
}

/** Short random id for nested records (garments, notes, history entries). */
export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
}

export function randomMpesaRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'
  let s = 'S'
  for (let i = 0; i < 9; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
