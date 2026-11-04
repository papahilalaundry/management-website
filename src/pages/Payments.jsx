import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isToday } from 'date-fns'
import { Banknote, CircleDollarSign, ClipboardList, Download, Eye, FileSpreadsheet, FileText, HandCoins, MoreHorizontal, Plus, Printer, Smartphone, Wallet, CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { paymentService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useTable } from '../hooks/useTable'
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

const EXPORT_COLUMNS = [
  { header: 'Transaction ID', value: (p) => p.id },
  { header: 'Order ID', value: (p) => p.orderId },
  { header: 'Customer', value: (p) => p.customerName },
  { header: 'Date', value: (p) => formatDateTime(p.paidAt) },
  { header: 'Method', value: (p) => methodLabel(p.method) },
  { header: 'Amount (KES)', value: (p) => p.amount },
  { header: 'Reference', value: (p) => p.reference },
  { header: 'Recorded by', value: (p) => p.recordedByName },
]

export default function Payments() {
  const navigate = useNavigate()
  const [range, setRange] = useState(() => rangeFromPreset('30d'))
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('')
  const [recording, setRecording] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const q = useDebounce(query.trim().toLowerCase(), 200)

  const { data, loading, error, reload } = useAsync(() => paymentService.getPayments(), [], { live: true, watch: ['payments'] })
  const { data: payable } = useAsync(() => paymentService.getPayableOrders(), [], { live: true, watch: ['payments', 'orders'] })
  const payments = useMemo(() => data ?? [], [data])

  const inRange = useMemo(() => payments.filter((p) => p.paidAt >= range.from && p.paidAt <= range.to), [payments, range])
  const stats = useMemo(() => ({
    total: inRange.reduce((s, p) => s + p.amount, 0),
    count: inRange.length,
    today: payments.filter((p) => isToday(new Date(p.paidAt))).reduce((s, p) => s + p.amount, 0),
    todayCount: payments.filter((p) => isToday(new Date(p.paidAt))).length,
    mpesa: inRange.filter((p) => p.method === 'mpesa').reduce((s, p) => s + p.amount, 0),
    cash: inRange.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0),
    outstanding: (payable ?? []).reduce((s, o) => s + o.balance, 0),
    outstandingCount: (payable ?? []).length,
  }), [inRange, payments, payable])

  const filtered = useMemo(() => inRange.filter((p) => {
    if (method && p.method !== method) return false
    if (q && !(p.id.toLowerCase().includes(q) || p.orderId.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q))) return false
    return true
  }), [inRange, method, q])

  const table = useTable(filtered, { pageSize: 15, initialSort: { key: 'paidAt', dir: 'desc' }, resetKey: `${q}|${method}|${range.from}|${range.to}` })
  const pct = (v) => (stats.total ? Math.round((v / stats.total) * 100) : 0)

  const doExport = async (kind) => {
    if (!table.sorted.length) return toast.error('No payments to export for this period.')
    const name = 'papa-hila-payments'
    try {
      if (kind === 'xlsx') await exportExcel([{ name: 'Payments', rows: table.sorted, columns: EXPORT_COLUMNS }], name)
      else exportCsv(table.sorted, EXPORT_COLUMNS, name)
      toast.success(`Exported ${table.sorted.length} payments`)
    } catch {
      toast.error('Export failed.')
    }
  }

  const columns = [
    { key: 'id', header: 'Transaction', sortable: true, render: (p) => <span className="font-mono text-xs font-bold text-ink">{p.id}</span> },
    { key: 'orderId', header: 'Order', sortable: true, render: (p) => <Link to={`/orders/${p.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-brand hover:underline">{p.orderId}</Link> },
    {
      key: 'customerName', header: 'Customer', sortable: true,
      render: (p) => <div className="flex items-center gap-2.5"><Avatar name={p.customerName} size="xs" /><span className="max-w-[160px] truncate font-medium text-ink">{p.customerName}</span></div>,
    },
    { key: 'paidAt', header: 'Date', sortable: true, hideBelow: 'md', render: (p) => <div><p className="text-[13px]">{formatDate(p.paidAt)}</p><p className="text-[11px] text-muted">{formatTime(p.paidAt)}</p></div> },
    { key: 'method', header: 'Method', sortable: true, render: (p) => <MethodBadge method={p.method} /> },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (p) => <span className="font-bold text-ink">{formatCurrency(p.amount)}</span> },
    { key: 'recordedByName', header: 'Recorded by', sortable: true, hideBelow: 'lg', render: (p) => <span className="text-slate-600">{p.recordedByName}</span> },
    { key: 'reference', header: 'Reference', hideBelow: 'xl', render: (p) => <span className="font-mono text-xs text-slate-500">{p.reference || '—'}</span> },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="M-Pesa and cash payments recorded against orders."
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Dropdown trigger={<Button variant="secondary" icon={Download}>Export</Button>} items={[{ label: 'Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => doExport('xlsx') }, { label: 'CSV', icon: FileText, onClick: () => doExport('csv') }]} />
            <Button icon={Plus} onClick={() => setRecording(true)}>Record payment</Button>
          </>
        }
      />
      <p className="-mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">M-Pesa payments are recorded manually and simulated — this system does not connect to Safaricom or move real money.</p>

      <section className="stat-strip grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5" aria-label="Payment statistics">
        <MiniStat label="Total received" value={formatCurrency(stats.total, { decimals: 0 })} icon={CircleDollarSign} tone="navy" sub={`${formatNumber(stats.count)} payments · ${describeRange(range).toLowerCase()}`} />
        <MiniStat label="Received today" value={formatCurrency(stats.today, { decimals: 0 })} icon={CalendarCheck} tone="blue" sub={`${stats.todayCount} payment${stats.todayCount === 1 ? '' : 's'}`} />
        <MiniStat label="M-Pesa" value={formatCurrency(stats.mpesa, { decimals: 0 })} icon={Smartphone} tone="green" sub={`${pct(stats.mpesa)}% of period total`} />
        <MiniStat label="Cash" value={formatCurrency(stats.cash, { decimals: 0 })} icon={Banknote} tone="slate" sub={`${pct(stats.cash)}% of period total`} />
        <MiniStat label="Outstanding balances" value={formatCurrency(stats.outstanding, { decimals: 0 })} icon={HandCoins} tone="red" sub={`${stats.outstandingCount} unpaid orders`} />
      </section>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search transaction, order, customer or M-Pesa ref…" className="flex-1" />
          <Select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="All methods" options={PAYMENT_METHODS} className="sm:w-48" />
        </div>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            table={table}
            loading={loading && !data}
            onRowClick={(p) => setReceipt(p)}
            getRowLabel={(p) => `View receipt ${p.id}`}
            mobileCard={{
              leading: (p) => <Avatar name={p.customerName} size="md" />,
              title: (p) => p.customerName,
              subtitle: (p) => <><span className="font-mono font-semibold text-slate-600">{p.orderId}</span> · {formatDate(p.paidAt)}, {formatTime(p.paidAt)}</>,
              meta: (p) => (p.reference ? <span className="font-mono">{p.reference}</span> : null),
              value: (p) => formatCurrency(p.amount, { decimals: 0 }),
              badge: (p) => <MethodBadge method={p.method} />,
            }}
            mobileFooter={
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-muted">Total · {table.total} payment{table.total === 1 ? '' : 's'}</span>
                <span className="tabular-nums text-ink">{formatCurrency(filtered.reduce((s, p) => s + p.amount, 0))}</span>
              </div>
            }
            empty={<EmptyState icon={Wallet} title="No payments in this period" description="Try a wider date range or record a new payment." action={<Button icon={Plus} onClick={() => setRecording(true)}>Record payment</Button>} />}
            footer={
              table.total > 0 && (
                <tfoot>
                  <tr className="bg-slate-50/80 text-[13px] font-bold">
                    <td colSpan={5} className="px-4 py-3 text-muted">Total for {table.total} payment{table.total === 1 ? '' : 's'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{formatCurrency(filtered.reduce((s, p) => s + p.amount, 0))}</td>
                    <td colSpan={3} />
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
