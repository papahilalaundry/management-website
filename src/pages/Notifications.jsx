import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Eye, EyeOff, MessageSquareText, Trash2, MoreHorizontal, BellOff } from 'lucide-react'
import { toast } from 'sonner'
import { notificationService } from '../services'
import { useNotifications } from '../context/NotificationContext'
import { useSms } from '../context/SmsContext'
import { useAsync } from '../hooks/useAsync'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import { Select } from '../components/ui/Field'
import Dropdown from '../components/ui/Dropdown'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { NotificationIcon } from '../components/shared/NotificationIcon'
import { NOTIFICATION_CATEGORIES } from '../data/constants'
import { formatDateTime, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'

export default function Notifications() {
  const navigate = useNavigate()
  const { notifications, unread, loading, markRead, markAllRead, reload } = useNotifications()
  const { showSms } = useSms()
  const [view, setView] = useState('all')
  const [category, setCategory] = useState('')
  const sms = useAsync(() => notificationService.getSmsLog(), [], { live: true, watch: ['smsLog'] })

  const filtered = useMemo(() => notifications.filter((n) => (view !== 'unread' || !n.read) && (!category || n.category === category)), [notifications, view, category])

  const remove = async (n) => {
    try {
      await notificationService.deleteNotification(n.id)
      toast.success('Notification deleted')
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }
  const clearRead = async () => {
    await notificationService.clearRead()
    toast.success('Read notifications cleared')
    reload({ silent: true })
  }
  const open = (n) => {
    if (!n.read) markRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unread} unread · order, payment, stock and staff alerts.`}
        actions={view !== 'sms' && (
          <>
            <Button variant="secondary" icon={Trash2} onClick={clearRead} disabled={!notifications.some((n) => n.read)}>Clear read</Button>
            <Button icon={CheckCheck} onClick={async () => { await markAllRead(); toast.success('All notifications marked as read') }} disabled={!unread}>Mark all as read</Button>
          </>
        )}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs variant="pills" className="w-fit" value={view} onChange={setView} tabs={[
          { value: 'all', label: 'All', count: notifications.length },
          { value: 'unread', label: 'Unread', count: unread },
          { value: 'sms', label: 'SMS log (demo)', icon: MessageSquareText, count: sms.data?.length ?? 0 },
        ]} />
        {view !== 'sms' && <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={NOTIFICATION_CATEGORIES} className="sm:w-56" />}
      </div>

      {view === 'sms' ? (
        <Card>
          <div className="border-b border-line bg-amber-50 px-5 py-3 text-[13px] text-amber-800">
            <strong>DEMO / SIMULATED:</strong> these messages were generated from templates but never sent. No SMS provider is connected.
          </div>
          {sms.loading && !sms.data ? <Skeleton className="m-5 h-40" /> : !sms.data?.length ? (
            <EmptyState icon={MessageSquareText} title="No simulated SMS yet" description="Create an order, record a payment or mark an order ready to see customer messages here." />
          ) : (
            <ul className="divide-y divide-line">
              {sms.data.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => showSms(m)} className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><MessageSquareText size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-bold text-ink">{m.customerName}</p>
                        <span className="text-xs text-muted">{displayPhone(m.to)}</span>
                        <Badge tone="slate" size="sm">{m.templateLabel}</Badge>
                        <Badge tone="amber" size="sm">Simulated</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-slate-600">{m.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(m.sentAt)} · {m.orderId} · by {m.sentByName}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          {loading && !notifications.length ? (
            <div className="space-y-4 p-5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={view === 'unread' ? BellOff : Bell} title={view === 'unread' ? 'You’re all caught up' : 'No notifications'} description={view === 'unread' ? 'There are no unread notifications.' : 'Nothing matches this filter.'} />
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((n) => (
                <li key={n.id} className={`group flex items-start gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5 ${n.read ? '' : 'bg-sky-soft/40'}`}>
                  <button type="button" onClick={() => open(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    <NotificationIcon category={n.category} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-[13.5px] ${n.read ? 'font-semibold text-slate-700' : 'font-bold text-ink'}`}>{n.title}</p>
                        {!n.read && <span className="h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}
                        <Badge tone="slate" size="sm">{NOTIFICATION_CATEGORIES.find((c) => c.value === n.category)?.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-[13px] text-slate-600">{n.message}</p>
                      <p className="mt-1 text-[11px] text-slate-400" title={formatDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                  <Dropdown
                    items={[
                      { label: n.read ? 'Mark as unread' : 'Mark as read', icon: n.read ? EyeOff : Eye, onClick: () => markRead(n.id, !n.read) },
                      { label: 'Delete', icon: Trash2, danger: true, onClick: () => remove(n) },
                    ]}
                    trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-ink" aria-label={`Actions for ${n.title}`}><MoreHorizontal size={18} /></button>}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
