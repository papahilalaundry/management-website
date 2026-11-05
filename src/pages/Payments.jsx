import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Building2, CircleDollarSign, ClipboardList, Download, Eye, FileSpreadsheet, FileText, HandCoins, MoreHorizontal, Plus, Printer, Smartphone, Wallet, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { paymentService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { usePagedQuery } from '../hooks/usePagedQuery'
import { useDebounce } from '../hooks/useDebounce'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import { Select } from '../components/ui/Field'
import DataTable from '../components/ui/DataTable'
import Dropdown from '../components/ui/Dropdown'
import Avatar from '../components/ui/Avatar'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { MethodBadge } from '../components/shared/StatusBadges'
import DateRangeFilter from '../components/shared/DateRangeFilter'
import { describeRange, rangeFromPreset } from '../utils/dateRanges'
import RecordPaymentModal from '../components/payments/RecordPaymentModal'
import ReceiptModal from '../components/receipts/ReceiptModal'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, formatDateTime, formatTime } from '../utils/formatDate'
import { methodLabel, PAYMENT_METHODS } from '../data/constants'
import { exportCsv, exportExcel } from '../utils/exporters'

const shortfall = (p) => (p.expectedAmount != null && p.amount < p.expectedAmount ? p.expectedAmount - p.amount : 0)

const EXPORT_COLUMNS = [
  { header: 'Transaction ID', value: (p) => p.id },
  { header: 'Order ID', value: (p) => p.orderId },
  { header: 'Client', value: (p) => p.customerName },
  { header: 'Date paid', value: (p) => formatDateTime(p.paidAt) },
  { header: 'Mode', value: (p) => methodLabel(p.method) },
  { header: 'Paid by (M-Pesa name)', value: (p) => p.payerName },
  { header: 'Estimated (KES)', value: (p) => p.expectedAmount ?? '' },
  { header: 'Paid (KES)', value: (p) => p.amount },
  { header: 'Difference (KES)', value: (p) => shortfall(p) || '' },
  { header: 'M-Pesa code', value: (p) => p.reference },
  { header: 'Paybill account', value: (p) => p.accountNumber ?? '' },
  { header: 'Recorded by', value: (p) => p.recordedByName },
]
const WATCH = ['payments']

