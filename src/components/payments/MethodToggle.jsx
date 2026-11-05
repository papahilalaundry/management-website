import { Banknote, Building2, Smartphone } from 'lucide-react'

/** The three ways customers pay: Paybill, an M-Pesa phone number, or cash. */
const OPTIONS = [
  { value: 'paybill', label: 'Paybill', sub: 'M-Pesa Paybill', icon: Building2, active: 'border-emerald-500 bg-emerald-50/60 ring-emerald-500/20', iconCls: 'bg-emerald-100 text-emerald-700' },
  { value: 'mpesa_number', label: 'M-Pesa number', sub: 'Sent to our phone', icon: Smartphone, active: 'border-teal-500 bg-teal-50/60 ring-teal-500/20', iconCls: 'bg-teal-100 text-teal-700' },
  { value: 'cash', label: 'Cash', sub: 'Paid at counter', icon: Banknote, active: 'border-brand bg-sky-soft/70 ring-brand/20', iconCls: 'bg-blue-100 text-blue-700' },
]

export default function MethodToggle({ value, onChange, error }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
