import { useNavigate } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import DataTable from '../ui/DataTable'
import Dropdown from '../ui/Dropdown'
import { useTable } from '../../hooks/useTable'
import { OrderStatusBadge, OverdueBadge, PaymentStatusBadge, PriorityBadge } from '../shared/StatusBadges'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate, formatTime } from '../../utils/formatDate'
import { displayPhone } from '../../utils/validators'

const SORT = {
  customer: (o) => o.customer.name,
  garments: (o) => o.garmentCount,
  weight: (o) => o.weightKg,
  receivedAt: (o) => o.receivedAt,
  dueAt: (o) => o.dueAt,
  total: (o) => o.total,
  amountPaid: (o) => o.amountPaid,
  balance: (o) => o.balance,
  status: (o) => o.status,
  id: (o) => Number(o.id.replace(/\D/g, '')),
}
const getSortValue = (row, key) => (SORT[key] ? SORT[key](row) : row[key])

/**
 * variant: 'full' (orders page) | 'compact' (dashboard, profiles)
 * actions: function(order) => dropdown items (from useOrderActions)
 * table:   optional external table (usePagedQuery for server-side pages). Columns
 *          are only sortable with the built-in client-side table.
 */
export default function OrderTable({ rows, loading, table: externalTable, variant = 'full', actions, selectable = false, empty, hideCustomer = false, showFinance = true, pageSize = 10 }) {
  const navigate = useNavigate()
  const internal = useTable(rows ?? [], { pageSize, getSortValue, initialSort: { key: 'receivedAt', dir: 'desc' } })
  const table = externalTable ?? internal
  const full = variant === 'full'
  const sortable = !externalTable

  const columns = [
    {
      key: 'id', header: 'Order', sortable,
      render: (o) => (
        <div>
          <p className="font-mono text-[12.5px] font-bold text-ink">{o.id}</p>
          {o.priority !== 'normal' && <div className="mt-1"><PriorityBadge priority={o.priority} /></div>}
        </div>
      ),
    },
    !hideCustomer && {
      key: 'customer', header: 'Customer', sortable,
      render: (o) => (
        <div className="max-w-[180px]">
          <p className="truncate font-semibold text-ink">{o.customer.name}</p>
          <p className="text-xs text-muted">{displayPhone(o.customer.phone)}</p>
        </div>
      ),
    },
    { key: 'weight', header: 'Weight', sortable, align: 'right', hideBelow: 'md', render: (o) => <span className="font-semibold tabular-nums">{o.weightKg} kg</span> },
    full && { key: 'garments', header: 'Pieces', sortable, align: 'center', render: (o) => <span className="tabular-nums text-slate-600">{o.garmentCount}</span>, hideBelow: 'lg' },
    {
      key: 'service', header: 'Service', hideBelow: 'xl',
      render: (o) => (
        <div className="max-w-[160px]">
          <p className="truncate text-[13px] text-slate-700">{o.serviceName}</p>
          {o.deliveryAt && <p className="text-[11px] text-muted">Delivery {formatDate(o.deliveryAt)}</p>}
        </div>
      ),
    },
    { key: 'receivedAt', header: 'Received', sortable, hideBelow: 'md', render: (o) => <div><p className="text-[13px]">{formatDate(o.receivedAt)}</p><p className="text-[11px] text-muted">{formatTime(o.receivedAt)}</p></div> },
    {
      key: 'dueAt', header: 'Due', sortable, hideBelow: 'sm',
      render: (o) => (
        <div>
          <p className={`text-[13px] ${o.isOverdue ? 'font-semibold text-red-600' : ''}`}>{formatDate(o.dueAt)}</p>
          {o.isOverdue ? <OverdueBadge /> : <p className="text-[11px] text-muted">{formatTime(o.dueAt)}</p>}
        </div>
      ),
    },
    { key: 'total', header: 'Total', sortable, align: 'right', render: (o) => <span className="font-semibold text-ink">{formatCurrency(o.total)}</span> },
    full && showFinance && { key: 'amountPaid', header: 'Paid', sortable, align: 'right', hideBelow: 'xl', render: (o) => <span className="text-slate-600">{formatCurrency(o.amountPaid)}</span> },
    full && { key: 'balance', header: 'Balance', sortable, align: 'right', hideBelow: 'lg', render: (o) => <span className={o.balance > 0 && o.status !== 'cancelled' ? 'font-semibold text-red-600' : 'text-slate-400'}>{formatCurrency(o.balance)}</span> },
    { key: 'status', header: 'Status', sortable, render: (o) => <OrderStatusBadge status={o.status} /> },
    { key: 'paymentStatus', header: 'Payment', render: (o) => <PaymentStatusBadge status={o.paymentStatus} />, hideBelow: 'sm' },
    actions && {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right', className: 'w-12',
      render: (o) => (
        <Dropdown
          items={actions(o)}
          trigger={
            <button type="button" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${o.id}`} onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal size={18} />
            </button>
          }
        />
      ),
    },
  ].filter(Boolean)

  return (
    <DataTable
      columns={columns}
      table={table}
      loading={loading}
      selectable={selectable}
      onRowClick={(o) => navigate(`/orders/${o.id}`)}
      getRowLabel={(o) => `Open order ${o.id} for ${o.customer.name}`}
      rowClassName={(o) => (o.status === 'cancelled' ? 'opacity-60' : '')}
      empty={empty}
      mobileCard={{
        title: (o) => (hideCustomer ? <span className="font-mono text-[13.5px]">{o.id}</span> : o.customer.name),
        subtitle: (o) => (
          <>
            {!hideCustomer && <span className="font-mono font-semibold text-slate-600">{o.id}</span>}
            {!hideCustomer && ' · '}
            {o.weightKg} kg · {o.garmentCount} item{o.garmentCount === 1 ? '' : 's'}
          </>
        ),
        meta: (o) => (
          <>
            {o.isOverdue ? <OverdueBadge /> : o.status !== 'delivered' && o.status !== 'cancelled' ? <span>Due {formatDate(o.dueAt)}, {formatTime(o.dueAt)}</span> : <span>{formatDate(o.receivedAt)}</span>}
            {o.priority !== 'normal' && <PriorityBadge priority={o.priority} />}
            {showFinance && o.balance > 0 && o.status !== 'cancelled' && <span className="font-semibold text-red-600">Bal. {formatCurrency(o.balance, { decimals: 0 })}</span>}
          </>
        ),
        value: (o) => formatCurrency(o.total, { decimals: 0 }),
        badge: (o) => <OrderStatusBadge status={o.status} size="sm" />,
      }}
    />
  )
}
