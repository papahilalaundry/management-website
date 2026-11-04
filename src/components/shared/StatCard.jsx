import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import AnimatedValue from '../ui/AnimatedValue'

const TONES = {
  blue: { icon: 'bg-blue-50 text-blue-600', stroke: '#2563eb' },
  navy: { icon: 'bg-navy-50 text-navy-800', stroke: '#20375b' },
  amber: { icon: 'bg-amber-50 text-amber-600', stroke: '#d97706' },
  violet: { icon: 'bg-violet-50 text-violet-600', stroke: '#7c3aed' },
  green: { icon: 'bg-emerald-50 text-emerald-600', stroke: '#059669' },
  red: { icon: 'bg-red-50 text-red-600', stroke: '#dc2626' },
  cyan: { icon: 'bg-cyan-50 text-cyan-600', stroke: '#0891b2' },
  slate: { icon: 'bg-slate-100 text-slate-600', stroke: '#475569' },
}

/**
 * KPI card. `change` is a % vs previous period; `inverse` flips the colour
 * logic for metrics where going down is good (expenses, outstanding).
 */
export default function StatCard({ label, value, icon: Icon, tone = 'blue', change, inverse = false, trend, hint, onClick }) {
  const t = TONES[tone] ?? TONES.blue
  const hasChange = change != null && Number.isFinite(change)
  const up = hasChange && change > 0.05
  const down = hasChange && change < -0.05
  const good = inverse ? down : up
  const bad = inverse ? up : down
  const Arrow = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  const Tag = onClick ? 'button' : 'div'
  const gradientId = `spark-${label.replace(/\W/g, '')}`

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card group relative flex flex-col overflow-hidden p-3.5 text-left transition-all active:scale-[0.98] sm:p-5 sm:active:scale-100 ${onClick ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-pop/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold leading-snug text-muted sm:text-[13px]">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${t.icon}`}>
            <Icon size={17} strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[19px] font-extrabold tracking-tight text-ink tabular-nums sm:text-2xl" title={String(value)}><AnimatedValue value={value} /></p>
      <div className="mt-auto flex items-center gap-2 pt-2 text-xs">
        {hasChange && (
          <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            <Arrow size={12} strokeWidth={2.5} aria-hidden />
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {hint && <span className="hidden min-w-0 flex-1 truncate text-muted sm:inline">{hint}</span>}
        {trend?.length > 1 && (
          <div className="pointer-events-none ml-auto hidden h-7 w-16 shrink-0 sm:block" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.stroke} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={1.75} fill={`url(#${gradientId})`} animationDuration={900} animationEasing="ease-out" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Tag>
  )
}

/** Simple, compact stat for secondary pages (no sparkline). */
export function MiniStat({ label, value, icon: Icon, tone = 'blue', sub }) {
  const t = TONES[tone] ?? TONES.blue
  return (
    <div className="card flex flex-col items-start gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-3.5 sm:p-4">
      {Icon && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${t.icon}`}>
          <Icon size={18} aria-hidden />
        </span>
      )}
      <div className="w-full min-w-0">
        <p className="truncate text-xs font-semibold text-muted">{label}</p>
        <p className="truncate text-lg font-extrabold tracking-tight text-ink tabular-nums"><AnimatedValue value={value} /></p>
        {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  )
}
