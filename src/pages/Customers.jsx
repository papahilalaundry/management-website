import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startOfMonth, subDays } from 'date-fns'
import { ClipboardList, Download, Eye, FileSpreadsheet, FileText, HandCoins, MoreHorizontal, Pencil, Plus, UserCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { customerService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useTable } from '../hooks/useTable'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
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
import CustomerFormModal from '../components/customers/CustomerFormModal'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'
import { exportCsv, exportExcel } from '../utils/exporters'

const FILTERS = [
  { value: 'outstanding', label: 'With outstanding balance' },
  { value: 'active', label: 'Active (ordered in last 60 days)' },
  { value: 'new', label: 'New this month' },
  { value: 'inactive', label: 'Inactive (no orders in 60 days)' },
]
const EXPORT_COLUMNS = [
  { header: 'Customer ID', value: (c) => c.id },
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => displayPhone(c.phone) },
  { header: 'Email', value: (c) => c.email },
  { header: 'Address', value: (c) => c.address },
  { header: 'Total orders', value: (c) => c.totalOrders },
  { header: 'Total spent (KES)', value: (c) => c.totalSpent },
  { header: 'Outstanding (KES)', value: (c) => c.outstanding },
  { header: 'Last order', value: (c) => formatDate(c.lastOrderAt) },
  { header: 'Registered', value: (c) => formatDate(c.createdAt) },
]

