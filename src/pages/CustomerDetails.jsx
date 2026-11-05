import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, CalendarDays, ClipboardList, HandCoins, Mail, MapPin, MessageSquareQuote, Pencil, Phone, Plus, Receipt, Repeat, StickyNote, Wallet, Clock, Send, Footprints } from 'lucide-react'
import { toast } from 'sonner'
import { customerService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import Tabs from '../components/ui/Tabs'
import Badge from '../components/ui/Badge'
import { Textarea } from '../components/ui/Field'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { PageSkeleton } from '../components/ui/Skeleton'
import { MiniStat } from '../components/shared/StatCard'
import ActivityFeed from '../components/shared/ActivityFeed'
import { ClientTypeBadge, MethodBadge, RatingBadge } from '../components/shared/StatusBadges'
import OrderTable from '../components/orders/OrderTable'
import { useOrderActions } from '../components/orders/useOrderActions'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import RecordPaymentModal from '../components/payments/RecordPaymentModal'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, formatDateTime, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'
import { daysSince } from '../utils/calculations'

const intervalLabel = (days) => (days == null ? '—' : days < 1 ? 'Same day' : `~${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`)
const dayGap = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5)

/** Visit history, newest first, with the days since the previous visit. */
function VisitHistory({ visits }) {
  if (!visits.length) return <EmptyState compact icon={Footprints} title="No visits yet" description="Visits are counted from this client's orders." />
  const rows = visits.map((at, i) => ({ at, gap: i > 0 ? dayGap(visits[i - 1], at) : null })).reverse()
  return (
    <ol className="divide-y divide-line">
      {rows.map((v, i) => (
        <li key={`${v.at}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
          <span className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-soft text-[11px] font-bold text-brand">{rows.length - i}</span>
            <span>
              <span className="font-semibold text-ink">{formatDate(v.at)}</span>
              <span className="ml-2 text-xs text-muted">{timeAgo(v.at)}</span>
            </span>
          </span>
          <span className="text-xs text-muted">{v.gap == null ? 'First visit' : `${v.gap} day${v.gap === 1 ? '' : 's'} after previous`}</span>
        </li>
      ))}
    </ol>
  )
}

export default function CustomerDetails() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: c, loading, error, reload, setData } = useAsync(() => customerService.getCustomerById(id), [id], { live: true, watch: ['customers', 'orders', 'payments'] })
  const [tab, setTab] = useState('orders')
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const actions = useOrderActions({ onChanged: () => reload({ silent: true }) })

  if (error && !c) {
    return <Card>{error.status === 404 ? <EmptyState title="Customer not found" description={`No customer with ID ${id}.`} action={<Button to="/customers" variant="secondary">Back to customers</Button>} /> : <ErrorState error={error} onRetry={reload} />}</Card>
  }
  if (loading && !c) return <PageSkeleton />

  const addNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return setNoteError('Write a note first')
    setSavingNote(true)
    try {
      const n = await customerService.addCustomerNote(c.id, note)
      setData((d) => ({ ...d, notes: [n, ...d.notes] }))
      setNote('')
      toast.success('Note added')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingNote(false)
    }
  }

  const activeOrders = c.orders.filter((o) => o.isOpen).length
  const sinceLast = daysSince(c.lastOrderAt)
  const tabs = [
    { value: 'orders', label: 'Orders', icon: ClipboardList, count: c.orders.length },
    { value: 'payments', label: 'Payments', icon: Wallet, count: c.payments.length },
    { value: 'visits', label: 'Visits', icon: Footprints, count: c.visits.length },
    { value: 'feedback', label: 'Feedback', icon: MessageSquareQuote, count: c.feedback.length },
    { value: 'activity', label: 'Activity', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Customers', to: '/customers' }, { label: c.name }]}
        mobileTitle
        title={c.name}
        description={`${c.id} · Customer since ${formatDate(c.createdAt)}`}
        actions={
          <>
            {can('customers.edit') && <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
            {c.outstanding > 0 && can('payments.record') && <Button variant="secondary" icon={Wallet} onClick={() => setPaying(true)}>Record payment</Button>}
            {can('orders.create') && <Button icon={Plus} to={`/orders/new?customer=${c.id}`}>New order</Button>}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody className="pt-6 text-center">
              <Avatar name={c.name} size="xl" className="mx-auto" />
              <h2 className="mt-3 text-lg font-extrabold text-ink">{c.name}</h2>
              <p className="text-xs text-muted">Registered by {c.createdByName}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ClientTypeBadge type={c.clientType} />
                {activeOrders > 0 && <Badge tone="blue" dot>{activeOrders} active order{activeOrders > 1 ? 's' : ''}</Badge>}
                {c.outstanding > 0 ? <Badge tone="red">Owes {formatCurrency(c.outstanding, { decimals: 0 })}</Badge> : <Badge tone="green">All paid</Badge>}
              </div>
              <div className="mt-5 space-y-3 border-t border-line pt-4 text-left text-[13px]">
                <p className="flex items-center gap-3"><Phone size={15} className="text-slate-400" /><a href={`tel:${c.phone}`} className="font-medium hover:text-brand">{displayPhone(c.phone)}</a></p>
                <p className="flex items-center gap-3"><Mail size={15} className="text-slate-400" />{c.email ? <a href={`mailto:${c.email}`} className="truncate font-medium hover:text-brand">{c.email}</a> : <span className="text-slate-400">No email</span>}</p>
                <p className="flex items-start gap-3"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />{c.address || <span className="text-slate-400">No address</span>}</p>
                <p className="flex items-center gap-3"><CalendarDays size={15} className="text-slate-400" />Customer since {formatDate(c.createdAt)}</p>
                <p className="flex items-center gap-3"><Footprints size={15} className="text-slate-400" />{c.firstOrderAt ? `First visit ${formatDate(c.firstOrderAt)}` : 'No visits yet'}</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes & comments" icon={StickyNote} description="Preferences, comments and important details" />
            <CardBody className="space-y-3">
              {can('customers.edit') && (
                <form onSubmit={addNote} className="space-y-2">
                  <Textarea rows={2} value={note} onChange={(e) => { setNote(e.target.value); setNoteError('') }} placeholder="Add a note about this customer…" aria-label="New note" error={!!noteError} />
                  {noteError && <p className="text-xs text-red-600">{noteError}</p>}
                  <Button type="submit" size="sm" icon={Send} loading={savingNote} className="w-full">Add note</Button>
                </form>
              )}
              {c.notes.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {c.notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                      <p className="text-[13px] text-ink">{n.text}</p>
                      <p className="mt-1 text-[11px] text-muted">{n.byName} · {timeAgo(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Client statistics">
            <MiniStat label="Visits" value={formatNumber(c.orderCount ?? 0)} icon={ClipboardList} tone="blue" sub={c.clientType === 'regular' ? 'Regular client' : 'New client'} />
            <MiniStat label="Brings laundry every" value={intervalLabel(c.avgIntervalDays)} icon={Repeat} tone="violet" sub={c.avgIntervalDays == null ? 'Needs two or more visits' : 'Average gap between drop-offs'} />
            <MiniStat label="Last visit" value={c.lastOrderAt ? formatDate(c.lastOrderAt) : 'Never'} icon={Clock} tone="cyan" sub={sinceLast == null ? undefined : sinceLast === 0 ? 'Today' : `${sinceLast} day${sinceLast === 1 ? '' : 's'} ago`} />
            <MiniStat label="Total billed" value={formatCurrency(c.totalBilled ?? 0, { decimals: 0 })} icon={Receipt} tone="slate" />
            <MiniStat label="Total paid" value={formatCurrency(c.totalSpent ?? 0, { decimals: 0 })} icon={Wallet} tone="green" />
            <MiniStat label="Outstanding" value={formatCurrency(c.outstanding ?? 0, { decimals: 0 })} icon={HandCoins} tone={c.outstanding > 0 ? 'red' : 'slate'} />
          </section>

          <Card>
            <div className="px-4 pt-2">
              <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Customer history" className="border-b-0" />
            </div>
            <div className="border-t border-line">
              {tab === 'orders' && c.hasMoreOrders && (
                <p className="border-b border-line bg-slate-50/70 px-4 py-2 text-xs text-muted">
                  Showing the latest {c.orders.length} orders. <Link to={`/orders?customer=${c.id}`} className="font-semibold text-brand hover:underline">View all orders</Link>
                </p>
              )}
              {tab === 'orders' && (
                <OrderTable
                  rows={c.orders}
                  hideCustomer
                  actions={(o) => actions.itemsFor(o)}
                  empty={<EmptyState compact icon={ClipboardList} title="No orders yet" action={can('orders.create') && <Button size="sm" icon={Plus} to={`/orders/new?customer=${c.id}`}>Create order</Button>} />}
                />
              )}
              {tab === 'payments' && (
                c.payments.length === 0 ? (
                  <EmptyState compact icon={Wallet} title="No payments recorded" />
                ) : (
                  <div className="scroll-thin overflow-x-auto">
                    <table className="table-base">
                      <thead><tr><th>Transaction</th><th>Order</th><th>Date paid</th><th>Mode</th><th>Paid by</th><th className="text-right">Estimated</th><th className="text-right">Paid</th><th>M-Pesa code</th><th>Recorded by</th></tr></thead>
                      <tbody>
                        {c.payments.map((p) => {
                          const short = p.expectedAmount != null && p.amount < p.expectedAmount
                          return (
                            <tr key={p.id}>
                              <td className="font-mono text-xs font-semibold">{p.id}</td>
                              <td><Link to={`/orders/${p.orderId}`} className="font-mono text-xs font-semibold text-brand hover:underline">{p.orderId}</Link></td>
                              <td className="text-slate-600">{formatDateTime(p.paidAt)}</td>
                              <td><MethodBadge method={p.method} /></td>
                              <td className="text-slate-600">{p.payerName || '—'}</td>
                              <td className="text-right tabular-nums text-slate-500">{p.expectedAmount != null ? formatCurrency(p.expectedAmount) : '—'}</td>
                              <td className={`text-right font-semibold tabular-nums ${short ? 'text-amber-700' : ''}`}>{formatCurrency(p.amount)}</td>
                              <td className="font-mono text-xs text-slate-500">{p.reference || '—'}{p.accountNumber && <span className="block text-[11px] text-slate-400">Acc {p.accountNumber}</span>}</td>
                              <td className="text-slate-600">{p.recordedByName}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              {tab === 'visits' && <VisitHistory visits={c.visits} />}
              {tab === 'feedback' && (
                c.feedback.length === 0 ? (
                  <EmptyState compact icon={MessageSquareQuote} title="No feedback yet" description="Client comments and ratings recorded on their orders appear here." />
                ) : (
                  <ul className="divide-y divide-line">
                    {[...c.feedback].sort((a, b) => b.at.localeCompare(a.at)).map((f) => (
                      <li key={`${f.orderId}-${f.at}`} className="space-y-1.5 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <RatingBadge rating={f.rating} size="sm" />
                          <Link to={`/orders/${f.orderId}`} className="font-mono text-xs font-semibold text-brand hover:underline">{f.orderId}</Link>
                          <span className="text-[11px] text-muted">{formatDate(f.at)} · recorded by {f.byName}</span>
                        </div>
                        {f.comment ? <p className="text-[13px] text-ink">“{f.comment}”</p> : <p className="text-[13px] text-muted">Rating only, no comment.</p>}
                      </li>
                    ))}
                  </ul>
                )
              )}
              {tab === 'activity' && (
                <div className="p-5">
                  <ActivityFeed items={c.activities} emptyText="No recent activity for this customer." />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <CustomerFormModal open={editing} customer={c} onClose={() => setEditing(false)} onSaved={() => reload({ silent: true })} />
      <RecordPaymentModal open={paying} customer={c} onClose={() => setPaying(false)} onRecorded={() => reload({ silent: true })} />
      {actions.modals}
    </div>
  )
}
