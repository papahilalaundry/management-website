import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

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
      className={`card group relative flex flex-col overflow-hidden p-5 text-left transition-all ${onClick ? 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-pop/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
            <Icon size={18} strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-2xl font-extrabold tracking-tight text-ink tabular-nums" title={String(value)}>{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {hasChange && (
          <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${good ? 'bg-emerald-50 text-emerald-700' : bad ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            <Arrow size={12} strokeWidth={2.5} aria-hidden />
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {hint && <span className="min-w-0 flex-1 truncate text-muted">{hint}</span>}
        {trend?.length > 1 && (
          <div className="pointer-events-none ml-auto h-7 w-16 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.stroke} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={1.75} fill={`url(#${gradientId})`} isAnimationActive={false} dot={false} />
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
    <div className="card flex items-center gap-3.5 p-4">
      {Icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon size={19} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-muted">{label}</p>
        <p className="truncate text-lg font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
      </div>
    </div>
  )
}
