import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Mail, MapPin, Phone, Search, UserPlus, X } from 'lucide-react'
import { customerService } from '../../services'
import { useDebounce } from '../../hooks/useDebounce'
import Avatar from '../ui/Avatar'
import { displayPhone } from '../../utils/validators'

/** Search-as-you-type customer selector. Shows a summary card once selected. */
export default function CustomerPicker({ value, onChange, onCreateNew, error, autoFocus, disabled }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState({ q: '', list: [] })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const q = useDebounce(query, 200)
  const boxRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!q.trim()) return undefined
    customerService
      .searchCustomers(q)
      .then((list) => !cancelled && setFound({ q, list }))
      .catch(() => !cancelled && setFound({ q, list: [] }))
    return () => {
      cancelled = true
    }
  }, [q])
  const results = q.trim() && found.q === q ? found.list : []
  const loading = !!query.trim() && found.q !== query

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const select = (c) => {
    onChange(c)
    setQuery('')
    setOpen(false)
  }

  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-sky-soft/60 p-3.5">
        <Avatar name={value.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{value.name} <span className="ml-1 font-mono text-[11px] font-medium text-muted">{value.id}</span></p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
            <span className="flex items-center gap-1"><Phone size={12} aria-hidden /> {displayPhone(value.phone)}</span>
            {value.email && <span className="flex items-center gap-1"><Mail size={12} aria-hidden /> {value.email}</span>}
            {value.address && <span className="flex items-center gap-1"><MapPin size={12} aria-hidden /> {value.address}</span>}
          </div>
        </div>
        {!disabled && (
          <button type="button" onClick={() => onChange(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-ink" aria-label="Change customer">
            <X size={16} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-[13px] text-slate-400" aria-hidden />
      <input
        type="search"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && results[active]) { e.preventDefault(); select(results[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
        placeholder="Search customer by name, phone or ID…"
        aria-label="Search customers"
        aria-invalid={!!error || undefined}
        className={`field-input h-11 pl-9 [&::-webkit-search-cancel-button]:hidden ${error ? 'has-error' : ''}`}
      />
      {loading && <LoaderCircle size={16} className="absolute right-3 top-[13px] animate-spin text-slate-400" aria-hidden />}
      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-12 z-30 animate-fade-in overflow-hidden rounded-xl border border-line bg-white shadow-pop" role="listbox">
          {results.length === 0 && !loading && <p className="px-4 py-4 text-sm text-muted">No customer matches “{query}”.</p>}
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {results.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => select(c)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-slate-100' : ''}`}>
                  <Avatar name={c.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                    <span className="block truncate text-xs text-muted">{displayPhone(c.phone)} · {c.id}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {onCreateNew && (
            <button type="button" onClick={() => { setOpen(false); onCreateNew(query) }} className="flex w-full items-center gap-2 border-t border-line bg-slate-50/70 px-4 py-2.5 text-[13px] font-semibold text-brand hover:bg-slate-100">
              <UserPlus size={15} /> Register “{query}” as a new customer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
