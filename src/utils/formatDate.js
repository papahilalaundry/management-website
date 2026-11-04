import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

let dateFormat = 'dd MMM yyyy'

/** Called by the settings provider when the user's preference changes. */
export function setDateFormatPreference(fmt) {
  if (fmt) dateFormat = fmt
}

export const DATE_FORMAT_OPTIONS = [
  { value: 'dd MMM yyyy', label: '04 Nov 2026' },
  { value: 'dd/MM/yyyy', label: '04/11/2026' },
  { value: 'yyyy-MM-dd', label: '2026-11-04' },
  { value: 'MMM d, yyyy', label: 'Nov 4, 2026' },
]

export function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

export function formatDate(value, fallback = '—') {
  const d = toDate(value)
  return d ? format(d, dateFormat) : fallback
}

export function formatDateTime(value, fallback = '—') {
  const d = toDate(value)
  return d ? `${format(d, dateFormat)}, ${format(d, 'h:mm a')}` : fallback
}

export function formatTime(value, fallback = '—') {
  const d = toDate(value)
  return d ? format(d, 'h:mm a') : fallback
}

export function timeAgo(value) {
  const d = toDate(value)
  if (!d) return '—'
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  return `${formatDistanceToNowStrict(d)} ago`
}

/** Value suitable for <input type="date"> */
export function toInputDate(value) {
  const d = toDate(value)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

export function toInputDateTime(value) {
  const d = toDate(value)
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : ''
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
