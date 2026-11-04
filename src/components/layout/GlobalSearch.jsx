import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, LoaderCircle, Search, User } from 'lucide-react'
import { CHANGE_EVENT, customerService, orderService } from '../../services'
import { useDebounce } from '../../hooks/useDebounce'
import { OrderStatusBadge } from '../shared/StatusBadges'
import { displayPhone } from '../../utils/validators'

/** Searches orders (ID, customer, phone, garment) and customers. Shortcut: Ctrl/⌘+K or "/". */
export default function GlobalSearch({ className = '', autoFocus = false, inline = false, onNavigate }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(null) // { orders, customers }
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const boxRef = useRef(null)
  const q = useDebounce(query.trim().toLowerCase(), 150)

  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    // Drop the cached index whenever orders/customers change so results stay fresh
    const onData = (e) => e.detail?.collections?.some((c) => c === 'orders' || c === 'customers') && setIndex(null)
    window.addEventListener(CHANGE_EVENT, onData)
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onData)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [])

  const ensureIndex = async () => {
    setOpen(true)
    if (index || loading) return
    setLoading(true)
    try {
      const [orders, customers] = await Promise.all([orderService.getOrders(), customerService.getCustomers()])
      setIndex({ orders, customers })
    } finally {
      setLoading(false)
    }
  }

  const results = useMemo(() => {
    if (!q || !index) return []
    const compact = q.replace(/\s/g, '')
    const orders = index.orders
      .filter((o) => o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(compact) || o.items.some((i) => i.name.toLowerCase().includes(q)))
      .slice(0, 5)
      .map((o) => ({ type: 'order', id: o.id, to: `/orders/${o.id}`, title: o.id, subtitle: `${o.customer.name} · ${o.items.length} line(s)`, status: o.status }))
    const customers = index.customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(compact) || c.id.toLowerCase().includes(q))
      .slice(0, 4)
      .map((c) => ({ type: 'customer', id: c.id, to: `/customers/${c.id}`, title: c.name, subtitle: `${c.id} · ${displayPhone(c.phone)}` }))
    return [...orders, ...customers]
  }, [q, index])

  const go = (r) => {
    navigate(r.to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
    onNavigate?.()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      go(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={ensureIndex}
          autoFocus={autoFocus}
          enterKeyHint="search"
          onKeyDown={onKeyDown}
          placeholder="Search orders, customers, phone…"
          aria-label="Search orders and customers"
          role="combobox"
          aria-expanded={open && !!q}
          aria-controls="global-search-results"
          className="h-11 w-full rounded-lg border border-line bg-slate-50/80 pl-9 pr-14 text-base outline-none sm:h-10 sm:text-sm transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 lg:block">Ctrl K</kbd>
      </div>

      {inline && !q && (
        <p className="px-2 pt-8 text-center text-[13px] text-muted">Search by order number, customer name, phone number or garment.</p>
      )}
      {open && q && (
        <div id="global-search-results" role="listbox" className={inline ? 'mt-3 animate-fade-in overflow-hidden rounded-xl border border-line bg-white' : 'absolute left-0 right-0 top-12 z-40 animate-fade-in overflow-hidden rounded-xl border border-line bg-white shadow-pop'}>
          {loading || !index ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
              <LoaderCircle size={16} className="animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted">No orders or customers match “{query}”.</div>
          ) : (
            <ul className={inline ? 'p-1.5' : 'max-h-96 overflow-y-auto p-1.5'}>
              {results.map((r, i) => (
                <li key={`${r.type}-${r.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left sm:py-2 ${i === active ? 'bg-slate-100' : ''}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.type === 'order' ? 'bg-sky-soft text-brand' : 'bg-emerald-50 text-emerald-600'}`}>
                      {r.type === 'order' ? <ClipboardList size={15} /> : <User size={15} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                    </span>
                    {r.status && <OrderStatusBadge status={r.status} size="sm" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
