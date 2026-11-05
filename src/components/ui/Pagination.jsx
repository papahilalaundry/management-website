import { ChevronLeft, ChevronRight } from 'lucide-react'

function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = new Set([1, count, page, page - 1, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= count - 2) [count - 1, count - 2, count - 3].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push('…' + p)
    out.push(p)
  })
  return out
}

/**
 * cursorMode: pages come from the server one at a time (Firestore cursors), so
 * only Previous/Next are offered; hasMore enables Next. totalKnown=false shows
 * "Page N" instead of a total while the count is still loading.
 */
export default function Pagination({ page, pageCount, total, pageSize, onPageChange, onPageSizeChange, pageSizes = [10, 20, 50], cursorMode = false, hasMore, totalKnown = true }) {
  if (!total) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span>
          Showing <strong className="font-semibold text-ink">{from}–{to}</strong>{totalKnown && <> of <strong className="font-semibold text-ink">{total.toLocaleString()}</strong></>}
        </span>
        {onPageSizeChange && (
          <label className="hidden items-center gap-1.5 sm:flex">
            <span>Rows</span>
            <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="h-7 cursor-pointer rounded-md border border-line bg-white px-1.5 text-xs font-medium text-ink">
              {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent" aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        {cursorMode ? (
          <span className="px-2 text-xs font-semibold text-slate-600">Page {page}{totalKnown ? ` of ${pageCount}` : ''}</span>
        ) : pageList(page, pageCount).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="px-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition ${p === page ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={cursorMode ? !hasMore : page >= pageCount} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent" aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  )
}
