import { useSyncExternalStore } from 'react'

/** Live boolean for a CSS media query, e.g. useMediaQuery('(max-width: 1023px)'). */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Below Tailwind's `lg` breakpoint: phones and tablets use the app-style layout. */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px)')
