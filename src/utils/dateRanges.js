import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns'

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today', get: () => [startOfDay(new Date()), endOfDay(new Date())] },
  { value: '7d', label: 'Last 7 days', get: () => [startOfDay(subDays(new Date(), 6)), endOfDay(new Date())] },
  { value: '30d', label: 'Last 30 days', get: () => [startOfDay(subDays(new Date(), 29)), endOfDay(new Date())] },
  { value: 'month', label: 'This month', get: () => [startOfMonth(new Date()), endOfDay(new Date())] },
  { value: 'lastMonth', label: 'Last month', get: () => [startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1))] },
  { value: '90d', label: 'Last 90 days', get: () => [startOfDay(subDays(new Date(), 89)), endOfDay(new Date())] },
  { value: 'year', label: 'This year', get: () => [startOfYear(new Date()), endOfDay(new Date())] },
  { value: '12m', label: 'Last 12 months', get: () => [startOfDay(subDays(subMonths(new Date(), 12), -1)), endOfDay(new Date())] },
]

export function rangeFromPreset(preset) {
  const p = RANGE_PRESETS.find((x) => x.value === preset) ?? RANGE_PRESETS[2]
  const [from, to] = p.get()
  return { preset: p.value, from: from.toISOString(), to: to.toISOString() }
}

export function describeRange(range) {
  const preset = RANGE_PRESETS.find((p) => p.value === range.preset)
  if (preset) return preset.label
  return `${format(new Date(range.from), 'dd MMM yyyy')} – ${format(new Date(range.to), 'dd MMM yyyy')}`
}
