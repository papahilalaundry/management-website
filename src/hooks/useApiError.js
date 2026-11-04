import { useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Standard handling for failed mutations: shows a toast and returns the
 * per-field validation errors (if any) so forms can display them inline.
 */
export function useApiError() {
  return useCallback((error, fallback = 'Something went wrong. Please try again.') => {
    console.error(error)
    toast.error(error?.message || fallback)
    return error?.fields ?? {}
  }, [])
}
