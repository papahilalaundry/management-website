import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Download, FileSpreadsheet, FileText, Filter, Hourglass, Plus, RotateCcw, TriangleAlert, Truck, WashingMachine, X } from 'lucide-react'
import { toast } from 'sonner'
import { catalogService, orderService, staffService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { usePagedQuery } from '../hooks/usePagedQuery'
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
import { formatDate, formatDateTime, toInputDate } from '../utils/formatDate'
import { exportCsv, exportExcel } from '../utils/exporters'

const EXPORT_COLUMNS = [
  { header: 'Order ID', value: (o) => o.id },
  { header: 'Client', value: (o) => o.customer.name },
  { header: 'Phone', value: (o) => o.customer.phone },
  { header: 'Services', value: (o) => o.serviceSummary || (o.serviceNames ?? []).join(', ') },
  { header: 'Weight (kg)', value: (o) => o.weightKg || 0 },
  { header: 'Garments', value: (o) => o.garmentCount },
  { header: 'Priority', value: (o) => o.priority },
  { header: 'Received', value: (o) => formatDate(o.receivedAt) },
  { header: 'Due', value: (o) => formatDate(o.dueAt) },
  { header: 'Delivery date', value: (o) => (o.deliveryAt ? formatDateTime(o.deliveryAt) : '') },
  { header: 'Delivered', value: (o) => (o.deliveredAt ? formatDateTime(o.deliveredAt) : '') },
  { header: 'Total (KES)', value: (o) => o.total },
  { header: 'Paid (KES)', value: (o) => o.amountPaid },
  { header: 'Balance (KES)', value: (o) => o.balance },
  { header: 'Status', value: (o) => stageShort(o.status) },
  { header: 'Payment', value: (o) => o.paymentStatus },
  { header: 'Assigned to', value: (o) => o.assignedName },
  { header: 'Feedback rating', value: (o) => o.feedback?.rating ?? '' },
  { header: 'Feedback', value: (o) => o.feedback?.comment ?? '' },
]

const EMPTY_FILTERS = { payment: '', service: '', staff: '', from: '', to: '', overdue: false }
const WATCH = ['orders', 'payments']
const dayStart = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined)
const dayEnd = (d) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined)

