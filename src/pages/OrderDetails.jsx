import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight, Ban, CalendarDays, ClipboardList, History, Mail, MapPin, MessageSquareText, MoreHorizontal, Pencil, Phone,
  Printer, RefreshCw, Shirt, StickyNote, Truck, User, UserCog, Wallet, Zap, Clock, PackageCheck, CircleDollarSign, TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { notificationService, orderService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { useSms } from '../context/SmsContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Dropdown from '../components/ui/Dropdown'
import Avatar from '../components/ui/Avatar'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { PageSkeleton } from '../components/ui/Skeleton'
import { MethodBadge, OrderStatusBadge, OverdueBadge, PaymentStatusBadge, PriorityBadge } from '../components/shared/StatusBadges'
import { STATUS_META } from '../data/statusMeta'
import OrderProgress from '../components/orders/OrderProgress'
import { useOrderActions } from '../components/orders/useOrderActions'
import { ORDER_STAGES, SMS_TEMPLATES, stageIndex, stageLabel, pricingUnit } from '../data/constants'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, formatDateTime, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'

const TIMELINE_ICON = {
  created: [ClipboardList, 'bg-blue-50 text-blue-600'],
  status: [RefreshCw, 'bg-violet-50 text-violet-600'],
  status_reverted: [History, 'bg-amber-50 text-amber-600'],
  garment: [Shirt, 'bg-cyan-50 text-cyan-600'],
  payment: [Wallet, 'bg-emerald-50 text-emerald-600'],
  edited: [Pencil, 'bg-slate-100 text-slate-600'],
  cancelled: [Ban, 'bg-red-50 text-red-600'],
}

function GarmentStatusSelect({ item, disabled, canRevert, onChange }) {
  const current = stageIndex(item.status)
  const color = STATUS_META[item.status]?.color
  return (
    <div className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-2.5 h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      <select
        value={item.status}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Status for ${item.name}`}
        className="h-8 cursor-pointer appearance-none rounded-full border border-line bg-white pl-6 pr-7 text-xs font-semibold text-ink transition hover:border-slate-300 focus:border-brand disabled:cursor-default disabled:bg-slate-50"
      >
        {ORDER_STAGES.map((s, i) => (
          <option key={s.value} value={s.value} disabled={i < current && !canRevert}>{s.short}</option>
        ))}
      </select>
      <RefreshCw size={11} className="pointer-events-none absolute right-2.5 text-slate-400" aria-hidden />
    </div>
  )
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] text-muted">{label}</p>
        <div className="text-[13px] font-medium text-ink">{children}</div>
      </div>
    </div>
  )
}

export default function OrderDetails() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { can } = useAuth()
  const { notifySms } = useSms()
  const { data: order, loading, error, reload, setData } = useAsync(() => orderService.getOrderById(id), [id], { live: true, watch: ['orders', 'payments'] })
  const actions = useOrderActions({ onChanged: () => reload({ silent: true }) })
  const [busyItem, setBusyItem] = useState(null)
  const [advancing, setAdvancing] = useState(false)

  // Auto-open the receipt after "Save & print"
  useEffect(() => {
    if (order && params.get('print') === '1') {
      actions.open('receipt', order)
      setParams({}, { replace: true })
    }
  }, [order, params, setParams, actions])

  if (error && !order) {
    return (
      <Card>
        {error.status === 404 ? (
          <EmptyState icon={ClipboardList} title="Order not found" description={`We couldn’t find an order with ID ${id}.`} action={<Button to="/orders" variant="secondary">Back to orders</Button>} />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </Card>
    )
  }
  if (loading && !order) return <PageSkeleton />

  const cancelled = order.status === 'cancelled'
  const current = stageIndex(order.status)
  const next = !cancelled && current < ORDER_STAGES.length - 1 ? ORDER_STAGES[current + 1] : null
  const canUpdate = can('orders.updateStatus') && !cancelled

  const advance = async () => {
    setAdvancing(true)
    try {
      const res = await orderService.updateOrderStatus(order.id, next.value)
      setData((o) => ({ ...o, ...res.order }))
      toast.success(`${order.id} moved to ${next.label}`)
      notifySms(res.sms)
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setAdvancing(false)
    }
  }

  const changeGarment = async (item, status) => {
    setBusyItem(item.id)
    try {
      const res = await orderService.updateGarmentStatus(order.id, item.id, status)
      toast.success(`${item.name} → ${stageLabel(status)}`, { description: res.order.status !== order.status ? `Order is now ${stageLabel(res.order.status)}` : undefined })
      notifySms(res.sms)
      await reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusyItem(null)
    }
  }

  const sendSms = async (template) => {
    try {
      const sms = await notificationService.sendOrderSms(order.id, template)
      notifySms(sms)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const moreItems = [
    ...actions.itemsFor(order, { includeView: false }).filter((i) => !['Print receipt', 'Edit order'].includes(i.label)),
    { divider: true },
    { heading: 'Send SMS (simulated)' },
    ...Object.entries(SMS_TEMPLATES).map(([key, t]) => ({ label: t.label, icon: MessageSquareText, onClick: () => sendSms(key), hidden: cancelled })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Orders', to: '/orders' }, { label: order.id }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{order.id}</span>
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.priority !== 'normal' && <PriorityBadge priority={order.priority} />}
            {order.isOverdue && <OverdueBadge />}
          </span>
        }
        description={`${order.customer.name} · Created ${formatDateTime(order.createdAt)} by ${order.createdByName}`}
        actions={
          <>
            {can('orders.edit') && !cancelled && (order.status !== 'delivered' || can('orders.discount')) && (
              <Button variant="secondary" icon={Pencil} to={`/orders/${order.id}/edit`}>Edit</Button>
            )}
            <Button variant="secondary" icon={Printer} onClick={() => actions.open('receipt', order)}>Print receipt</Button>
            {order.balance > 0 && !cancelled && can('payments.record') && (
              <Button variant="secondary" icon={Wallet} onClick={() => actions.open('payment', order)}>Record payment</Button>
            )}
            {next && canUpdate && (
              <Button icon={STATUS_META[next.value].icon} loading={advancing} onClick={advance}>Mark as {next.short}</Button>
            )}
            <Dropdown width={230} items={moreItems} trigger={<Button variant="secondary" size="icon" icon={MoreHorizontal} aria-label="More actions" />} />
          </>
        }
      />

      {cancelled && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800" role="status">
          <Ban size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">This order was cancelled on {formatDateTime(order.cancelledAt)}.</p>
            <p>Reason: {order.cancelReason}</p>
          </div>
        </div>
      )}
      {order.isOverdue && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900" role="status">
          <TriangleAlert size={18} className="shrink-0 text-amber-600" />
          <p><strong>Overdue:</strong> this order was due {formatDateTime(order.dueAt)} ({timeAgo(order.dueAt)}). Prioritise it or update the customer.</p>
        </div>
      )}

      {!cancelled && (
        <Card>
          <CardHeader title="Order progress" description="Advance the order through the laundry workflow." icon={RefreshCw} />
          <CardBody className="pt-3">
            <OrderProgress status={order.status} stages={order.stageDetails} />
          </CardBody>
        </Card>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Garments */}
          <Card>
            <CardHeader title="Garments" description={`${order.garmentCount} items across ${order.items.length} lines — track each garment individually.`} icon={Shirt} />
            <div className="scroll-thin overflow-x-auto border-t border-line">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Garment</th>
                    <th>Service</th>
                    <th className="text-center">Qty</th>
                    <th className="text-right">Unit price</th>
                    <th className="text-right">Subtotal</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it) => (
                    <tr key={it.id} className="align-top">
                      <td className="!whitespace-normal">
                        <p className="font-semibold text-ink">{it.name}</p>
                        <p className="text-[11.5px] text-muted">{it.category}</p>
                        {it.instructions && <p className="mt-1 flex max-w-[260px] items-start gap-1 text-[11.5px] text-blue-700"><StickyNote size={12} className="mt-0.5 shrink-0" /> {it.instructions}</p>}
                        {it.condition && <p className="mt-1 flex max-w-[260px] items-start gap-1 text-[11.5px] text-amber-700"><TriangleAlert size={12} className="mt-0.5 shrink-0" /> {it.condition}</p>}
                      </td>
                      <td className="text-[13px] text-slate-600">{it.serviceName}</td>
                      <td className="text-center font-semibold tabular-nums">{it.quantity}{it.pricingModel === 'per_kg' ? ' kg' : ''}</td>
                      <td className="text-right tabular-nums text-slate-600">{formatCurrency(it.unitPrice)}<span className="text-[10.5px] text-slate-400">/{pricingUnit(it.pricingModel)}</span></td>
                      <td className="text-right font-semibold tabular-nums">{formatCurrency(it.quantity * it.unitPrice)}</td>
                      <td>
                        {canUpdate && it.status !== 'delivered' ? (
                          <span className={busyItem === it.id ? 'pointer-events-none opacity-50' : ''}>
                            <GarmentStatusSelect item={it} canRevert={can('orders.cancel')} onChange={(s) => changeGarment(it, s)} />
                          </span>
                        ) : (
                          <OrderStatusBadge status={cancelled ? 'cancelled' : it.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-muted">The overall order status follows the least-advanced garment. Moving the order forward also moves any garments behind it.</p>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title="Activity timeline" description="Every change to this order, newest first." icon={History} />
            <CardBody>
              <ol className="relative space-y-5">
                <span className="absolute bottom-2 left-4 top-2 w-px bg-line" aria-hidden />
                {order.timeline.map((ev) => {
                  const [Icon, cls] = ev.type === 'status' && ev.status === 'delivered' ? [Truck, 'bg-emerald-50 text-emerald-600'] : ev.type === 'status' && ev.status === 'ready' ? [PackageCheck, 'bg-amber-50 text-amber-600'] : TIMELINE_ICON[ev.type] ?? TIMELINE_ICON.edited
                  return (
                    <li key={ev.id} className="relative flex gap-3">
                      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-4 ring-white ${cls}`}><Icon size={14} /></span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[13px] font-semibold text-ink">{ev.message}</p>
                        {ev.note && ev.note !== 'Auto-completed' && <p className="text-xs italic text-slate-500">“{ev.note}”</p>}
                        <p className="mt-0.5 text-[11.5px] text-muted">{formatDateTime(ev.at)} · {ev.byName}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Customer */}
          <Card>
            <CardHeader title="Customer" icon={User} action={<Button variant="ghost" size="sm" to={`/customers/${order.customer.id}`} iconRight={ArrowRight}>Profile</Button>} />
            <CardBody>
              <div className="mb-2 flex items-center gap-3">
                <Avatar name={order.customer.name} size="lg" />
                <div className="min-w-0">
                  <Link to={`/customers/${order.customer.id}`} className="block truncate text-[15px] font-bold text-ink hover:text-brand">{order.customer.name}</Link>
                  <p className="font-mono text-xs text-muted">{order.customer.id}</p>
                </div>
              </div>
              <div className="divide-y divide-line">
                <InfoRow icon={Phone} label="Phone"><a href={`tel:${order.customer.phone}`} className="hover:text-brand">{displayPhone(order.customer.phone)}</a></InfoRow>
                <InfoRow icon={Mail} label="Email">{order.customer.email || <span className="text-slate-400">Not provided</span>}</InfoRow>
                <InfoRow icon={MapPin} label="Address">{order.customer.address || <span className="text-slate-400">Not provided</span>}</InfoRow>
              </div>
            </CardBody>
          </Card>

          {/* Payment summary */}
          <Card>
            <CardHeader title="Payment summary" icon={CircleDollarSign} action={<PaymentStatusBadge status={order.paymentStatus} />} />
            <CardBody className="space-y-4">
              <div className="space-y-1.5 text-[13px]">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(order.subtotal)}</span></div>
                {order.surcharge > 0 && <div className="flex justify-between text-slate-600"><span>Priority surcharge ({order.surchargeRate}%)</span><span className="tabular-nums">{formatCurrency(order.surcharge)}</span></div>}
                {order.extraCharges > 0 && <div className="flex justify-between text-slate-600"><span>Additional charges</span><span className="tabular-nums">{formatCurrency(order.extraCharges)}</span></div>}
                {order.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span className="tabular-nums">− {formatCurrency(order.discount)}</span></div>}
                {order.tax > 0 && <div className="flex justify-between text-slate-600"><span>Tax ({order.taxRate}%)</span><span className="tabular-nums">{formatCurrency(order.tax)}</span></div>}
                <div className="flex justify-between border-t border-dashed border-line pt-2 text-[15px] font-extrabold text-ink"><span>Order total</span><span className="tabular-nums">{formatCurrency(order.total)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Amount paid</span><span className="font-semibold tabular-nums">{formatCurrency(order.amountPaid)}</span></div>
                <div className={`flex justify-between ${order.balance > 0 ? 'font-bold text-red-600' : 'text-slate-500'}`}><span>Outstanding balance</span><span className="tabular-nums">{formatCurrency(order.balance)}</span></div>
              </div>
              {order.total > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round((order.amountPaid / order.total) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Amount paid">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (order.amountPaid / order.total) * 100)}%` }} />
                </div>
              )}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Payment history</p>
                {order.payments.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-xs text-muted">No payments recorded yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {order.payments.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold tabular-nums text-ink">{formatCurrency(p.amount)}</p>
                          <p className="truncate text-[11px] text-muted">{formatDateTime(p.paidAt)} · {p.recordedByName}{p.reference ? ` · ${p.reference}` : ''}</p>
                        </div>
                        <MethodBadge method={p.method} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {order.balance > 0 && !cancelled && can('payments.record') && (
                <Button className="w-full" icon={Wallet} onClick={() => actions.open('payment', order)}>Record payment</Button>
              )}
            </CardBody>
          </Card>

          {/* Order info */}
          <Card>
            <CardHeader title="Order details" icon={ClipboardList} />
            <CardBody className="divide-y divide-line pt-0">
              <InfoRow icon={CalendarDays} label="Date received">{formatDateTime(order.receivedAt)}</InfoRow>
              <InfoRow icon={Clock} label="Expected completion"><span className={order.isOverdue ? 'text-red-600' : ''}>{formatDateTime(order.dueAt)}</span></InfoRow>
              {order.pickupAt && <InfoRow icon={PackageCheck} label="Pickup">{formatDateTime(order.pickupAt)}</InfoRow>}
              {order.deliveryAt && <InfoRow icon={Truck} label="Delivery">{formatDateTime(order.deliveryAt)}</InfoRow>}
              <InfoRow icon={Zap} label="Priority"><PriorityBadge priority={order.priority} /></InfoRow>
              <InfoRow icon={UserCog} label="Assigned to">{order.assignedName}</InfoRow>
              {order.notes && <InfoRow icon={StickyNote} label="Notes">{order.notes}</InfoRow>}
              <InfoRow icon={History} label="Last updated">{formatDate(order.updatedAt)} ({timeAgo(order.updatedAt)})</InfoRow>
            </CardBody>
          </Card>
        </div>
      </div>
      {actions.modals}
    </div>
  )
}