export default function Payments() {
  const navigate = useNavigate()
  const [range, setRange] = useState(() => rangeFromPreset('30d'))
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('')
  const [recording, setRecording] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const search = useDebounce(query.trim(), 300)
  const filters = { from: range.from, to: range.to, method }

  const { data: stats } = useAsync(() => paymentService.getPaymentStats({ from: range.from, to: range.to }), [range.from, range.to], { live: true, watch: ['payments', 'orders'] })
  const fetchPage = useCallback(
    ({ pageSize, cursor }) => paymentService.listPayments({ from: range.from, to: range.to, method, search, pageSize, cursor }),
    [range.from, range.to, method, search],
  )
  const table = usePagedQuery(fetchPage, {
    key: JSON.stringify([range.from, range.to, method, search]),
    pageSize: 15,
    count: () => paymentService.countPayments({ from: range.from, to: range.to, method }),
    watch: WATCH,
  })
  const byMethod = stats?.byMethod ?? {}
  const pct = (v) => (stats?.total ? Math.round(((v || 0) / stats.total) * 100) : 0)
  const pageTotal = table.pageRows.reduce((s, p) => s + p.amount, 0)

  const doExport = async (kind) => {
    try {
      const rows = search ? table.pageRows : await paymentService.exportPayments(filters)
      if (!rows.length) return toast.error('No payments to export for this period.')
      const name = 'papa-hila-payments'
      if (kind === 'xlsx') await exportExcel([{ name: 'Payments', rows, columns: EXPORT_COLUMNS }], name)
      else exportCsv(rows, EXPORT_COLUMNS, name)
      toast.success(`Exported ${rows.length} payments`)
    } catch (e) {
      toast.error(e.message || 'Export failed.')
    }
  }

  const columns = [
    { key: 'id', header: 'Transaction', render: (p) => <span className="font-mono text-xs font-bold text-ink">{p.id}</span> },
    { key: 'orderId', header: 'Order', render: (p) => <Link to={`/orders/${p.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-brand hover:underline">{p.orderId}</Link> },
    {
      key: 'customerName', header: 'Client',
      render: (p) => <div className="flex items-center gap-2.5"><Avatar name={p.customerName} size="xs" /><span className="max-w-[160px] truncate font-medium text-ink">{p.customerName}</span></div>,
    },
    { key: 'payerName', header: 'Paid by', hideBelow: 'lg', render: (p) => (p.payerName ? <span className="text-slate-700">{p.payerName}</span> : <span className="text-slate-300">—</span>) },
    { key: 'paidAt', header: 'Date paid', hideBelow: 'md', render: (p) => <div><p className="text-[13px]">{formatDate(p.paidAt)}</p><p className="text-[11px] text-muted">{formatTime(p.paidAt)}</p></div> },
    { key: 'method', header: 'Mode', render: (p) => <MethodBadge method={p.method} /> },
    { key: 'expectedAmount', header: 'Estimated', align: 'right', hideBelow: 'xl', render: (p) => <span className="text-slate-500">{p.expectedAmount != null ? formatCurrency(p.expectedAmount) : '—'}</span> },
    { key: 'amount', header: 'Paid', align: 'right', render: (p) => <span className="font-bold text-ink">{formatCurrency(p.amount)}</span> },
    { key: 'difference', header: 'Difference', align: 'right', hideBelow: 'xl', render: (p) => (shortfall(p) ? <span className="font-semibold text-amber-700">−{formatCurrency(shortfall(p))}</span> : <span className="text-slate-300">—</span>) },
    { key: 'reference', header: 'M-Pesa code / account', hideBelow: 'xl', render: (p) => <div className="font-mono text-xs text-slate-500"><p>{p.reference || '—'}</p>{p.accountNumber && <p className="text-[11px] text-slate-400">Acc {p.accountNumber}</p>}</div> },
    { key: 'recordedByName', header: 'Recorded by', hideBelow: 'lg', render: (p) => <span className="text-slate-600">{p.recordedByName}</span> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (p) => (
        <Dropdown
          items={[
            { label: 'View receipt', icon: Printer, onClick: () => setReceipt(p) },
            { label: 'View order', icon: Eye, onClick: () => navigate(`/orders/${p.orderId}`) },
            { label: 'Customer profile', icon: ClipboardList, onClick: () => navigate(`/customers/${p.customerId}`) },
          ]}
          trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${p.id}`}><MoreHorizontal size={18} /></button>}
        />
      ),
    },
  ]
  const amountCol = columns.findIndex((c) => c.key === 'amount')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Paybill, M-Pesa number and cash payments recorded against orders."
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Dropdown trigger={<Button variant="secondary" icon={Download}>Export</Button>} items={[{ label: 'Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => doExport('xlsx') }, { label: 'CSV', icon: FileText, onClick: () => doExport('csv') }]} />
            <Button icon={Plus} onClick={() => setRecording(true)}>Record payment</Button>
          </>
        }
      />
      <p className="-mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Payments are entered by staff from the M-Pesa message or the cash received. No money moves through this system.</p>

      <section className="stat-strip grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Payment statistics">
        <MiniStat label="Total received" value={stats ? formatCurrency(stats.total, { decimals: 0 }) : '—'} icon={CircleDollarSign} tone="navy" sub={stats ? `${formatNumber(stats.count)} payments · ${describeRange(range).toLowerCase()}` : undefined} />
        <MiniStat label="Received today" value={stats ? formatCurrency(stats.today, { decimals: 0 }) : '—'} icon={CalendarCheck} tone="blue" sub={stats ? `${stats.todayCount} payment${stats.todayCount === 1 ? '' : 's'}` : undefined} />
        <MiniStat label="Paybill" value={stats ? formatCurrency(byMethod.paybill || 0, { decimals: 0 }) : '—'} icon={Building2} tone="green" sub={stats ? `${pct(byMethod.paybill)}% of period total` : undefined} />
        <MiniStat label="M-Pesa number" value={stats ? formatCurrency(byMethod.mpesa_number || 0, { decimals: 0 }) : '—'} icon={Smartphone} tone="cyan" sub={stats ? `${pct(byMethod.mpesa_number)}% of period total` : undefined} />
        <MiniStat label="Cash" value={stats ? formatCurrency(byMethod.cash || 0, { decimals: 0 }) : '—'} icon={Banknote} tone="slate" sub={stats ? `${pct(byMethod.cash)}% of period total` : undefined} />
        <MiniStat label="Outstanding balances" value={stats ? formatCurrency(stats.outstanding, { decimals: 0 }) : '—'} icon={HandCoins} tone="red" sub={stats ? `${stats.outstandingCount} unpaid order${stats.outstandingCount === 1 ? '' : 's'}` : undefined} />
      </section>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search transaction, order, client, payer name or M-Pesa code…" className="flex-1" />
          <Select aria-label="Mode of payment" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="All modes" options={PAYMENT_METHODS} className="sm:w-48" />
        </div>
        {table.error && !table.loaded ? (
          <ErrorState error={table.error} onRetry={table.reload} />
        ) : (
          <DataTable
            columns={columns}
            table={table}
            loading={table.loading && !table.pageRows.length}
            onRowClick={(p) => setReceipt(p)}
            getRowLabel={(p) => `View receipt ${p.id}`}
            mobileCard={{
              leading: (p) => <Avatar name={p.customerName} size="md" />,
              title: (p) => p.customerName,
              subtitle: (p) => <><span className="font-mono font-semibold text-slate-600">{p.orderId}</span> · {formatDate(p.paidAt)}, {formatTime(p.paidAt)}</>,
              meta: (p) => (
                <>
                  {p.payerName && <span>From {p.payerName}</span>}
                  {p.reference && <span className="font-mono">{p.reference}</span>}
                  {p.accountNumber && <span className="font-mono">Acc {p.accountNumber}</span>}
                  {shortfall(p) > 0 && <span className="text-amber-700">{formatCurrency(shortfall(p), { decimals: 0 })} below estimate</span>}
                </>
              ),
              value: (p) => formatCurrency(p.amount, { decimals: 0 }),
              badge: (p) => <MethodBadge method={p.method} />,
            }}
            mobileFooter={
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-muted">This page · {table.pageRows.length} payment{table.pageRows.length === 1 ? '' : 's'}</span>
                <span className="tabular-nums text-ink">{formatCurrency(pageTotal)}</span>
              </div>
            }
            empty={<EmptyState icon={Wallet} title="No payments found" description="Try a wider date range, another mode, or record a new payment." action={<Button icon={Plus} onClick={() => setRecording(true)}>Record payment</Button>} />}
            footer={
              table.pageRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50/80 text-[13px] font-bold">
                    <td colSpan={amountCol} className="px-4 py-3 text-muted">Total for this page ({table.pageRows.length} payment{table.pageRows.length === 1 ? '' : 's'})</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatCurrency(pageTotal)}</td>
                    <td colSpan={columns.length - amountCol - 1} />
                  </tr>
                </tfoot>
              )
            }
          />
        )}
      </Card>

      <RecordPaymentModal open={recording} onClose={() => setRecording(false)} />
      <ReceiptModal open={!!receipt} type="payment" payment={receipt} onClose={() => setReceipt(null)} />
    </div>
  )
}