export default function Orders() {
  const { can } = useAuth()
  const { business } = useSettings()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? 'all')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, overdue: params.get('overdue') === '1', payment: params.get('payment') ?? '' })
  const [showFilters, setShowFilters] = useState(params.get('overdue') === '1' || !!params.get('payment'))
  const [exporting, setExporting] = useState(false)
  const q = useDebounce(query.trim(), 300)

  // Filters in the shape the order service expects.
  const queryFilters = useMemo(() => ({
    status,
    payment: filters.payment || undefined,
    service: filters.service || undefined,
    staff: filters.staff || undefined,
    from: dayStart(filters.from),
    to: dayEnd(filters.to),
  }), [status, filters])
  const overdue = filters.overdue
  const key = JSON.stringify([queryFilters, q, overdue])

  const paged = usePagedQuery(
    ({ pageSize, cursor }) => orderService.listOrders({ ...queryFilters, search: q, overdue, pageSize, cursor }),
    { key, pageSize: 15, count: q || overdue ? undefined : () => orderService.countOrders(queryFilters), watch: WATCH },
  )
  const { data: counts } = useAsync(() => orderService.getStatusCounts(), [], { live: true, watch: WATCH })
  const { data: services } = useAsync(() => catalogService.getServices(), [])
  const { data: staff } = useAsync(() => staffService.getAssignableStaff(), [])
  const actions = useOrderActions({ onChanged: () => paged.reload() })

  const c = counts ?? {}
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length
  const anyFilter = activeFilterCount > 0 || !!q || status !== 'all'
  const selectedRows = paged.pageRows.filter((o) => paged.selected.has(o.id))

  const setFilter = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS)
    setQuery('')
    setStatus('all')
    setParams({})
  }

  const doExport = async (kind) => {
    setExporting(true)
    try {
      const rows = selectedRows.length ? selectedRows : await orderService.exportOrders({ ...queryFilters, search: q, overdue })
      if (!rows.length) return toast.error('There are no orders to export.')
      if (kind === 'xlsx') await exportExcel([{ name: 'Orders', rows, columns: EXPORT_COLUMNS }], 'papa-hila-orders')
      else if (kind === 'csv') exportCsv(rows, EXPORT_COLUMNS, 'papa-hila-orders')
      else {
        const { downloadReportPdf } = await import('../utils/pdf')
        const cols = ['Order ID', 'Client', 'Services', 'Garments', 'Received', 'Due', 'Total (KES)', 'Balance (KES)', 'Status']
        const defs = cols.map((h) => EXPORT_COLUMNS.find((col) => col.header === h))
        await downloadReportPdf({
          title: 'Orders Report',
          subtitle: `${rows.length} orders`,
          business,
          landscape: true,
          fileName: `papa-hila-orders-${toInputDate(new Date())}.pdf`,
          sections: [{
            title: `Orders (${rows.length})`,
            table: {
              head: cols,
              body: rows.map((o) => defs.map((d) => { const v = d.value(o); return d.header.includes('KES') ? formatCurrency(v) : String(v) })),
              foot: ['Total', '', `${Math.round(rows.reduce((s, o) => s + (o.weightKg || 0), 0) * 10) / 10} kg laundry`, String(rows.reduce((s, o) => s + o.garmentCount, 0)), '', '', formatCurrency(rows.reduce((s, o) => s + o.total, 0)), formatCurrency(rows.reduce((s, o) => s + o.balance, 0)), ''],
              align: ['left', 'left', 'left', 'right', 'left', 'left', 'right', 'right', 'left'],
            },
          }],
        })
      }
      toast.success(`Exported ${rows.length} order${rows.length > 1 ? 's' : ''}`)
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const statusTabs = [
    { value: 'all', label: 'All active', count: c.all },
    ...ORDER_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label, count: c[s.value] })),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Track every laundry order from drop-off to delivery."
        actions={
          <>
            <Dropdown
              trigger={<Button variant="secondary" icon={Download} loading={exporting}>Export{paged.selected.size ? ` (${selectedRows.length})` : ''}</Button>}
              items={[
                { heading: selectedRows.length ? `${selectedRows.length} selected orders` : anyFilter ? 'All orders matching the filters' : 'All orders' },
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
        <MiniStat label="Total orders" value={counts ? formatNumber(c.all) : '—'} icon={ClipboardList} tone="blue" sub="Excludes cancelled" />
        <MiniStat label="Pending" value={counts ? formatNumber(c.received ?? 0) : '—'} icon={Hourglass} tone="amber" sub="Awaiting processing" />
        <MiniStat label="In progress" value={counts ? formatNumber(IN_PROGRESS_STATUSES.reduce((s, k) => s + (c[k] ?? 0), 0)) : '—'} icon={WashingMachine} tone="violet" sub="Washing · drying · ironing" />
        <MiniStat label="Ready for collection" value={counts ? formatNumber(c.ready ?? 0) : '—'} icon={CheckCircle2} tone="cyan" sub="Notify clients" />
        <MiniStat label="Delivered" value={counts ? formatNumber(c.delivered ?? 0) : '—'} icon={Truck} tone="green" sub="All time" />
      </section>

      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <Tabs variant="pills" tabs={statusTabs} value={status} onChange={setStatus} ariaLabel="Filter by status" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by order ID, phone or client name…" className="flex-1" />
            <Button variant={showFilters || activeFilterCount ? 'soft' : 'secondary'} icon={Filter} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </Button>
            {anyFilter && <Button variant="ghost" icon={RotateCcw} onClick={resetFilters}>Reset</Button>}
          </div>
          {showFilters && (
            <div className="grid animate-fade-in gap-3 rounded-xl bg-slate-50/80 p-3 sm:grid-cols-2 lg:grid-cols-6">
              <Select aria-label="Payment status" value={filters.payment} onChange={setFilter('payment')} placeholder="Any payment status" options={PAYMENT_STATUSES} />
              <Select aria-label="Service" value={filters.service} onChange={setFilter('service')} placeholder="Any service" options={(services ?? []).map((s) => ({ value: s.id, label: s.name }))} />
              <Select aria-label="Assigned staff" value={filters.staff} onChange={setFilter('staff')} placeholder="Any staff member" options={(staff ?? []).map((s) => ({ value: s.id, label: s.name }))} />
              <Input type="date" aria-label="Received from" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} />
              <Input type="date" aria-label="Received to" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} />
              <div className="flex items-center rounded-lg border border-line bg-white px-3">
                <Checkbox label={`Overdue only${counts?.overdue ? ` (${c.overdue})` : ''}`} checked={filters.overdue} onChange={setFilter('overdue')} />
              </div>
            </div>
          )}
          {q && <p className="text-xs text-muted">Showing search results{status !== 'all' ? ` in “${statusTabs.find((t) => t.value === status)?.label}”` : ' (including cancelled orders)'}.</p>}
          {overdue && !q && counts?.overdue > 0 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-red-600"><TriangleAlert size={13} /> {c.overdue} open order{c.overdue === 1 ? ' is' : 's are'} past the expected completion time — oldest first.</p>
          )}
          {selectedRows.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-sky-soft px-3 py-2 text-[13px]">
              <span className="font-semibold text-brand">{selectedRows.length} order{selectedRows.length > 1 ? 's' : ''} selected on this page</span>
              <div className="flex gap-2">
                <Button size="xs" variant="secondary" icon={FileSpreadsheet} onClick={() => doExport('xlsx')}>Export selected</Button>
                <Button size="xs" variant="ghost" icon={X} onClick={paged.clearSelection}>Clear</Button>
              </div>
            </div>
          )}
        </div>
        {paged.error && !paged.pageRows.length ? (
          <ErrorState error={paged.error} onRetry={paged.reload} />
        ) : (
          <OrderTable
            rows={paged.pageRows}
            table={paged}
            loading={paged.loading && !paged.pageRows.length}
            selectable
            actions={(o) => actions.itemsFor(o)}
            empty={
              <EmptyState
                icon={ClipboardList}
                title={anyFilter ? 'No orders match your filters' : 'No orders yet'}
                description={anyFilter ? 'Try a different search term or clear the filters.' : 'Create your first laundry order to get started.'}
                action={anyFilter ? <Button variant="secondary" icon={RotateCcw} onClick={resetFilters}>Clear filters</Button> : can('orders.create') && <Button to="/orders/new" icon={Plus}>Create order</Button>}
              />
            }
          />
        )}
      </Card>
      {actions.modals}
    </div>
  )
}
