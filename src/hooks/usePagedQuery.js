import { useCallback, useEffect, useRef, useState } from 'react'
import { CHANGE_EVENT } from '../services'

/**
 * Server-side pagination for Firestore-backed lists.
 *
 * fetchPage({ pageSize, cursor }) must resolve to { rows, cursor, hasMore, total? }.
 * When `total` is present (search results), all matches were returned at once
 * and paging happens in the browser. Otherwise pages are fetched one at a time
 * with Firestore cursors, and `count()` (optional) supplies the total.
 *
 * Returns an object compatible with <DataTable table={...}> (same fields as
 * useTable, plus loading/error/reload). Column sorting is not available:
 * lists come back in the order the query defines (usually newest first).
 *
 * @param {Function} fetchPage
 * @param {object}   opts { key (refetch from page 1 when it changes), pageSize, count, watch: ['orders', ...] }
 */
export function usePagedQuery(fetchPage, { key = '', pageSize: initialPageSize = 20, count, watch } = {}) {
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [page, setPageState] = useState(1)
  const [state, setState] = useState({ rows: [], hasMore: false, loading: true, error: null, total: null, all: null })
  const [selected, setSelected] = useState(() => new Set())
  const cursors = useRef([null]) // cursors.current[i] = cursor to fetch page i+1
  const reqId = useRef(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const countRef = useRef(count)
  countRef.current = count

  const load = useCallback(async (targetPage, { silent = false, recount = false } = {}) => {
    const id = ++reqId.current
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetchRef.current({ pageSize, cursor: cursors.current[targetPage - 1] ?? null })
      if (id !== reqId.current) return
      if (res.total != null) {
        // Everything came back at once (search) — page locally.
        setState({ rows: [], all: res.rows, hasMore: false, loading: false, error: null, total: res.total })
      } else {
        cursors.current[targetPage] = res.cursor
        setState((s) => ({ ...s, rows: res.rows, all: null, hasMore: res.hasMore, loading: false, error: null }))
        if (recount && countRef.current) {
          countRef.current().then((total) => id === reqId.current && setState((s) => ({ ...s, total })), () => {})
        }
      }
      setPageState(targetPage)
    } catch (error) {
      if (id === reqId.current) setState((s) => ({ ...s, loading: false, error }))
    }
  }, [pageSize])

  // New filters/search/page size: start again from page 1.
  useEffect(() => {
    cursors.current = [null]
    setSelected(new Set())
    setState((s) => ({ ...s, total: null }))
    load(1, { recount: true })
  }, [key, load])

  // Refresh the current page when this app changes relevant data.
  const pageRef = useRef(page)
  pageRef.current = page
  useEffect(() => {
    if (!watch?.length) return undefined
    const onChange = (e) => {
      if (e.detail?.collections?.some((c) => watch.includes(c))) load(pageRef.current, { silent: true, recount: true })
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [watch, load])

  const local = state.all != null
  const total = local ? state.all.length : state.total ?? (page - 1) * pageSize + state.rows.length + (state.hasMore ? 1 : 0)
  const pageCount = Math.max(1, local ? Math.ceil(state.all.length / pageSize) : state.total != null ? Math.ceil(state.total / pageSize) : page + (state.hasMore ? 1 : 0))
  const pageRows = local ? state.all.slice((page - 1) * pageSize, page * pageSize) : state.rows

  const setPage = useCallback((n) => {
    if (n < 1 || n === page) return
    if (local) return setPageState(Math.min(n, pageCount))
    // Cursors only allow stepping forward one page at a time.
    if (n > page + 1 || (n > page && !state.hasMore)) return
    load(n)
  }, [page, local, pageCount, state.hasMore, load])

  const toggleRow = (id) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  const togglePage = () => setSelected((prev) => {
    const next = new Set(prev)
    pageRows.forEach((r) => (allOnPageSelected ? next.delete(r.id) : next.add(r.id)))
    return next
  })

  return {
    // DataTable / useTable-compatible fields
    pageRows,
    sorted: pageRows,
    sort: null,
    toggleSort: () => {},
    page,
    setPage,
    pageSize,
    setPageSize: (n) => setPageSizeState(n),
    pageCount,
    total,
    totalKnown: local || state.total != null,
    cursorMode: !local,
    hasMore: local ? page < pageCount : state.hasMore,
    selected,
    toggleRow,
    togglePage,
    allOnPageSelected,
    clearSelection: () => setSelected(new Set()),
    // loading state
    loading: state.loading,
    error: state.error,
    reload: () => load(page, { recount: true }),
    loaded: !state.loading || state.rows.length > 0 || state.all != null,
  }
}
