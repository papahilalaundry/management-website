import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CircleDollarSign, ClipboardList, Clock, HandCoins, Hourglass, PackageCheck, PackageX, Plus, ReceiptText,
  Shirt, TrendingUp, TriangleAlert, Truck, WashingMachine, Wallet, Activity, Store, CalendarDays,
} from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../context/AuthContext'
import { reportService, activityService } from '../services'
import { useAsync } from '../hooks/useAsync'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import Avatar from '../components/ui/Avatar'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { Skeleton, StatCardSkeleton } from '../components/ui/Skeleton'
import StatCard from '../components/shared/StatCard'
import DateRangeFilter from '../components/shared/DateRangeFilter'
import { describeRange, rangeFromPreset } from '../utils/dateRanges'
import ActivityFeed from '../components/shared/ActivityFeed'
import { OrderStatusBadge, StockBadge } from '../components/shared/StatusBadges'
import { STATUS_META } from '../data/statusMeta'
import OrderTable from '../components/orders/OrderTable'
import { BarList, DonutChart, Legend, RevenueExpenseChart, VolumeBarChart } from '../components/charts/Charts'
import { SERIES } from '../components/charts/chartTheme'
import { formatCompactCurrency, formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, formatTime, greeting, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'

const PERIOD_TABS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
]
const WATCH = ['orders', 'payments', 'expenses', 'inventory', 'customers']

function ChartCard({ title, description, icon, period, onPeriod, children, legend }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title={title} description={description} icon={icon} action={onPeriod && <Tabs variant="pills" tabs={PERIOD_TABS} value={period} onChange={onPeriod} ariaLabel={`${title} period`} />} />
      {legend && <div className="px-5 pb-2">{legend}</div>}
      <CardBody className="flex-1">{children}</CardBody>
    </Card>
  )
}

