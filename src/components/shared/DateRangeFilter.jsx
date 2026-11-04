import { useState } from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { endOfDay, format, startOfDay } from 'date-fns'
import { describeRange, RANGE_PRESETS, rangeFromPreset } from '../../utils/dateRanges'
import Dropdown from '../ui/Dropdown'
import Button from '../ui/Button'

/** value: { preset, from, to } (ISO strings). preset 'custom' for manual dates. */
export default function DateRangeFilter({ value, onChange, align = 'end' }) {
  const [custom, setCustom] = useState({ from: format(new Date(value.from), 'yyyy-MM-dd'), to: format(new Date(value.to), 'yyyy-MM-dd') })
  const [error, setError] = useState('')

  const applyCustom = () => {
    if (!custom.from || !custom.to) return setError('Choose both dates')
    if (custom.to < custom.from) return setError('End date is before start date')
    setError('')
    onChange({ preset: 'custom', from: startOfDay(new Date(custom.from)).toISOString(), to: endOfDay(new Date(custom.to)).toISOString() })
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  }

  return (
    <Dropdown
      align={align}
      width={260}
      trigger={
        <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink shadow-card transition hover:border-slate-300">
          <CalendarDays size={16} className="text-slate-400" aria-hidden />
          <span className="max-w-[190px] truncate">{describeRange(value)}</span>
          <ChevronDown size={15} className="text-slate-400" aria-hidden />
        </button>
      }
      items={RANGE_PRESETS.map((p) => ({ label: p.label, onClick: () => onChange(rangeFromPreset(p.value)) }))}
    >
      <div className="mb-1 border-b border-line px-2.5 pb-3 pt-1.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Custom range</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" aria-label="From date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="field-input h-8 px-2 text-xs" />
          <input type="date" aria-label="To date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="field-input h-8 px-2 text-xs" />
        </div>
        {error && <p className="mt-1.5 text-[11px] font-medium text-red-600">{error}</p>}
        <Button size="xs" className="mt-2 w-full" onClick={applyCustom}>Apply range</Button>
      </div>
    </Dropdown>
  )
}
