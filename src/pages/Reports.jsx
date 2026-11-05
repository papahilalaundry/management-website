import { useState } from 'react'
import {
  Activity, CircleDollarSign, ClipboardList, Clock, Download, FileSpreadsheet, FileText, HandCoins, Info, Percent, ReceiptText, Scale,
  Shirt, TrendingUp, TriangleAlert, Users, Wallet, PackageCheck, Tag, Smartphone, MessageSquare, Star, UserPlus, Repeat,
} from 'lucide-react'
import { toast } from 'sonner'
import { reportService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useSettings } from '../context/SettingsContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Tabs from '../components/ui/Tabs'
import Dropdown from '../components/ui/Dropdown'
import { Skeleton, StatCardSkeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { RatingBadge, RoleBadge } from '../components/shared/StatusBadges'
import { STATUS_META } from '../data/statusMeta'
import DateRangeFilter from '../components/shared/DateRangeFilter'
import { describeRange, rangeFromPreset } from '../utils/dateRanges'
import { BarList, DonutChart, Legend, RevenueExpenseChart, VolumeBarChart } from '../components/charts/Charts'
import { METHOD_COLORS, SERIES } from '../components/charts/chartTheme'
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '../utils/formatCurrency'
import { formatDate, toInputDate } from '../utils/formatDate'
import { exportCsv, exportExcel } from '../utils/exporters'
import { formatQuantity } from '../data/constants'

const kg = (v) => `${formatNumber(v, Number.isInteger(v) ? 0 : 1)} kg`
const avgRating = (list) => {
  const rated = list.filter((x) => x.rating)
  return rated.length ? rated.reduce((a, x) => a + x.rating, 0) / rated.length : null
}

function turnaround(hours) {
  if (!hours) return '—'
  if (hours < 24) return `${hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} days`
}

function PnL({ pnl }) {
  return (
    <div className="text-[13px]">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Income (cash received)</p>
      {pnl.income.map((i) => <div key={i.label} className="flex justify-between py-1 text-slate-600"><span>{i.label}</span><span className="tabular-nums">{formatCurrency(i.amount)}</span></div>)}
      <div className="mb-4 flex justify-between border-t border-line py-1.5 font-bold text-ink"><span>Total income</span><span className="tabular-nums">{formatCurrency(pnl.totalIncome)}</span></div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Operating expenses</p>
      {pnl.expenses.length === 0 && <p className="py-1 text-slate-400">No expenses recorded.</p>}
      {pnl.expenses.map((i) => <div key={i.label} className="flex justify-between py-1 text-slate-600"><span>{i.label}</span><span className="tabular-nums">({formatCurrency(i.amount)})</span></div>)}
      <div className="mb-4 flex justify-between border-t border-line py-1.5 font-bold text-ink"><span>Total expenses</span><span className="tabular-nums">({formatCurrency(pnl.totalExpenses)})</span></div>
      <div className={`flex justify-between rounded-lg px-3 py-2.5 text-[15px] font-extrabold ${pnl.netProfit >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
        <span>Net {pnl.netProfit >= 0 ? 'profit' : 'loss'}</span><span className="tabular-nums">{formatCurrency(pnl.netProfit)}</span>
      </div>
      <p className="mt-2 text-right text-xs text-muted">Net margin {formatPercent(pnl.margin)}</p>
    </div>
  )
}

export default function Reports() {
  const { business } = useSettings()
  const [range, setRange] = useState(() => rangeFromPreset('month'))
  const [tab, setTab] = useState('financial')
  const [volMetric, setVolMetric] = useState('orders')
  const [exporting, setExporting] = useState(false)
  const report = useAsync(() => reportService.getReport(range), [range.from, range.to])
  const pnl = useAsync(() => reportService.getProfitAndLoss(range), [range.from, range.to])
  const r = report.data
  const f = r?.financial
  const o = r?.operational
  const label = describeRange(range)
  const periodText = `${formatDate(range.from)} – ${formatDate(range.to)}`

  const doExport = async (kind) => {
    if (!r || !pnl.data) return
    setExporting(true)
    try {
      const stamp = 'papa-hila-report'
      if (kind === 'pdf') {
        const { downloadReportPdf } = await import('../utils/pdf')
        await downloadReportPdf({
          title: 'Business Report',
          subtitle: periodText,
          business,
          fileName: `${stamp}-${toInputDate(range.from)}-to-${toInputDate(range.to)}.pdf`,
          sections: [
            { title: 'Financial summary (cash basis)', summary: [['Revenue (payments received)', formatCurrency(f.revenue)], ...f.byMethod.map((m) => [`  ${m.label}`, formatCurrency(m.amount)]), ['Estimated payments', formatCurrency(f.expectedPayments)], ['Paid less than estimated', formatCurrency(f.shortfall)], ['Total expenses', formatCurrency(f.expenses)], ['Net profit', formatCurrency(f.netProfit)], ['Net margin', formatPercent(f.margin)], ['Gross billings (orders received)', formatCurrency(f.billed)], ['Discounts given', formatCurrency(f.discounts)], ['Outstanding receivables', formatCurrency(f.receivables)]] },
            { title: 'Profit & loss statement', table: { head: ['Line', 'Amount'], body: [...pnl.data.income.map((i) => [i.label, formatCurrency(i.amount)]), ['Total income', formatCurrency(pnl.data.totalIncome)], ...pnl.data.expenses.map((e) => [e.label, `(${formatCurrency(e.amount)})`]), ['Total expenses', `(${formatCurrency(pnl.data.totalExpenses)})`]], foot: ['Net profit', formatCurrency(pnl.data.netProfit)], align: ['left', 'right'] } },
            { title: `Revenue & expenses by ${r.range.granularity}`, table: { head: ['Period', 'Orders', 'Kg', 'Revenue', 'Expenses', 'Profit'], body: f.series.map((s) => [s.label, String(s.orders), formatNumber(s.kg, 1), formatCurrency(s.revenue), formatCurrency(s.expenses), formatCurrency(s.profit)]), foot: ['Total', String(o.totalOrders), formatNumber(o.kg, 1), formatCurrency(f.revenue), formatCurrency(f.expenses), formatCurrency(f.netProfit)], align: ['left', 'right', 'right', 'right', 'right', 'right'] } },
            { title: 'Operational summary', summary: [['Orders received', formatNumber(o.totalOrders)], ['Orders completed', formatNumber(o.completed)], ['Orders delivered', formatNumber(o.delivered)], ['Cancelled', formatNumber(o.cancelled)], ['Currently overdue', formatNumber(o.overdue)], ['Laundry processed', kg(o.kg)], ['Average weight per order', kg(o.avgKgPerOrder)], ['Garments counted', formatNumber(o.garments)], ['Average order value', formatCurrency(o.avgOrderValue)], ['Average turnaround (to ready)', turnaround(o.avgTurnaroundHours)]] },
            { title: 'Clients', summary: [['Total clients', formatNumber(r.clients.total)], ['Regular clients', formatNumber(r.clients.regular)], ['New clients', formatNumber(r.clients.new)], ['New clients registered in period', formatNumber(r.clients.newInPeriod)], ['Clients who brought laundry in period', formatNumber(r.clients.returningInPeriod)]] },
            { title: 'Orders by service', table: { head: ['Service', 'Orders', 'Quantity', 'Garments', 'Value'], body: o.byService.map((s) => [s.name, String(s.orders), formatQuantity(s.quantity ?? s.kg, s), String(s.garments), formatCurrency(s.revenue)]), align: ['left', 'right', 'right', 'right', 'right'] } },
            { title: 'Most common garments', table: { head: ['Garment', 'Category', 'Pieces', 'Orders'], body: o.topGarments.map((g) => [g.name, g.category, String(g.quantity), String(g.orders)]), align: ['left', 'left', 'right', 'right'] } },
            { title: 'Staff productivity', table: { head: ['Staff', 'Role', 'Assigned', 'Completed', 'Kg', 'Garments', 'Orders created', 'Payments', 'Collected'], body: o.staff.map((s) => [s.name, s.role, String(s.assigned), String(s.completed), formatNumber(s.kg, 1), String(s.garments), String(s.created), String(s.paymentsRecorded), formatCurrency(s.amountCollected)]), align: ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] } },
            ...(o.feedback.length ? [{ title: `Client feedback (${o.feedback.length})`, table: { head: ['Order', 'Client', 'Rating', 'Comment'], body: o.feedback.map((x) => [x.orderId, x.customerName, x.rating ? `${x.rating}/5` : '-', x.comment || '-']), align: ['left', 'left', 'right', 'left'] } }] : []),
            { title: 'Assumptions', summary: [['Revenue', 'Recorded payments only (cash basis): Paybill, M-Pesa number and cash'], ['Unpaid balances', 'Shown as receivables, not revenue'], ['Net profit', 'Revenue - recorded expenses']] },
          ],
        })
      } else if (kind === 'xlsx') {
        await exportExcel([
          { name: 'Summary', rows: [['Period', periodText], ['Revenue', f.revenue], ...f.byMethod.map((m) => [m.label, m.amount]), ['Estimated payments', f.expectedPayments], ['Paid less than estimated', f.shortfall], ['Expenses', f.expenses], ['Net profit', f.netProfit], ['Margin %', Number(f.margin.toFixed(2))], ['Gross billings', f.billed], ['Receivables', f.receivables], ['Orders', o.totalOrders], ['Completed', o.completed], ['Laundry (kg)', o.kg], ['Avg kg per order', o.avgKgPerOrder], ['Garments counted', o.garments], ['Avg order value', o.avgOrderValue], ['Total clients', r.clients.total], ['Regular clients', r.clients.regular], ['New clients', r.clients.new], ['New clients in period', r.clients.newInPeriod], ['Avg turnaround (hrs)', Number(o.avgTurnaroundHours.toFixed(1))]], columns: [{ header: 'Metric', value: (x) => x[0] }, { header: 'Value', value: (x) => x[1] }] },
          { name: 'Payment modes', rows: f.byMethod, columns: [{ header: 'Mode', value: (m) => m.label }, { header: 'Amount', value: (m) => m.amount }, { header: '% of revenue', value: (m) => Number(m.pct.toFixed(1)) }] },
          { name: 'Revenue & expenses', rows: f.series, columns: [{ header: 'Period', value: (s) => s.label }, { header: 'Orders', value: (s) => s.orders }, { header: 'Kg', value: (s) => s.kg }, { header: 'Revenue', value: (s) => s.revenue }, { header: 'Expenses', value: (s) => s.expenses }, { header: 'Profit', value: (s) => s.profit }] },
          { name: 'Expense breakdown', rows: f.expenseBreakdown, columns: [{ header: 'Category', value: (e) => e.category }, { header: 'Amount', value: (e) => e.amount }, { header: '% of total', value: (e) => Number(e.pct.toFixed(1)) }] },
          { name: 'Services', rows: o.byService, columns: [{ header: 'Service', value: (s) => s.name }, { header: 'Orders', value: (s) => s.orders }, { header: 'Quantity', value: (s) => s.quantity ?? s.kg }, { header: 'Unit', value: (s) => (s.unit === 'custom' ? s.unitLabel : s.unit) }, { header: 'Garments', value: (s) => s.garments }, { header: 'Value', value: (s) => s.revenue }] },
          { name: 'Garments', rows: o.topGarments, columns: [{ header: 'Garment', value: (g) => g.name }, { header: 'Category', value: (g) => g.category }, { header: 'Pieces', value: (g) => g.quantity }, { header: 'Orders', value: (g) => g.orders }] },
          { name: 'Feedback', rows: o.feedback, columns: [{ header: 'Order', value: (x) => x.orderId }, { header: 'Client', value: (x) => x.customerName }, { header: 'Rating', value: (x) => x.rating ?? '' }, { header: 'Comment', value: (x) => x.comment }, { header: 'Date', value: (x) => formatDate(x.at) }] },
          { name: 'Staff', rows: o.staff, columns: [{ header: 'Name', value: (s) => s.name }, { header: 'Role', value: (s) => s.role }, { header: 'Assigned', value: (s) => s.assigned }, { header: 'Completed', value: (s) => s.completed }, { header: 'Kg', value: (s) => s.kg }, { header: 'Garments', value: (s) => s.garments }, { header: 'Created', value: (s) => s.created }, { header: 'Payments', value: (s) => s.paymentsRecorded }, { header: 'Collected', value: (s) => s.amountCollected }] },
        ], stamp)
      } else {
        exportCsv(f.series, [{ header: 'Period', value: (s) => s.label }, { header: 'Orders', value: (s) => s.orders }, { header: 'Kg', value: (s) => s.kg }, { header: 'Revenue', value: (s) => s.revenue }, { header: 'Expenses', value: (s) => s.expenses }, { header: 'Profit', value: (s) => s.profit }], `${stamp}-series`)
      }
      toast.success('Report exported')
    } catch (e) {
      console.error(e)
      toast.error('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Financial and operational performance · ${periodText}`}
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Dropdown
              trigger={<Button icon={Download} loading={exporting} disabled={!r}>Export report</Button>}
              items={[
                { label: 'PDF report', icon: FileText, onClick: () => doExport('pdf') },
                { label: 'Excel workbook', icon: FileSpreadsheet, onClick: () => doExport('xlsx') },
                { label: 'CSV (time series)', icon: FileText, onClick: () => doExport('csv') },
              ]}
            />
          </>
        }
      />

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'financial', label: 'Financial', icon: CircleDollarSign }, { value: 'operational', label: 'Operational', icon: Activity }]} />

      {report.error ? <Card><ErrorState error={report.error} onRetry={report.reload} /></Card> : tab === 'financial' ? (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {!f ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />) : (
              <>
                <MiniStat label="Revenue" value={formatCurrency(f.revenue, { decimals: 0 })} icon={Wallet} tone="navy" sub={`${formatNumber(f.paymentCount)} payments`} />
                <MiniStat label="Expenses" value={formatCurrency(f.expenses, { decimals: 0 })} icon={ReceiptText} tone="amber" />
                <MiniStat label="Net profit" value={formatCurrency(f.netProfit, { decimals: 0 })} icon={TrendingUp} tone={f.netProfit >= 0 ? 'green' : 'red'} />
                <MiniStat label="Net margin" value={formatPercent(f.margin)} icon={Percent} tone="violet" />
                <MiniStat label="Gross billings" value={formatCurrency(f.billed, { decimals: 0 })} icon={ClipboardList} tone="blue" sub="Value of orders received" />
                <MiniStat label="Outstanding receivables" value={formatCurrency(f.receivables, { decimals: 0 })} icon={HandCoins} tone="red" sub="Unpaid on these orders" />
                <MiniStat label="Estimated vs paid" value={formatCurrency(f.shortfall, { decimals: 0 })} icon={Scale} tone={f.shortfall > 0 ? 'red' : 'cyan'} sub={`Paid ${formatCompactCurrency(f.revenue)} of ${formatCompactCurrency(f.expectedPayments)} estimated`} />
                <MiniStat label="Discounts given" value={formatCurrency(f.discounts, { decimals: 0 })} icon={Tag} tone="slate" />
              </>
            )}
          </section>

          <Card>
            <CardHeader title={`Revenue vs expenses · by ${r?.range.granularity ?? 'day'}`} description={label} icon={TrendingUp}
              action={f && <Legend items={[{ label: 'Revenue', color: SERIES.revenue.color, line: true }, { label: 'Expenses', color: SERIES.expenses.color, line: true }]} />} />
            <CardBody>{!f ? <Skeleton className="h-[320px] w-full" /> : <RevenueExpenseChart data={f.series} height={320} />}</CardBody>
          </Card>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Payment modes" description="Paybill, M-Pesa number and cash received" icon={Smartphone} />
              <CardBody>
                {!f ? <Skeleton className="h-[220px] w-full" /> : (
                  <DonutChart data={f.byMethod.map((m) => ({ label: m.label, count: m.amount, color: METHOD_COLORS[m.method] ?? '#94a3b8' }))} centerLabel="received" height={170} valueFormatter={(v) => formatCompactCurrency(v)} />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Estimated vs actually paid" description="Payments recorded in this period" icon={Scale} />
              <CardBody>
                {!f ? <Skeleton className="h-40 w-full" /> : (
                  <div className="space-y-2 text-[13px]">
                    <div className="flex justify-between text-slate-600"><span>Estimated amount</span><span className="tabular-nums">{formatCurrency(f.expectedPayments)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Actually paid</span><span className="tabular-nums">{formatCurrency(f.revenue)}</span></div>
                    <div className={`flex justify-between rounded-lg px-3 py-2.5 font-bold ${f.shortfall > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                      <span>{f.shortfall > 0 ? 'Paid less than estimated' : 'Paid as estimated'}</span><span className="tabular-nums">{formatCurrency(Math.abs(f.shortfall))}</span>
                    </div>
                    <p className="text-xs text-muted">{formatNumber(f.paymentCount)} payments. Each payment records the amount the client was expected to pay and what they actually paid; the difference stays on the order as a balance.</p>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Profit & loss statement" description={periodText} icon={Scale} />
              <CardBody>{!pnl.data ? <Skeleton className="h-64 w-full" /> : <PnL pnl={pnl.data} />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Expense breakdown" description="By category" icon={ReceiptText} />
              <CardBody>{!f ? <Skeleton className="h-64 w-full" /> : <BarList rows={f.expenseBreakdown.map((e) => ({ label: e.category, value: e.amount, sub: formatPercent(e.pct, 0) }))} format={(v) => formatCurrency(v, { decimals: 0 })} color="#d97706" />}</CardBody>
            </Card>
          </section>

          <Card>
            <CardHeader title="Monthly revenue" description="Months within the selected range" icon={CircleDollarSign} />
            <div className="scroll-thin overflow-x-auto border-t border-line">
              {!f ? <Skeleton className="m-5 h-32" /> : (
                <table className="table-base">
                  <thead><tr><th>Month</th><th className="text-right">Orders</th><th className="text-right">Billed</th><th className="text-right">Revenue</th><th className="text-right">Expenses</th><th className="text-right">Profit</th></tr></thead>
                  <tbody>
                    {f.monthly.map((m) => (
                      <tr key={m.label}>
                        <td className="font-semibold">{m.label}</td>
                        <td className="text-right tabular-nums">{formatNumber(m.orders)}</td>
                        <td className="text-right tabular-nums text-slate-600">{formatCurrency(m.billed, { decimals: 0 })}</td>
                        <td className="text-right tabular-nums">{formatCurrency(m.revenue, { decimals: 0 })}</td>
                        <td className="text-right tabular-nums text-slate-600">{formatCurrency(m.expenses, { decimals: 0 })}</td>
                        <td className={`text-right font-bold tabular-nums ${m.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCurrency(m.profit, { decimals: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <div className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-[13px] text-slate-600">
            <Info size={18} className="mt-0.5 shrink-0 text-brand" />
            <div>
              <p className="font-semibold text-ink">How these figures are calculated</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li><strong>Revenue</strong> is cash-basis: only payments actually recorded in the period (Paybill, M-Pesa number and cash). Unpaid balances are not counted.</li>
                <li><strong>Net profit</strong> = Revenue − Expenses recorded in the period.</li>
                <li><strong>Gross billings</strong> is the total value of non-cancelled orders received in the period (weight × rate per kg, plus charges). <strong>Receivables</strong> is what remains unpaid on all orders today.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {!o ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />) : (
              <>
                <MiniStat label="Orders" value={formatNumber(o.totalOrders)} icon={ClipboardList} tone="blue" sub={`${o.cancelled} cancelled`} />
                <MiniStat label="Completed" value={formatNumber(o.completed)} icon={PackageCheck} tone="green" sub={`${o.totalOrders ? Math.round((o.completed / o.totalOrders) * 100) : 0}% of orders`} />
                <MiniStat label="Laundry processed" value={kg(o.kg)} icon={Scale} tone="cyan" sub={`${kg(o.avgKgPerOrder)} per order on average`} />
                <MiniStat label="Garments counted" value={formatNumber(o.garments)} icon={Shirt} tone="violet" />
                <MiniStat label="Avg order value" value={formatCurrency(o.avgOrderValue, { decimals: 0 })} icon={CircleDollarSign} tone="navy" />
                <MiniStat label="Avg turnaround" value={turnaround(o.avgTurnaroundHours)} icon={Clock} tone="cyan" sub="Received → ready" />
                <MiniStat label="Overdue now" value={formatNumber(o.overdue)} icon={TriangleAlert} tone="red" />
              </>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={`${volMetric === 'kg' ? 'Laundry (kg)' : 'Orders'} by ${r?.range.granularity ?? 'day'}`} description={label} icon={ClipboardList}
                action={<Tabs variant="pills" tabs={[{ value: 'orders', label: 'Orders' }, { value: 'kg', label: 'Kg' }]} value={volMetric} onChange={setVolMetric} ariaLabel="Chart measure" />} />
              <CardBody>{!f ? <Skeleton className="h-[280px] w-full" /> : <VolumeBarChart data={f.series} height={280} dataKey={volMetric} name={volMetric === 'kg' ? 'Laundry (kg)' : 'Orders'} unit={volMetric === 'kg' ? 'kg' : ''} color={SERIES[volMetric].color} />}</CardBody>
            </Card>
            <Card>
              <CardHeader title="Orders by status" description={label} icon={Activity} />
              <CardBody>{!o ? <Skeleton className="h-[220px] w-full" /> : <DonutChart data={o.byStatus.filter((s) => s.status !== 'cancelled').map((s) => ({ label: s.label, count: s.count, color: STATUS_META[s.status].color }))} centerLabel="orders" height={170} />}</CardBody>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Orders by service" icon={Tag} />
              <div className="scroll-thin overflow-x-auto border-t border-line">
                {!o ? <Skeleton className="m-5 h-40" /> : (
                  <table className="table-base">
                    <thead><tr><th>Service</th><th className="text-right">Orders</th><th className="text-right">Quantity</th><th className="text-right">Garments</th><th className="text-right">Value</th></tr></thead>
                    <tbody>{o.byService.map((s) => <tr key={s.id}><td className="font-semibold">{s.name}</td><td className="text-right tabular-nums">{formatNumber(s.orders)}</td><td className="text-right tabular-nums">{formatQuantity(s.quantity ?? s.kg, s)}</td><td className="text-right tabular-nums">{formatNumber(s.garments)}</td><td className="text-right tabular-nums">{formatCurrency(s.revenue, { decimals: 0 })}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Most common garments" description="Pieces counted at drop-off" icon={Shirt} />
              <CardBody>{!o ? <Skeleton className="h-60 w-full" /> : <BarList rows={o.topGarments.map((g) => ({ label: g.name, value: g.quantity, sub: `${g.orders} order${g.orders === 1 ? '' : 's'}` }))} format={(v) => `${formatNumber(v)} pcs`} />}</CardBody>
            </Card>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Client mix" description="New and regular clients (regular from the 2nd order)" icon={Users} />
              <CardBody>
                {!r ? <Skeleton className="h-[220px] w-full" /> : (
                  <div className="space-y-4">
                    <DonutChart data={[{ label: 'Regular clients', count: r.clients.regular, color: '#4f46e5' }, { label: 'New clients', count: r.clients.new, color: '#0891b2' }]} centerLabel="clients" height={150} />
                    <div className="grid grid-cols-2 gap-3">
                      <MiniStat label="Registered this period" value={formatNumber(r.clients.newInPeriod)} icon={UserPlus} tone="cyan" />
                      <MiniStat label="Brought laundry" value={formatNumber(r.clients.returningInPeriod)} icon={Repeat} tone="violet" sub="Clients with orders in period" />
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Client feedback"
                description={label}
                icon={MessageSquare}
                action={o && avgRating(o.feedback) != null && <span className="inline-flex items-center gap-1 text-sm font-bold text-ink"><Star size={15} className="fill-amber-400 text-amber-400" aria-hidden />{avgRating(o.feedback).toFixed(1)} <span className="text-xs font-normal text-muted">/ 5 avg</span></span>}
              />
              <CardBody className="scroll-thin max-h-[340px] overflow-y-auto">
                {!o ? <Skeleton className="h-40 w-full" /> : o.feedback.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">No feedback recorded in this period.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {[...o.feedback].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).map((x) => (
                      <li key={x.orderId} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-ink">{x.customerName} <span className="font-mono text-xs font-normal text-muted">· {x.orderId}</span></p>
                          <RatingBadge rating={x.rating} size="sm" />
                        </div>
                        {x.comment && <p className="mt-0.5 text-[13px] text-slate-600">“{x.comment}”</p>}
                        {x.at && <p className="mt-0.5 text-[11px] text-muted">{formatDate(x.at)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </section>

          <Card>
            <CardHeader title="Staff productivity" description="Orders assigned, completed and payments collected" icon={Users} />
            <div className="scroll-thin overflow-x-auto border-t border-line">
              {!o ? <Skeleton className="m-5 h-40" /> : (
                <table className="table-base">
                  <thead><tr><th>Staff member</th><th>Role</th><th className="text-right">Assigned</th><th className="text-right">Completed</th><th className="text-right">Kg</th><th className="text-right">Garments</th><th className="text-right">Orders created</th><th className="text-right">Payments</th><th className="text-right">Collected</th></tr></thead>
                  <tbody>
                    {o.staff.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}{s.status === 'inactive' && <span className="ml-1.5 text-xs font-normal text-muted">(inactive)</span>}</td>
                        <td><RoleBadge role={s.role} /></td>
                        <td className="text-right tabular-nums">{s.assigned}</td>
                        <td className="text-right tabular-nums">{s.completed}{s.assigned ? <span className="ml-1 text-xs text-muted">({Math.round((s.completed / s.assigned) * 100)}%)</span> : null}</td>
                        <td className="text-right tabular-nums">{formatNumber(s.kg, 1)}</td>
                        <td className="text-right tabular-nums">{formatNumber(s.garments)}</td>
                        <td className="text-right tabular-nums">{s.created}</td>
                        <td className="text-right tabular-nums">{s.paymentsRecorded}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(s.amountCollected, { decimals: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
