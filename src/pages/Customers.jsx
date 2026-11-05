import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Download, Eye, FileSpreadsheet, FileText, HandCoins, MoreHorizontal, Pencil, Plus, Repeat, Sparkles, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { customerService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { usePagedQuery } from '../hooks/usePagedQuery'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import SearchInput from '../components/ui/SearchInput'
import { Checkbox } from '../components/ui/Field'
import Tabs from '../components/ui/Tabs'
import DataTable from '../components/ui/DataTable'
import Dropdown from '../components/ui/Dropdown'
import Avatar from '../components/ui/Avatar'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { ClientTypeBadge } from '../components/shared/StatusBadges'
import CustomerFormModal from '../components/customers/CustomerFormModal'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, timeAgo } from '../utils/formatDate'
import { displayPhone } from '../utils/validators'
import { exportCsv, exportExcel } from '../utils/exporters'
import { clientTypeLabel } from '../data/constants'

/** "~9 days" or "—" when the client has fewer than two visits. */
const intervalLabel = (days) => (days == null ? '—' : days < 1 ? 'Same day' : `~${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`)

const EXPORT_COLUMNS = [
  { header: 'Customer ID', value: (c) => c.id },
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => displayPhone(c.phone) },
  { header: 'Client type', value: (c) => clientTypeLabel(c.clientType) },
  { header: 'Visits', value: (c) => c.orderCount ?? 0 },
  { header: 'Brings laundry every (days)', value: (c) => (c.avgIntervalDays == null ? '' : c.avgIntervalDays) },
  { header: 'First visit', value: (c) => (c.firstOrderAt ? formatDate(c.firstOrderAt) : '') },
  { header: 'Last visit', value: (c) => (c.lastOrderAt ? formatDate(c.lastOrderAt) : '') },
  { header: 'Total billed (KES)', value: (c) => c.totalBilled ?? 0 },
  { header: 'Total paid (KES)', value: (c) => c.totalSpent ?? 0 },
  { header: 'Outstanding (KES)', value: (c) => c.outstanding ?? 0 },
  { header: 'Email', value: (c) => c.email },
  { header: 'Address', value: (c) => c.address },
  { header: 'Registered', value: (c) => formatDate(c.createdAt) },
]
const WATCH = ['customers', 'orders', 'payments']

