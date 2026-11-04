import { Link } from 'react-router-dom'
import { Boxes, ClipboardList, Pencil, ReceiptText, Settings, Shirt, UserCog, UserPlus, Wallet, Ban, LogIn, StickyNote, RefreshCw } from 'lucide-react'
import { timeAgo, formatDateTime } from '../../utils/formatDate'
import { Skeleton } from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

const ICONS = {
  order_created: [ClipboardList, 'bg-blue-50 text-blue-600'],
  order_status: [RefreshCw, 'bg-violet-50 text-violet-600'],
  order_edited: [Pencil, 'bg-slate-100 text-slate-600'],
  order_cancelled: [Ban, 'bg-red-50 text-red-600'],
  payment: [Wallet, 'bg-emerald-50 text-emerald-600'],
  expense: [ReceiptText, 'bg-amber-50 text-amber-600'],
  inventory: [Boxes, 'bg-cyan-50 text-cyan-600'],
  customer_created: [UserPlus, 'bg-pink-50 text-pink-600'],
  customer_updated: [Pencil, 'bg-slate-100 text-slate-600'],
  customer_note: [StickyNote, 'bg-amber-50 text-amber-600'],
  staff: [UserCog, 'bg-indigo-50 text-indigo-600'],
  service: [Shirt, 'bg-sky-50 text-sky-600'],
  settings: [Settings, 'bg-slate-100 text-slate-600'],
  auth: [LogIn, 'bg-slate-100 text-slate-600'],
}

function linkFor(a) {
  if (a.orderId) return `/orders/${a.orderId}`
  if (a.customerId) return `/customers/${a.customerId}`
  if (a.itemId) return `/inventory?item=${a.itemId}`
  return null
}

/** items: [{ id, type, message, at, byName }] */
export default function ActivityFeed({ items, loading, showActor = true, limit, emptyText = 'No recent activity.' }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-2.5 w-1/3" /></div>
          </div>
        ))}
      </div>
    )
  }
  const list = limit ? (items ?? []).slice(0, limit) : items ?? []
  if (!list.length) return <EmptyState compact title={emptyText} />
  return (
    <ol className="relative space-y-4">
      <span className="absolute bottom-2 left-4 top-2 w-px bg-line" aria-hidden />
      {list.map((a) => {
        const [Icon, cls] = ICONS[a.type] ?? ICONS.settings
        const to = linkFor(a)
        const text = (
          <>
            {showActor && <span className="font-semibold text-ink">{a.byName ?? 'System'} </span>}
            <span className="text-slate-600">{a.message}</span>
          </>
        )
        return (
          <li key={a.id} className="relative flex gap-3">
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-4 ring-white ${cls}`}>
              <Icon size={14} aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] leading-snug">{to ? <Link to={to} className="hover:underline">{text}</Link> : text}</p>
              <p className="mt-0.5 text-[11px] text-slate-400" title={formatDateTime(a.at)}>{timeAgo(a.at)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
