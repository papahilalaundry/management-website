import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText, Filter, Hourglass, Plus, RotateCcw, Truck, WashingMachine, X } from 'lucide-react'
import { toast } from 'sonner'
import { catalogService, orderService, staffService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useTable } from '../hooks/useTable'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import { Checkbox, Input, Select } from '../components/ui/Field'
import Tabs from '../components/ui/Tabs'
import Dropdown from '../components/ui/Dropdown'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import OrderTable from '../components/orders/OrderTable'
import { useOrderActions } from '../components/orders/useOrderActions'
import { ORDER_STATUS_OPTIONS, PAYMENT_STATUSES, stageShort, IN_PROGRESS_STATUSES } from '../data/constants'
import { formatNumber, formatCurrency } from '../utils/formatCurrency'
import { formatDate, toInputDate } from '../utils/formatDate'
import { exportCsv, exportExcel } from '../utils/exporters'

const SORT_VALUES = {
  customer: (o) => o.customer.name, garments: (o) => o.garmentCount, id: (o) => Number(o.id.replace(/\D/g, '')),
}
const getSortValue = (row, key) => (SORT_VALUES[key] ? SORT_VALUES[key](row) : row[key])

const EXPORT_COLUMNS = [
  { header: 'Order ID', value: (o) => o.id },
  { header: 'Customer', value: (o) => o.customer.name },
  { header: 'Phone', value: (o) => o.customer.phone },
  { header: 'Garments', value: (o) => o.garmentCount },
  { header: 'Services', value: (o) => o.serviceNames.join(', ') },
  { header: 'Priority', value: (o) => o.priority },
  { header: 'Received', value: (o) => formatDate(o.receivedAt) },
  { header: 'Due', value: (o) => formatDate(o.dueAt) },
  { header: 'Total (KES)', value: (o) => o.total },
  { header: 'Paid (KES)', value: (o) => o.amountPaid },
  { header: 'Balance (KES)', value: (o) => o.balance },
  { header: 'Status', value: (o) => stageShort(o.status) },
  { header: 'Payment', value: (o) => o.paymentStatus },
  { header: 'Assigned to', value: (o) => o.assignedName },
]

const EMPTY_FILTERS = { payment: '', service: '', staff: '', from: '', to: '', overdue: false }