export default function Customers() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const finance = can('finance.view')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [withBalance, setWithBalance] = useState(false)
  const [modal, setModal] = useState(null) // { customer? }
  const search = useDebounce(query.trim(), 300)

  const { data: stats } = useAsync(() => customerService.getCustomerStats(), [], { live: true, watch: WATCH })
  const filters = { type, withBalance }
  const fetchPage = useCallback(
    ({ pageSize, cursor }) => customerService.listCustomers({ type, withBalance, search, pageSize, cursor }),
    [type, withBalance, search],
  )
  const table = usePagedQuery(fetchPage, {
    key: JSON.stringify([type, withBalance, search]),
    pageSize: 15,
    count: () => customerService.countCustomers({ type, withBalance }),
    watch: WATCH,
  })

  const doExport = async (kind) => {
    try {
      const rows = search ? table.pageRows : await customerService.exportCustomers(filters)
      if (!rows.length) return toast.error('There are no customers to export.')
      if (kind === 'xlsx') await exportExcel([{ name: 'Customers', rows, columns: EXPORT_COLUMNS }], 'papa-hila-customers')
      else exportCsv(rows, EXPORT_COLUMNS, 'papa-hila-customers')
      toast.success(`Exported ${rows.length} customers`)
    } catch (e) {
      toast.error(e.message || 'Export failed. Please try again.')
    }
  }

  const columns = [
    {
      key: 'name', header: 'Client',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold text-ink">{c.name} <ClientTypeBadge type={c.clientType} size="sm" /></p>
            <p className="truncate font-mono text-[11px] text-muted">{c.id}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', hideBelow: 'sm', render: (c) => <span className="tabular-nums text-slate-700">{displayPhone(c.phone)}</span> },
    { key: 'orderCount', header: 'Visits', align: 'center', render: (c) => <span className="font-semibold">{c.orderCount ?? 0}</span> },
    { key: 'avgIntervalDays', header: 'Brings laundry every', hideBelow: 'md', render: (c) => <span className={c.avgIntervalDays == null ? 'text-slate-300' : 'text-slate-700'}>{intervalLabel(c.avgIntervalDays)}</span> },
    {
      key: 'lastOrderAt', header: 'Last visit', hideBelow: 'lg',
      render: (c) => (c.lastOrderAt ? <div><p className="text-[13px] text-slate-700">{formatDate(c.lastOrderAt)}</p><p className="text-[11px] text-muted">{timeAgo(c.lastOrderAt)}</p></div> : <span className="text-slate-300">No visits yet</span>),
    },
    finance && { key: 'totalSpent', header: 'Total paid', align: 'right', hideBelow: 'md', render: (c) => formatCurrency(c.totalSpent ?? 0, { decimals: 0 }) },
    { key: 'outstanding', header: 'Balance', align: 'right', render: (c) => <span className={c.outstanding > 0 ? 'font-semibold text-red-600' : 'text-slate-400'}>{formatCurrency(c.outstanding ?? 0, { decimals: 0 })}</span> },
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

  const tabs = [
    { value: '', label: 'All clients', count: stats?.total },
    { value: 'new', label: 'New clients', count: stats?.new },
    { value: 'regular', label: 'Regular clients', count: stats?.regular },
  ]
  const filtering = !!(search || type || withBalance)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who brings their laundry to Papa Hila — new and regular clients."
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

      <section className="stat-strip grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Customer statistics">
        <MiniStat label="Total clients" value={stats ? formatNumber(stats.total) : '—'} icon={Users} tone="blue" />
        <MiniStat label="New clients" value={stats ? formatNumber(stats.new) : '—'} icon={Sparkles} tone="cyan" sub="One visit or none yet" />
        <MiniStat label="Regular clients" value={stats ? formatNumber(stats.regular) : '—'} icon={Repeat} tone="violet" sub="Two or more visits" />
        <MiniStat label="With outstanding balances" value={stats ? formatNumber(stats.withBalance) : '—'} icon={HandCoins} tone="red" sub={finance && stats ? `${formatCurrency(stats.outstanding, { decimals: 0 })} owed` : undefined} />
      </section>

      <Card>
        <div className="space-y-3 border-b border-line p-4">
          <Tabs variant="pills" tabs={tabs} value={type} onChange={setType} ariaLabel="Filter by client type" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={query} onChange={setQuery} placeholder="Search by name, phone or customer ID…" className="flex-1" />
            <div className="flex h-10 items-center rounded-lg border border-line bg-white px-3">
              <Checkbox label="With balance only" checked={withBalance} onChange={(e) => setWithBalance(e.target.checked)} />
            </div>
          </div>
          {withBalance && !search && <p className="text-xs text-muted">Sorted by largest balance first.</p>}
        </div>
        {table.error && !table.loaded ? (
          <ErrorState error={table.error} onRetry={table.reload} />
        ) : (
          <DataTable
            columns={columns}
            table={table}
            loading={table.loading && !table.pageRows.length}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            getRowLabel={(c) => `Open profile for ${c.name}`}
            mobileCard={{
              leading: (c) => <Avatar name={c.name} size="md" />,
              title: (c) => c.name,
              subtitle: (c) => <span className="tabular-nums">{displayPhone(c.phone)}</span>,
              meta: (c) => (
                <span>
                  {c.orderCount ?? 0} visit{c.orderCount === 1 ? '' : 's'}
                  {c.avgIntervalDays != null ? ` · every ${intervalLabel(c.avgIntervalDays)}` : ''}
                  {c.lastOrderAt ? ` · last ${timeAgo(c.lastOrderAt)}` : ''}
                </span>
              ),
              value: (c) => (c.outstanding > 0 ? <span className="text-red-600">{formatCurrency(c.outstanding, { decimals: 0 })}</span> : null),
              badge: (c) => <ClientTypeBadge type={c.clientType} size="sm" />,
            }}
            empty={
              <EmptyState
                icon={Users}
                title={filtering ? 'No customers match your search' : 'No customers yet'}
                description={filtering ? 'Try a different name, phone number or filter.' : 'Add your first customer to get started.'}
                action={!filtering && can('customers.create') && <Button icon={Plus} onClick={() => setModal({})}>Add customer</Button>}
              />
            }
          />
        )}
      </Card>

      <CustomerFormModal open={!!modal} customer={modal?.customer} onClose={() => setModal(null)} onSaved={(c) => !modal?.customer && navigate(`/customers/${c.id}`)} />
    </div>
  )
}
