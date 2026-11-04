import { useCallback, useEffect, useRef, useState } from 'react'
import { CHANGE_EVENT } from '../services'

/**
 * Runs an async loader and tracks { data, loading, error }.
 * With `live: true` it silently refetches whenever the mock DB changes
 * (e.g. so the notification badge updates after recording a payment).
 */
export function useAsync(loader, deps = [], { live = false, watch } = {}) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null })
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const reqId = useRef(0)

  const run = useCallback(async ({ silent = false } = {}) => {
    const id = ++reqId.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await loaderRef.current()
      if (id === reqId.current) setState({ data, loading: false, error: null })
      return data
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ data: silent ? s.data : undefined, loading: false, error }))
      return undefined
    }
  }, [])

  useEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (!live) return undefined
    const onChange = (e) => {
      if (!watch || e.detail?.collections?.some((c) => watch.includes(c))) run({ silent: true })
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [live, run, watch])

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), [])

  return { ...state, reload: run, setData }
}
