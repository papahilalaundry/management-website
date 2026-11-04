import { useState } from 'react'
import {
  Activity, CircleDollarSign, ClipboardList, Clock, Download, FileSpreadsheet, FileText, HandCoins, Info, Percent, ReceiptText, Scale,
  Shirt, TrendingUp, TriangleAlert, Users, Wallet, PackageCheck, Tag,
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
import { RoleBadge } from '../components/shared/StatusBadges'
import { STATUS_META } from '../data/statusMeta'
import DateRangeFilter from '../components/shared/DateRangeFilter'
import { describeRange, rangeFromPreset } from '../utils/dateRanges'
import { BarList, DonutChart, Legend, RevenueExpenseChart, VolumeBarChart } from '../components/charts/Charts'
import { SERIES } from '../components/charts/chartTheme'
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercent } from '../utils/formatCurrency'
import { formatDate, toInputDate } from '../utils/formatDate'
import { exportCsv, exportExcel } from '../utils/exporters'

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
            { title: 'Financial summary (cash basis)', summary: [['Revenue (payments received)', formatCurrency(f.revenue)], ['  M-Pesa', formatCurrency(f.mpesa)], ['  Cash', formatCurrency(f.cash)], ['Total expenses', formatCurrency(f.expenses)], ['Net profit', formatCurrency(f.netProfit)], ['Net margin', formatPercent(f.margin)], ['Gross billings (orders received)', formatCurrency(f.billed)], ['Discounts given', formatCurrency(f.discounts)], ['Outstanding receivables', formatCurrency(f.receivables)]] },
            { title: 'Profit & loss statement', table: { head: ['Line', 'Amount'], body: [...pnl.data.income.map((i) => [i.label, formatCurrency(i.amount)]), ['Total income', formatCurrency(pnl.data.totalIncome)], ...pnl.data.expenses.map((e) => [e.label, `(${formatCurrency(e.amount)})`]), ['Total expenses', `(${formatCurrency(pnl.data.totalExpenses)})`]], foot: ['Net profit', formatCurrency(pnl.data.netProfit)], align: ['left', 'right'] } },
            { title: `Revenue & expenses by ${r.range.granularity}`, table: { head: ['Period', 'Orders', 'Revenue', 'Expenses', 'Profit'], body: f.series.map((s) => [s.label, String(s.orders), formatCurrency(s.revenue), formatCurrency(s.expenses), formatCurrency(s.profit)]), foot: ['Total', String(o.totalOrders), formatCurrency(f.revenue), formatCurrency(f.expenses), formatCurrency(f.netProfit)], align: ['left', 'right', 'right', 'right', 'right'] } },
            { title: 'Operational summary', summary: [['Orders received', formatNumber(o.totalOrders)], ['Orders completed', formatNumber(o.completed)], ['Orders delivered', formatNumber(o.delivered)], ['Cancelled', formatNumber(o.cancelled)], ['Currently overdue', formatNumber(o.overdue)], ['Garments processed', formatNumber(o.garments)], ['Average order value', formatCurrency(o.avgOrderValue)], ['Average turnaround (to ready)', turnaround(o.avgTurnaroundHours)]] },
            { title: 'Orders by service', table: { head: ['Service', 'Orders', 'Items', 'Value'], body: o.byService.map((s) => [s.name, String(s.orders), String(s.garments), formatCurrency(s.revenue)]), align: ['left', 'right', 'right', 'right'] } },
            { title: 'Most popular garments', table: { head: ['Garment', 'Category', 'Quantity', 'Value'], body: o.topGarments.map((g) => [g.name, g.category, String(g.quantity), formatCurrency(g.revenue)]), align: ['left', 'left', 'right', 'right'] } },
            { title: 'Staff productivity', table: { head: ['Staff', 'Role', 'Assigned', 'Completed', 'Items', 'Orders created', 'Payments', 'Collected'], body: o.staff.map((s) => [s.name, s.role, String(s.assigned), String(s.completed), String(s.garments), String(s.created), String(s.paymentsRecorded), formatCurrency(s.amountCollected)]), align: ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'] } },
            { title: 'Assumptions', summary: [['Revenue', 'Recorded payments only (cash basis)'], ['Unpaid balances', 'Shown as receivables, not revenue'], ['Net profit', 'Revenue - recorded expenses']] },
          ],
        })
      } else if (kind === 'xlsx') {
        await exportExcel([
          { name: 'Summary', rows: [['Period', periodText], ['Revenue', f.revenue], ['M-Pesa', f.mpesa], ['Cash', f.cash], ['Expenses', f.expenses], ['Net profit', f.netProfit], ['Margin %', Number(f.margin.toFixed(2))], ['Gross billings', f.billed], ['Receivables', f.receivables], ['Orders', o.totalOrders], ['Completed', o.completed], ['Avg order value', o.avgOrderValue], ['Avg turnaround (hrs)', Number(o.avgTurnaroundHours.toFixed(1))]], columns: [{ header: 'Metric', value: (x) => x[0] }, { header: 'Value', value: (x) => x[1] }] },
          { name: 'Revenue & expenses', rows: f.series, columns: [{ header: 'Period', value: (s) => s.label }, { header: 'Orders', value: (s) => s.orders }, { header: 'Revenue', value: (s) => s.revenue }, { header: 'Expenses', value: (s) => s.expenses }, { header: 'Profit', value: (s) => s.profit }] },
          { name: 'Expense breakdown', rows: f.expenseBreakdown, columns: [{ header: 'Category', value: (e) => e.category }, { header: 'Amount', value: (e) => e.amount }, { header: '% of total', value: (e) => Number(e.pct.toFixed(1)) }] },
          { name: 'Services', rows: o.byService, columns: [{ header: 'Service', value: (s) => s.name }, { header: 'Orders', value: (s) => s.orders }, { header: 'Items', value: (s) => s.garments }, { header: 'Value', value: (s) => s.revenue }] },
          { name: 'Garments', rows: o.topGarments, columns: [{ header: 'Garment', value: (g) => g.name }, { header: 'Category', value: (g) => g.category }, { header: 'Quantity', value: (g) => g.quantity }, { header: 'Value', value: (g) => g.revenue }] },
          { name: 'Staff', rows: o.staff, columns: [{ header: 'Name', value: (s) => s.name }, { header: 'Role', value: (s) => s.role }, { header: 'Assigned', value: (s) => s.assigned }, { header: 'Completed', value: (s) => s.completed }, { header: 'Items', value: (s) => s.garments }, { header: 'Created', value: (s) => s.created }, { header: 'Payments', value: (s) => s.paymentsRecorded }, { header: 'Collected', value: (s) => s.amountCollected }] },
        ], stamp)
      } else {
        exportCsv(f.series, [{ header: 'Period', value: (s) => s.label }, { header: 'Orders', value: (s) => s.orders }, { header: 'Revenue', value: (s) => s.revenue }, { header: 'Expenses', value: (s) => s.expenses }, { header: 'Profit', value: (s) => s.profit }], `${stamp}-series`)
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
                <MiniStat label="M-Pesa / Cash" value={`${f.revenue ? Math.round((f.mpesa / f.revenue) * 100) : 0}% / ${f.revenue ? Math.round((f.cash / f.revenue) * 100) : 0}%`} icon={Scale} tone="cyan" sub={`${formatCompactCurrency(f.mpesa)} · ${formatCompactCurrency(f.cash)}`} />
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
                <li><strong>Revenue</strong> is cash-basis: only payments actually recorded in the period (M-Pesa + cash). Unpaid balances are not counted.</li>
                <li><strong>Net profit</strong> = Revenue − Expenses recorded in the period.</li>
                <li><strong>Gross billings</strong> is the total value of non-cancelled orders received in the period; <strong>receivables</strong> is what remains unpaid on those orders today.</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {!o ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />) : (
              <>
                <MiniStat label="Orders" value={formatNumber(o.totalOrders)} icon={ClipboardList} tone="blue" sub={`${o.cancelled} cancelled`} />
                <MiniStat label="Completed" value={formatNumber(o.completed)} icon={PackageCheck} tone="green" sub={`${o.totalOrders ? Math.round((o.completed / o.totalOrders) * 100) : 0}% of orders`} />
                <MiniStat label="Garments" value={formatNumber(o.garments)} icon={Shirt} tone="violet" />
                <MiniStat label="Avg order value" value={formatCurrency(o.avgOrderValue, { decimals: 0 })} icon={CircleDollarSign} tone="navy" />
                <MiniStat label="Avg turnaround" value={turnaround(o.avgTurnaroundHours)} icon={Clock} tone="cyan" sub="Received → ready" />
                <MiniStat label="Overdue now" value={formatNumber(o.overdue)} icon={TriangleAlert} tone="red" />
              </>
            )}
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title={`Orders by ${r?.range.granularity ?? 'day'}`} description={label} icon={ClipboardList} />
              <CardBody>{!f ? <Skeleton className="h-[280px] w-full" /> : <VolumeBarChart data={f.series} height={280} />}</CardBody>
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
                    <thead><tr><th>Service</th><th className="text-right">Orders</th><th className="text-right">Items</th><th className="text-right">Value</th></tr></thead>
                    <tbody>{o.byService.map((s) => <tr key={s.id}><td className="font-semibold">{s.name}</td><td className="text-right tabular-nums">{formatNumber(s.orders)}</td><td className="text-right tabular-nums">{formatNumber(s.garments)}</td><td className="text-right tabular-nums">{formatCurrency(s.revenue, { decimals: 0 })}</td></tr>)}</tbody>
                  </table>
                )}
              </div>
            </Card>
            <Card>
              <CardHeader title="Most popular garments" description="By quantity" icon={Shirt} />
              <CardBody>{!o ? <Skeleton className="h-60 w-full" /> : <BarList rows={o.topGarments.map((g) => ({ label: g.name, value: g.quantity, sub: g.category }))} format={(v) => `${formatNumber(v)} items`} />}</CardBody>
            </Card>
          </section>

          <Card>
            <CardHeader title="Staff productivity" description="Orders assigned, completed and payments collected" icon={Users} />
            <div className="scroll-thin overflow-x-auto border-t border-line">
              {!o ? <Skeleton className="m-5 h-40" /> : (
                <table className="table-base">
                  <thead><tr><th>Staff member</th><th>Role</th><th className="text-right">Assigned</th><th className="text-right">Completed</th><th className="text-right">Items</th><th className="text-right">Orders created</th><th className="text-right">Payments</th><th className="text-right">Collected</th></tr></thead>
                  <tbody>
                    {o.staff.map((s) => (
                      <tr key={s.id}>
                        <td className="font-semibold">{s.name}{s.status === 'inactive' && <span className="ml-1.5 text-xs font-normal text-muted">(inactive)</span>}</td>
                        <td><RoleBadge role={s.role} /></td>
                        <td className="text-right tabular-nums">{s.assigned}</td>
                        <td className="text-right tabular-nums">{s.completed}{s.assigned ? <span className="ml-1 text-xs text-muted">({Math.round((s.completed / s.assigned) * 100)}%)</span> : null}</td>
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
