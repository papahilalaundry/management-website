import { useCountUp } from '../../hooks/useCountUp'

// One number, with optional thousands separators and decimals.
const NUMBER = /-?\d[\d,]*(?:\.\d+)?/g

/**
 * Counts up the number inside an already-formatted value, keeping its
 * prefix/suffix and formatting: "KES 230,263", "28.7%", "141".
 *
 * Values with no number or several numbers ("Never", "31 Oct 2026",
 * "86% / 14%") are shown as-is. Screen readers always get the final value.
 */
export default function AnimatedValue({ value, duration }) {
  const text = typeof value === 'number' || typeof value === 'string' ? String(value) : null
  const matches = text?.match(NUMBER)
  const single = matches?.length === 1 ? matches[0] : null
  const target = single ? Number(single.replace(/,/g, '')) : null
  const shown = useCountUp(target, duration)

  if (single == null) return value

  const decimals = single.split('.')[1]?.length ?? 0
  const formatted = shown.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: single.includes(','),
  })
  const at = text.indexOf(single)
  // `relative` keeps the absolutely-positioned screen-reader copy inside this
  // span, so scrolling containers (e.g. swipeable stat strips) clip it instead
  // of it widening the whole page.
  return (
    <span className="relative">
      <span aria-hidden="true">{text.slice(0, at)}{formatted}{text.slice(at + single.length)}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}