export default function Orders() {
  const { can } = useAuth()
  const { business } = useSettings()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? 'all')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, overdue: params.get('overdue') === '1', payment: params.get('payment') ?? '' })
  const [showFilters, setShowFilters] = useState(params.get('overdue') === '1' || !!params.get('payment'))
  const q = useDebounce(query.trim().toLowerCase(), 200)

  const { data: orders, loading, error, reload } = useAsync(() => orderService.getOrders(), [], { live: true, watch: ['orders', 'payments'] })
  const { data: services } = useAsync(() => catalogService.getServices(), [])
  const { data: staff } = useAsync(() => staffService.getAssignableStaff(), [])
  const actions = useOrderActions()

  const all = useMemo(() => orders ?? [], [orders])
  const counts = useMemo(() => {
    const c = { all: 0, cancelled: 0 }
    all.forEach((o) => {
      c[o.status] = (c[o.status] || 0) + 1
      if (o.status !== 'cancelled') c.all += 1
    })
    return c
  }, [all])

  const filtered = useMemo(() => {
    const compact = q.replace(/\s/g, '')
    return all.filter((o) => {
      if (status === 'all' ? false : o.status !== status) return false
      if (status === 'all' && o.status === 'cancelled' && !q) return false
      if (q && !(o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(compact) || o.items.some((i) => i.name.toLowerCase().includes(q)))) return false
      if (filters.payment && o.paymentStatus !== filters.payment) return false
      if (filters.service && !o.items.some((i) => i.serviceId === filters.service)) return false
      if (filters.staff && o.assignedTo !== filters.staff) return false
      if (filters.from && toInputDate(o.receivedAt) < filters.from) return false
      if (filters.to && toInputDate(o.receivedAt) > filters.to) return false
      if (filters.overdue && !o.isOverdue) return false
      return true
    })
  }, [all, q, status, filters])

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length
  const table = useTable(filtered, { pageSize: 15, getSortValue, initialSort: { key: 'receivedAt', dir: 'desc' }, resetKey: JSON.stringify([q, status, filters]) })
  const exportRows = table.selected.size ? filtered.filter((o) => table.selected.has(o.id)) : table.sorted

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setQuery('')
    setStatus('all')
    setParams({})
  }

  const doExport = async (kind) => {
    if (!exportRows.length) return toast.error('There are no orders to export.')
    try {
      if (kind === 'xlsx') await exportExcel([{ name: 'Orders', rows: exportRows, columns: EXPORT_COLUMNS }], 'papa-hila-orders')
      else if (kind === 'csv') exportCsv(exportRows, EXPORT_COLUMNS, 'papa-hila-orders')
      else {
        const { downloadReportPdf } = await import('../utils/pdf')
        const cols = [0, 1, 4, 6, 7, 8, 10, 11]
        await downloadReportPdf({
          title: 'Orders Report',
          subtitle: `${exportRows.length} orders`,
          business,
          landscape: true,
          fileName: `papa-hila-orders-${toInputDate(new Date())}.pdf`,
          sections: [{
            title: `Orders (${exportRows.length})`,
            table: {
              head: cols.map((i) => EXPORT_COLUMNS[i].header),
              body: exportRows.map((o) => cols.map((i) => { const v = EXPORT_COLUMNS[i].value(o); return typeof v === 'number' ? formatCurrency(v) : String(v) })),
              foot: ['Total', '', '', '', '', formatCurrency(exportRows.reduce((s, o) => s + o.total, 0)), formatCurrency(exportRows.reduce((s, o) => s + o.balance, 0)), ''],
              align: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'left'],
            },
          }],
        })
      }
      toast.success(`Exported ${exportRows.length} order${exportRows.length > 1 ? 's' : ''}`)
    } catch (e) {
      console.error(e)
      toast.error('Export failed. Please try again.')
    }
  }

  const statusTabs = [
    { value: 'all', label: 'All active', count: counts.all },
    ...ORDER_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Track every laundry order from drop-off to delivery."
        actions={
          <>
            <Dropdown
              trigger={<Button variant="secondary" icon={Download}>Export{table.selected.size ? ` (${table.selected.size})` : ''}</Button>}
              items={[
                { heading: table.selected.size ? `${table.selected.size} selected orders` : `${filtered.length} filtered orders` },
                { label: 'Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => doExport('xlsx') },
                { label: 'CSV', icon: FileText, onClick: () => doExport('csv') },
                { label: 'PDF report', icon: FileText, onClick: () => doExport('pdf') },
              ]}
            />
            {can('orders.create') && <span className="hidden lg:block"><Button to="/orders/new" icon={Plus}>Create New Order</Button></span>}
          </>
        }
      />

      <section className="stat-strip grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="Order statistics">
        <MiniStat label="Total orders" value={formatNumber(counts.all)} icon={ClipboardList} tone="blue" sub="Excludes cancelled" />
        <MiniStat label="Pending" value={formatNumber(counts.received ?? 0)} icon={Hourglass} tone="amber" sub="Awaiting processing" />
        <MiniStat label="In progress" value={formatNumber(IN_PROGRESS_STATUSES.reduce((s, k) => s + (counts[k] ?? 0), 0))} icon={WashingMachine} tone="violet" sub="Washing · drying · ironing" />
        <MiniStat label="Ready for collection" value={formatNumber(counts.ready ?? 0)} icon={CheckCircle2} tone="cyan" sub="Notify customers" />
        <MiniStat label="Delivered" value={formatNumber(counts.delivered ?? 0)} icon={Truck} tone="green" sub="All time" />
      </section>

      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <Tabs variant="pills" tabs={statusTabs} value={status} onChange={setStatus} ariaLabel="Filter by status" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by order ID, customer, phone or garment…" className="flex-1" />
            <Button variant={showFilters || activeFilterCount ? 'soft' : 'secondary'} icon={Filter} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>
            {(activeFilterCount > 0 || q || status !== 'all') && <Button variant="ghost" icon={RotateCcw} onClick={resetFilters}>Reset</Button>}
          </div>
          {showFilters && (
            <div className="grid animate-fade-in gap-3 rounded-xl bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-6">
              <Select aria-label="Payment status" value={filters.payment} onChange={setFilter('payment')} placeholder="Any payment status" options={PAYMENT_STATUSES} />
              <Select aria-label="Service type" value={filters.service} onChange={setFilter('service')} placeholder="Any service" options={(services ?? []).map((s) => ({ value: s.id, label: s.name }))} />
              <Select aria-label="Assigned staff" value={filters.staff} onChange={setFilter('staff')} placeholder="Any staff member" options={(staff ?? []).map((s) => ({ value: s.id, label: s.name }))} />
              <Input type="date" aria-label="Received from" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} />
              <Input type="date" aria-label="Received to" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} />
              <div className="flex items-center rounded-lg border border-line bg-white px-3">
                <Checkbox label="Overdue only" checked={filters.overdue} onChange={setFilter('overdue')} />
              </div>
            </div>
          )}
          {table.selected.size > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-sky-soft px-3 py-2 text-[13px]">
              <span className="font-semibold text-brand">{table.selected.size} order{table.selected.size > 1 ? 's' : ''} selected</span>
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" icon={FileSpreadsheet} onClick={() => doExport('xlsx')}>Export selected</Button>
                <Button size="xs" variant="ghost" icon={X} onClick={table.clearSelection}>Clear</Button>
              </div>
            </div>
          )}
        </div>
        {error && !orders ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <OrderTable
            rows={filtered}
            table={table}
            loading={loading && !orders}
            selectable
            actions={(o) => actions.itemsFor(o)}
            empty={
              <EmptyState
                icon={ClipboardList}
                title={all.length ? 'No orders match your filters' : 'No orders yet'}
                description={all.length ? 'Try a different search term or clear the filters.' : 'Create your first laundry order to get started.'}
                action={all.length ? <Button variant="secondary" icon={RotateCcw} onClick={resetFilters}>Clear filters</Button> : can('orders.create') && <Button to="/orders/new" icon={Plus}>Create order</Button>}
              />
            }
          />
        )}
      </Card>
      {actions.modals}
    </div>
  )
}
