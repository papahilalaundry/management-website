import { useRef } from 'react'

/**
 * tabs: [{ value, label, icon?, count? }]
 * variant: 'underline' | 'pills'
 */
export default function Tabs({ tabs, value, onChange, variant = 'underline', className = '', ariaLabel = 'Tabs' }) {
  const ref = useRef(null)
  const onKeyDown = (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return
    const idx = tabs.findIndex((t) => t.value === value)
    const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
    onChange(next.value)
    ref.current?.querySelector(`[data-value="${next.value}"]`)?.focus()
  }
  const pills = variant === 'pills'
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`scroll-thin flex gap-1 overflow-x-auto ${pills ? 'rounded-xl bg-slate-100/80 p-1' : 'border-b border-line'} ${className}`}
    >
      {tabs.map((t) => {
        const active = t.value === value
        const Icon = t.icon
        return (
          <button
            key={t.value}
            data-value={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={
              pills
                ? `flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all ${active ? 'bg-white text-ink shadow-card' : 'text-slate-500 hover:text-ink'}`
                : `-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-ink'}`
            }
          >
            {Icon && <Icon size={15} aria-hidden />}
            {t.label}
            {t.count != null && (
              <span className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${active ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'}`}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
