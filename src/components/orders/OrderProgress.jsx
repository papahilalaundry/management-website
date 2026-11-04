import { Check } from 'lucide-react'
import { ORDER_STAGES, stageIndex } from '../../data/constants'
import { STATUS_META } from '../../data/statusMeta'
import { formatDate, formatTime } from '../../utils/formatDate'

/** Workflow tracker: horizontal on desktop, vertical on mobile. */
export default function OrderProgress({ status, stages }) {
  const current = stageIndex(status)
  return (
    <ol className="grid gap-0 md:grid-cols-6" aria-label="Order progress">
      {ORDER_STAGES.map((s, i) => {
        const info = stages?.[s.value]
        const done = info && i <= current
        const isCurrent = i === current
        const Icon = STATUS_META[s.value].icon
        const color = STATUS_META[s.value].color
        return (
          <li key={s.value} className="relative flex gap-3 pb-5 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center" aria-current={isCurrent ? 'step' : undefined}>
            {/* connector */}
            {i < ORDER_STAGES.length - 1 && (
              <>
                <span className={`absolute left-[17px] top-9 h-[calc(100%-36px)] w-0.5 md:hidden ${i < current ? 'bg-emerald-400' : 'bg-line'}`} aria-hidden />
                <span className={`absolute left-[calc(50%+22px)] right-[calc(-50%+22px)] top-[17px] hidden h-0.5 md:block ${i < current ? 'bg-emerald-400' : 'bg-line'}`} aria-hidden />
              </>
            )}
            <span
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white transition ${done && !isCurrent ? 'bg-emerald-500 text-white' : isCurrent ? 'text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
              style={isCurrent ? { background: color, boxShadow: `0 0 0 4px #fff, 0 0 0 7px ${color}33` } : undefined}
            >
              {done && !isCurrent ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
            </span>
            <div className="min-w-0 pt-1 md:pt-0">
              <p className={`text-[13px] font-bold ${done ? 'text-ink' : 'text-slate-400'}`}>{s.label}</p>
              {info ? (
                <>
                  <p className="text-[11.5px] text-muted">{formatDate(info.at)}, {formatTime(info.at)}</p>
                  <p className="text-[11px] text-slate-400">by {info.byName}</p>
                  {info.note && info.note !== 'Auto-completed' && <p className="mt-0.5 text-[11px] italic text-slate-500">“{info.note}”</p>}
                </>
              ) : (
                <p className="text-[11.5px] text-slate-400">Pending</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
