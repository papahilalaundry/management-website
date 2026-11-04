import { useMemo, useState } from 'react'

/**
 * Client-side sort + pagination + selection for tables.
 * @param {Array} rows   already-filtered rows
 * @param {object} opts  { pageSize, initialSort: { key, dir }, getSortValue: (row, key) => any, resetKey }
 */
export function useTable(rows = [], { pageSize: initialPageSize = 10, initialSort = null, getSortValue, resetKey } = {}) {
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState(() => new Set())

  // Go back to page 1 whenever filters change. (Adjusting state during render
  // is the React-recommended alternative to an effect for derived resets.)
  const [lastReset, setLastReset] = useState(resetKey)
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    setPage(1)
    setSelected(new Set())
  }

  const sorted = useMemo(() => {
    if (!sort) return rows
    const value = (r) => (getSortValue ? getSortValue(r, sort.key) : r[sort.key])
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, getSortValue])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)

  const pageRows = useMemo(() => sorted.slice((safePage - 1) * pageSize, safePage * pageSize), [sorted, safePage, pageSize])

  const toggleSort = (key) =>
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }))

  const toggleRow = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      pageRows.forEach((r) => (allOnPageSelected ? next.delete(r.id) : next.add(r.id)))
      return next
    })

  return {
    sorted, pageRows, sort, setSort, toggleSort,
    page: safePage, setPage, pageSize, setPageSize: (n) => { setPageSize(n); setPage(1) }, pageCount, total: sorted.length,
    selected, toggleRow, togglePage, allOnPageSelected, clearSelection: () => setSelected(new Set()),
  }
}