function ScheduleList({ items }) {
  if (!items.length) return <EmptyState compact icon={CalendarDays} title="Nothing scheduled today" description="No pickups, deliveries or collections are due today." />
  const META = {
    delivery: { icon: Truck, label: 'Delivery', cls: 'bg-emerald-50 text-emerald-600' },
    pickup: { icon: PackageCheck, label: 'Pickup', cls: 'bg-pink-50 text-pink-600' },
    collection: { icon: Store, label: 'Collection', cls: 'bg-amber-50 text-amber-600' },
  }
  return (
    <ul className="divide-y divide-line">
      {items.map(({ type, at, order }) => {
        const m = META[type]
        return (
          <li key={`${type}-${order.id}`}>
            <Link to={`/orders/${order.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${m.cls}`}><m.icon size={16} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{order.customer.name}</p>
                <p className="truncate text-xs text-muted">{m.label} · {order.id} · {formatTime(at)}</p>
              </div>
              <OrderStatusBadge status={order.status} size="sm" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function Dashboard() {
  const { user, can } = useAuth()
  const finance = can('finance.view')
  const [range, setRange] = useState(() => rangeFromPreset('30d'))
  const [revPeriod, setRevPeriod] = useState('30d')
  const [volPeriod, setVolPeriod] = useState('7d')

  const dash = useAsync(() => reportService.getDashboard(range), [range.from, range.to], { live: true, watch: WATCH })
  const rev = useAsync(() => reportService.getRevenueAnalytics(revPeriod), [revPeriod], { live: true, watch: WATCH })
  const vol = useAsync(() => reportService.getRevenueAnalytics(volPeriod), [volPeriod], { live: true, watch: WATCH })
  const acts = useAsync(() => activityService.getActivities({ limit: 12 }), [], { live: true, watch: ['activities'] })

  const d = dash.data
  const s = d?.stats
  const rangeLabel = describeRange(range).toLowerCase()
  const totals = useMemo(() => {
    if (!rev.data) return null
    const revenue = rev.data.reduce((a, r) => a + (r.revenue || 0), 0)
    const expenses = rev.data.reduce((a, r) => a + (r.expenses || 0), 0)
    return { revenue, expenses }
  }, [rev.data])

  const firstName = user.name.split(' ')[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        mobileTitle
        description={
          d
            ? `${format(new Date(), 'EEEE, d MMMM yyyy')} · ${d.overdue.length ? `${d.overdue.length} overdue order${d.overdue.length > 1 ? 's need' : ' needs'} attention, ` : ''}${d.schedule.length} scheduled for today.`
            : `${format(new Date(), 'EEEE, d MMMM yyyy')} · Here’s what’s happening at Papa Hila today.`
        }
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            {can('orders.create') && <span className="hidden lg:block"><Button to="/orders/new" icon={Plus}>Create New Order</Button></span>}
          </>
        }
      />

      {dash.error && !d ? (
        <Card><ErrorState error={dash.error} onRetry={dash.reload} /></Card>
      ) : (
        <>
          {/* KPI cards */}
          <section aria-label="Key statistics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {!s ? (
              Array.from({ length: finance ? 8 : 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard label="Total Orders" value={formatNumber(s.totalOrders.value)} icon={ClipboardList} tone="blue" change={s.totalOrders.change} trend={s.totalOrders.trend} hint={`vs previous ${rangeLabel.replace('last ', '')}`} />
                <StatCard label="Pending Orders" value={formatNumber(s.pending.value)} icon={Hourglass} tone="amber" change={s.pending.change} inverse trend={s.pending.trend} hint="Received, not started" />
                <StatCard label="In Progress" value={formatNumber(s.inProgress.value)} icon={WashingMachine} tone="violet" change={s.inProgress.change} trend={s.inProgress.trend} hint="Washing · drying · ironing" />
                <StatCard label="Completed" value={formatNumber(s.completed.value)} icon={PackageCheck} tone="green" change={s.completed.change} trend={s.completed.trend} hint="Ready or delivered" />
                {finance && (
                  <>
                    <StatCard label="Total Revenue" value={formatCurrency(s.revenue.value, { decimals: 0 })} icon={Wallet} tone="navy" change={s.revenue.change} trend={s.revenue.trend} hint="Payments received" />
                    <StatCard label="Outstanding Payments" value={formatCurrency(s.outstanding.value, { decimals: 0 })} icon={HandCoins} tone="red" change={s.outstanding.change} inverse trend={s.outstanding.trend} hint="Unpaid on these orders" />
                    <StatCard label="Total Expenses" value={formatCurrency(s.expenses.value, { decimals: 0 })} icon={ReceiptText} tone="amber" change={s.expenses.change} inverse trend={s.expenses.trend} hint="Recorded expenses" />
                    <StatCard label="Net Profit" value={formatCurrency(s.netProfit.value, { decimals: 0 })} icon={TrendingUp} tone={s.netProfit.value >= 0 ? 'green' : 'red'} change={s.netProfit.change} trend={s.netProfit.trend} hint="Revenue − expenses" />
                  </>
                )}
              </>
            )}
          </section>

          {/* Charts */}
          <section className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {finance ? (
                <ChartCard
                  title="Revenue overview"
                  description="Payments received vs. expenses recorded"
                  icon={CircleDollarSign}
                  period={revPeriod}
                  onPeriod={setRevPeriod}
                  legend={
                    <Legend
                      items={[
                        { label: 'Revenue', color: SERIES.revenue.color, line: true, value: totals ? formatCompactCurrency(totals.revenue) : '—' },
                        { label: 'Expenses', color: SERIES.expenses.color, line: true, value: totals ? formatCompactCurrency(totals.expenses) : '—' },
                      ]}
                    />
                  }
                >
                  {rev.loading && !rev.data ? <Skeleton className="h-[300px] w-full" /> : <RevenueExpenseChart data={rev.data ?? []} />}
                </ChartCard>
              ) : (
                <ChartCard title="Orders overview" description="Orders received over time" icon={ClipboardList} period={volPeriod} onPeriod={setVolPeriod}>
                  {vol.loading && !vol.data ? <Skeleton className="h-[300px] w-full" /> : <VolumeBarChart data={vol.data ?? []} height={300} />}
                </ChartCard>
              )}
            </div>
            <Card>
              <CardHeader title="Order status" description={`Orders received · ${rangeLabel}`} icon={Activity} />
              <CardBody>
                {!d ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <DonutChart data={d.statusDistribution.map((x) => ({ label: x.label, count: x.count, color: STATUS_META[x.status].color }))} centerLabel="orders" height={180} />
                )}
              </CardBody>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            {finance && (
              <div className="xl:col-span-2">
                <ChartCard title="Orders overview" description="Number of orders received" icon={ClipboardList} period={volPeriod} onPeriod={setVolPeriod}>
                  {vol.loading && !vol.data ? <Skeleton className="h-[260px] w-full" /> : <VolumeBarChart data={vol.data ?? []} />}
                </ChartCard>
              </div>
            )}
            <Card className={finance ? '' : 'xl:col-span-1'}>
              <CardHeader title="Popular services" description={`By garments processed · ${rangeLabel}`} icon={Shirt} />
              <CardBody>
                {!d ? (
                  <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
                ) : (
                  <BarList rows={d.popularServices.map((x) => ({ label: x.name, value: x.garments, sub: finance ? formatCompactCurrency(x.revenue) : undefined }))} format={(v) => `${formatNumber(v)} items`} />
                )}
              </CardBody>
            </Card>
            {!finance && (
              <Card className="xl:col-span-2">
                <CardHeader title="Today’s schedule" description="Pickups, deliveries and collections due today" icon={CalendarDays} />
                <CardBody>{!d ? <Skeleton className="h-40 w-full" /> : <ScheduleList items={d.schedule} />}</CardBody>
              </Card>
            )}
          </section>

          {/* Recent orders */}
          <Card>
            <CardHeader
              title="Recent orders"
              description="The latest orders received across all counters"
              icon={ClipboardList}
              action={<Button to="/orders" variant="ghost" size="sm" iconRight={ArrowRight}>View all orders</Button>}
            />
            <div className="border-t border-line">
              <OrderTable rows={d?.recentOrders ?? []} loading={!d} variant="compact" pageSize={8} />
            </div>
          </Card>

          {/* Operations */}
          <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {finance && (
              <Card>
                <CardHeader title="Today’s schedule" description="Pickups, deliveries & collections due" icon={CalendarDays} />
                <CardBody>{!d ? <Skeleton className="h-40 w-full" /> : <ScheduleList items={d.schedule} />}</CardBody>
              </Card>
            )}
            <Card>
              <CardHeader
                title="Overdue orders"
                description="Past their expected completion time"
                icon={TriangleAlert}
                action={d?.overdue.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">{d.overdue.length}</span>}
              />
              <CardBody>
                {!d ? (
                  <Skeleton className="h-40 w-full" />
                ) : d.overdue.length === 0 ? (
                  <EmptyState compact icon={Clock} title="No overdue orders" description="Everything is on schedule. Great work!" />
                ) : (
                  <ul className="divide-y divide-line">
                    {d.overdue.slice(0, 6).map((o) => (
                      <li key={o.id}>
                        <Link to={`/orders/${o.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600"><TriangleAlert size={16} aria-hidden /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-ink">{o.id} · {o.customer.name}</p>
                            <p className="truncate text-xs text-red-600">Due {timeAgo(o.dueAt)} · {o.assignedName}</p>
                          </div>
                          <OrderStatusBadge status={o.status} size="sm" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader title="Recent activity" description="Latest actions by your team" icon={Activity} />
              <CardBody className="scroll-thin max-h-[360px] overflow-y-auto">
                <ActivityFeed items={acts.data} loading={acts.loading && !acts.data} limit={10} />
              </CardBody>
            </Card>
          </section>

          {(finance || d?.lowStock.length > 0) && (
            <section className="grid gap-6 lg:grid-cols-2">
              {finance && (
                <Card>
                  <CardHeader title="Outstanding customer payments" description="Customers with unpaid balances" icon={HandCoins} action={can('payments.view') && <Button to="/payments" variant="ghost" size="sm" iconRight={ArrowRight}>Payments</Button>} />
                  <CardBody>
                    {!d ? (
                      <Skeleton className="h-40 w-full" />
                    ) : d.outstandingCustomers.length === 0 ? (
                      <EmptyState compact icon={HandCoins} title="No outstanding balances" />
                    ) : (
                      <ul className="divide-y divide-line">
                        {d.outstandingCustomers.map((r) => (
                          <li key={r.customer.id}>
                            <Link to={`/customers/${r.customer.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                              <Avatar name={r.customer.name} size="sm" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-ink">{r.customer.name}</p>
                                <p className="truncate text-xs text-muted">{displayPhone(r.customer.phone)} · {r.orders} order{r.orders > 1 ? 's' : ''} · since {formatDate(r.oldest)}</p>
                              </div>
                              <span className="text-[13px] font-bold tabular-nums text-red-600">{formatCurrency(r.amount, { decimals: 0 })}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              )}
              {can('inventory.view') && (
                <Card>
                  <CardHeader title="Low-stock alerts" description="Supplies at or below their minimum level" icon={PackageX} action={<Button to="/inventory" variant="ghost" size="sm" iconRight={ArrowRight}>Inventory</Button>} />
                  <CardBody>
                    {!d ? (
                      <Skeleton className="h-40 w-full" />
                    ) : d.lowStock.length === 0 ? (
                      <EmptyState compact icon={PackageCheck} title="All supplies well stocked" />
                    ) : (
                      <ul className="divide-y divide-line">
                        {d.lowStock.map((i) => (
                          <li key={i.id}>
                            <Link to={`/inventory?item=${i.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i.status === 'out' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}><PackageX size={16} aria-hidden /></span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-ink">{i.name}</p>
                                <p className="text-xs text-muted">{formatNumber(i.stock)} {i.unit} left · minimum {i.minStock}</p>
                              </div>
                              <StockBadge status={i.status} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardBody>
                </Card>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