export default function Customers() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const finance = can('finance.view')
  const { data, loading, error, reload } = useAsync(() => customerService.getCustomers(), [], { live: true, watch: ['customers', 'orders', 'payments'] })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [modal, setModal] = useState(null) // { customer? }
  const q = useDebounce(query.trim().toLowerCase(), 200)

  const customers = useMemo(() => data ?? [], [data])
  const thresholds = useMemo(() => ({ month: startOfMonth(new Date()).toISOString(), active: subDays(new Date(), 60).toISOString() }), [])
  const stats = useMemo(() => ({
    total: customers.length,
    newThisMonth: customers.filter((c) => c.createdAt >= thresholds.month).length,
    active: customers.filter((c) => c.lastOrderAt && c.lastOrderAt >= thresholds.active).length,
    outstanding: customers.filter((c) => c.outstanding > 0).length,
    outstandingAmount: customers.reduce((s, c) => s + c.outstanding, 0),
  }), [customers, thresholds])

  const filtered = useMemo(() => {
    const compact = q.replace(/\s/g, '')
    return customers.filter((c) => {
      if (q && !(c.name.toLowerCase().includes(q) || c.phone.includes(compact) || c.id.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))) return false
      if (filter === 'outstanding') return c.outstanding > 0
      if (filter === 'active') return c.lastOrderAt && c.lastOrderAt >= thresholds.active
      if (filter === 'inactive') return !c.lastOrderAt || c.lastOrderAt < thresholds.active
      if (filter === 'new') return c.createdAt >= thresholds.month
      return true
    })
  }, [customers, q, filter, thresholds])

  const table = useTable(filtered, { pageSize: 15, initialSort: { key: 'lastOrderAt', dir: 'desc' }, resetKey: `${q}|${filter}` })

  const doExport = async (kind) => {
    try {
      if (kind === 'xlsx') await exportExcel([{ name: 'Customers', rows: table.sorted, columns: EXPORT_COLUMNS }], 'papa-hila-customers')
      else exportCsv(table.sorted, EXPORT_COLUMNS, 'papa-hila-customers')
      toast.success(`Exported ${table.sorted.length} customers`)
    } catch {
      toast.error('Export failed. Please try again.')
    }
  }

  const columns = [
    { key: 'id', header: 'ID', sortable: true, render: (c) => <span className="font-mono text-xs font-semibold text-slate-500">{c.id}</span> },
    {
      key: 'name', header: 'Customer', sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{c.name}</p>
            <p className="truncate text-xs text-muted sm:hidden">{displayPhone(c.phone)}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideBelow: 'sm', render: (c) => <span className="tabular-nums text-slate-700">{displayPhone(c.phone)}</span> },
    { key: 'email', header: 'Email', hideBelow: 'xl', render: (c) => c.email ? <span className="text-slate-600">{c.email}</span> : <span className="text-slate-300">—</span> },
    { key: 'totalOrders', header: 'Orders', sortable: true, align: 'center', render: (c) => <span className="font-semibold">{c.totalOrders}</span> },
    finance && { key: 'totalSpent', header: 'Total spent', sortable: true, align: 'right', hideBelow: 'md', render: (c) => formatCurrency(c.totalSpent, { decimals: 0 }) },
    { key: 'outstanding', header: 'Outstanding', sortable: true, align: 'right', render: (c) => <span className={c.outstanding > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>{formatCurrency(c.outstanding, { decimals: 0 })}</span> },
    { key: 'lastOrderAt', header: 'Last order', sortable: true, hideBelow: 'lg', render: (c) => (c.lastOrderAt ? <span className="text-slate-600">{timeAgo(c.lastOrderAt)}</span> : <span className="text-slate-300">Never</span>) },
    { key: 'createdAt', header: 'Registered', sortable: true, hideBelow: 'lg', render: (c) => <span className="text-slate-600">{formatDate(c.createdAt)}</span> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (c) => (
        <Dropdown
          items={[
            { label: 'View profile', icon: Eye, onClick: () => navigate(`/customers/${c.id}`) },
            { label: 'Edit details', icon: Pencil, onClick: () => setModal({ customer: c }), hidden: !can('customers.edit') },
            { label: 'New order', icon: ClipboardList, onClick: () => navigate(`/orders/new?customer=${c.id}`), hidden: !can('orders.create') },
          ]}
          trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${c.name}`}><MoreHorizontal size={18} /></button>}
        />
      ),
    },
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who brings their laundry to Papa Hila."
        actions={
          <>
            <Dropdown
              trigger={<Button variant="secondary" icon={Download}>Export</Button>}
              items={[
                { label: 'Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => doExport('xlsx') },
                { label: 'CSV', icon: FileText, onClick: () => doExport('csv') },
              ]}
            />
            {can('customers.create') && <Button icon={UserPlus} onClick={() => setModal({})}>Add customer</Button>}
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Customer statistics">
        <MiniStat label="Total customers" value={formatNumber(stats.total)} icon={Users} tone="blue" />
        <MiniStat label="New this month" value={formatNumber(stats.newThisMonth)} icon={UserPlus} tone="violet" />
        <MiniStat label="Active (60 days)" value={formatNumber(stats.active)} icon={UserCheck} tone="green" />
        <MiniStat label="With outstanding balances" value={formatNumber(stats.outstanding)} icon={HandCoins} tone="red" sub={finance ? `${formatCurrency(stats.outstandingAmount, { decimals: 0 })} owed` : undefined} />
      </section>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name, phone, email or ID…" className="flex-1" />
          <Select aria-label="Filter customers" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="All customers" options={FILTERS} className="sm:w-64" />
        </div>
        {error && !data ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <DataTable
            columns={columns}
            table={table}
            loading={loading && !data}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            getRowLabel={(c) => `Open profile for ${c.name}`}
            empty={
              <EmptyState
                icon={Users}
                title={customers.length ? 'No customers match your search' : 'No customers yet'}
                description={customers.length ? 'Try a different name or phone number.' : 'Add your first customer to get started.'}
                action={can('customers.create') && <Button icon={Plus} onClick={() => setModal({})}>Add customer</Button>}
              />
            }
          />
        )}
      </Card>

      <CustomerFormModal open={!!modal} customer={modal?.customer} onClose={() => setModal(null)} onSaved={(c) => !modal?.customer && navigate(`/customers/${c.id}`)} />
    </div>
  )
}
