/**
 * Recharts wrappers with one consistent visual system:
 * thin marks, recessive grid/axes, crosshair tooltips, legend + direct labels,
 * a single y-axis (never dual-axis). All data comes from reportService.
 */
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { SERIES } from './chartTheme'
import AnimatedValue from '../ui/AnimatedValue'
import { BarChart3 } from 'lucide-react'
import { formatCompactCurrency, formatCurrency, formatNumber } from '../../utils/formatCurrency'

const AXIS = { fontSize: 11, fill: '#64748b' }
const GRID = '#eef1f6'

function TooltipCard({ active, payload, label, money, labelKey, unit = '' }) {
  if (!active || !payload?.length) return null
  const title = labelKey ? payload[0]?.payload?.[labelKey] : label
  return (
    <div className="min-w-[160px] rounded-lg border border-line bg-white px-3 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink">{title}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} aria-hidden />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-ink">{money ? formatCurrency(p.value, { decimals: 0 }) : `${formatNumber(p.value, unit && !Number.isInteger(p.value) ? 1 : 0)}${unit ? ` ${unit}` : ''}`}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={`inline-block ${i.line ? 'h-0.5 w-3.5 rounded-full' : 'h-2.5 w-2.5 rounded-sm'}`} style={{ background: i.color }} aria-hidden />
          <span className="font-medium text-slate-600">{i.label}</span>
          {i.value != null && <span className="font-semibold tabular-nums text-ink">{i.value}</span>}
        </li>
      ))}
    </ul>
  )
}

/** Shown in place of a chart when every value is zero. */
export function ChartEmpty({ height = 220, title = 'No data yet', description = 'This chart fills in as orders and payments are recorded.' }) {
  return (
    <div style={{ height }} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-slate-50/60 px-6 text-center">
      <BarChart3 size={22} className="text-slate-300" aria-hidden />
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      <p className="max-w-xs text-xs text-muted">{description}</p>
    </div>
  )
}

const allZero = (data, keys) => !data.length || data.every((d) => keys.every((k) => !Number(d[k])))

/** Direct label at the final point of a line (identity never by colour alone). */
const endLabel = (text, color, count) =>
  function EndLabel({ x, y, index }) {
    if (index !== count - 1) return null
    return (
      <text x={x + 6} y={y} dy={4} fontSize={11} fontWeight={600} fill="#475569">
        <tspan fill={color}>●</tspan> {text}
      </text>
    )
  }

/** Revenue vs expenses over time (same unit → one axis). */
export function RevenueExpenseChart({ data, height = 300, xKey = 'short' }) {
  if (allZero(data, ['revenue', 'expenses'])) return <ChartEmpty height={height} description="Revenue and expenses appear here once payments or expenses are recorded." />
  const n = data.length
  return (
    <div style={{ height }} role="img" aria-label="Line chart of revenue and expenses over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 64, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={76} tickFormatter={(v) => formatCompactCurrency(v)} />
          <Tooltip content={<TooltipCard money labelKey="label" />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke={SERIES.revenue.color} strokeWidth={2} dot={false} animationDuration={900} animationEasing="ease-out" activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} label={endLabel('Revenue', SERIES.revenue.color, n)} />
          <Line type="monotone" dataKey="expenses" name="Expenses" stroke={SERIES.expenses.color} strokeWidth={2} dot={false} animationDuration={900} animationEasing="ease-out" activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} label={endLabel('Expenses', SERIES.expenses.color, n)} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Single-series bar chart (orders or kg per day/week/month). `unit` (e.g. 'kg') allows decimals and labels the tooltip. */
export function VolumeBarChart({ data, dataKey = 'orders', name = 'Orders', height = 260, xKey = 'short', money = false, color = SERIES.orders.color, unit = '' }) {
  if (allZero(data, [dataKey])) return <ChartEmpty height={height} description={`${name} appear here once orders are recorded for this period.`} />
  return (
    <div style={{ height }} role="img" aria-label={`Bar chart of ${name.toLowerCase()} over time`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={10} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={!!unit} width={money ? 76 : 40} tickFormatter={money ? (v) => formatCompactCurrency(v) : undefined} />
          <Tooltip content={<TooltipCard money={money} labelKey="label" unit={unit} />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Donut with a labelled legend (counts + %), so identity and value never
 * depend on colour alone. data: [{ label, count, color }]
 */
export function DonutChart({ data, total, centerLabel = 'Total', height = 220, valueFormatter = formatNumber, emptyText = 'Nothing to show yet.' }) {
  const sum = total ?? data.reduce((s, d) => s + d.count, 0)
  if (!sum) return <ChartEmpty height={height} description={emptyText} />
  const visible = data.filter((d) => d.count > 0)
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div className="relative shrink-0" style={{ width: height, height }} role="img" aria-label={`Donut chart: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={visible.length ? visible : [{ label: 'None', count: 1, color: '#e2e8f0' }]} dataKey="count" nameKey="label" innerRadius="66%" outerRadius="96%" paddingAngle={visible.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} animationDuration={800} animationEasing="ease-out">
              {(visible.length ? visible : [{ color: '#e2e8f0' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {visible.length > 0 && <Tooltip content={<TooltipCard />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold tabular-nums text-ink"><AnimatedValue value={valueFormatter(sum)} /></span>
          <span className="text-[11px] font-medium text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2 sm:w-auto">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} aria-hidden />
            <span className="flex-1 text-slate-600">{d.label}</span>
            <span className="font-semibold tabular-nums text-ink">{valueFormatter(d.count)}</span>
            <span className="w-11 text-right text-xs tabular-nums text-muted">{sum ? Math.round((d.count / sum) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Horizontal magnitude bars in HTML (single hue). rows: [{ label, value, sub? }] */
export function BarList({ rows, format = formatNumber, color = '#2563eb', emptyText = 'No data for this period.' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-slate-700">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {format(r.value)}
              {r.sub && <span className="ml-1.5 text-xs font-normal text-muted">{r.sub}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className="h-full origin-left animate-grow-x rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

