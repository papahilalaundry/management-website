import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animates a number towards `target`: from 0 on first show, then from the
 * previous value whenever the target changes (e.g. after a live refresh).
 * Returns the in-between value to render. Pass null to skip animating.
 */
export function useCountUp(target, duration = 900) {
  const [display, setDisplay] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (target == null || !Number.isFinite(target)) return undefined
    const from = current.current
    if (from === target) return undefined
    const length = prefersReducedMotion() ? 0 : duration
    let frame
    let start
    const tick = (now) => {
      start ??= now
      const t = length ? Math.min(1, (now - start) / length) : 1
      const eased = 1 - (1 - t) ** 3 // ease-out cubic: fast start, gentle landing
      const value = t === 1 ? target : from + (target - from) * eased
      current.current = value
      setDisplay(value)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return display
}
