import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Accessible dropdown menu rendered in a portal (so it isn't clipped by
 * scrolling table containers).
 *
 * items: [{ label, icon, onClick, to?, danger?, disabled?, hidden? } | { divider: true } | { heading }]
 */
export default function Dropdown({ trigger, items, align = 'end', width = 210, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const menuH = menuRef.current?.offsetHeight ?? 200
    const below = r.bottom + 6 + menuH < window.innerHeight
    const left = align === 'end' ? Math.max(8, r.right - width) : Math.min(r.left, window.innerWidth - width - 8)
    setPos({ left, top: below ? r.bottom + 6 : Math.max(8, r.top - menuH - 6) })
  }, [align, width])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? [])]
        const idx = nodes.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? nodes[(idx + 1) % nodes.length] : nodes[(idx - 1 + nodes.length) % nodes.length]
        next?.focus()
      }
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    const t = setTimeout(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus(), 10)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const visible = (items ?? []).filter((i) => !i.hidden)

  return (
    <>
      {cloneElement(trigger, {
        ref: triggerRef,
        onClick: (e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width }}
            className="no-print fixed z-[60] animate-fade-in rounded-xl border border-line bg-white p-1.5 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            {visible.map((item, i) => {
              if (item.divider) return <div key={`d${i}`} className="my-1 h-px bg-line" />
              if (item.heading) return <div key={`h${i}`} className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{item.heading}</div>
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false)
                    item.onClick?.()
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${item.danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'}`}
                >
                  {Icon && <Icon size={15} className={item.danger ? 'text-red-500' : 'text-slate-400'} aria-hidden />}
                  {item.label}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
