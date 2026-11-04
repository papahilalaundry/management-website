import { Banknote, Smartphone } from 'lucide-react'

const OPTIONS = [
  { value: 'mpesa', label: 'M-Pesa', sub: 'Mobile money', icon: Smartphone, active: 'border-emerald-500 bg-emerald-50/60 ring-emerald-500/20', iconCls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cash', label: 'Cash', sub: 'Paid at counter', icon: Banknote, active: 'border-brand bg-sky-soft/70 ring-brand/20', iconCls: 'bg-blue-100 text-blue-700' },
]

export default function MethodToggle({ value, onChange, error }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5">
      {OPTIONS.map((o) => {
        const selected = value === o.value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? `${o.active} ring-4` : `${error ? 'border-red-300' : 'border-line'} bg-white hover:border-slate-300`}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${o.iconCls}`}>
              <Icon size={17} aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">{o.label}</span>
              <span className="block text-[11px] text-muted">{o.sub}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
