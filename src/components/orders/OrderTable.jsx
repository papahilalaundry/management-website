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
 */
export default function OrderTable({ rows, loading, table: externalTable, variant = 'full', actions, selectable = false, empty, hideCustomer = false, showFinance = true, pageSize = 10 }) {
  const navigate = useNavigate()
  const internal = useTable(rows ?? [], { pageSize, getSortValue, initialSort: { key: 'receivedAt', dir: 'desc' } })
  const table = externalTable ?? internal
  const full = variant === 'full'

  const columns = [
    {
      key: 'id', header: 'Order', sortable: true,
      render: (o) => (
        <div>
          <p className="font-mono text-[12.5px] font-bold text-ink">{o.id}</p>
          {o.priority !== 'normal' && <div className="mt-1"><PriorityBadge priority={o.priority} /></div>}
        </div>
      ),
    },
    !hideCustomer && {
      key: 'customer', header: 'Customer', sortable: true,
      render: (o) => (
        <div className="max-w-[180px]">
          <p className="truncate font-semibold text-ink">{o.customer.name}</p>
          <p className="text-xs text-muted">{displayPhone(o.customer.phone)}</p>
        </div>
      ),
    },
    full && { key: 'garments', header: 'Items', sortable: true, align: 'center', render: (o) => <span className="font-semibold tabular-nums">{o.garmentCount}</span>, hideBelow: 'md' },
    {
      key: 'service', header: 'Service', hideBelow: 'lg',
      render: (o) => (
        <div className="max-w-[160px]">
          <p className="truncate text-[13px] text-slate-700">{o.serviceNames[0]}</p>
          {o.serviceNames.length > 1 && <p className="text-[11px] text-muted">+{o.serviceNames.length - 1} more</p>}
        </div>
      ),
    },
    { key: 'receivedAt', header: 'Received', sortable: true, hideBelow: 'md', render: (o) => <div><p className="text-[13px]">{formatDate(o.receivedAt)}</p><p className="text-[11px] text-muted">{formatTime(o.receivedAt)}</p></div> },
    {
      key: 'dueAt', header: 'Due', sortable: true, hideBelow: 'sm',
      render: (o) => (
        <div>
          <p className={`text-[13px] ${o.isOverdue ? 'font-semibold text-red-600' : ''}`}>{formatDate(o.dueAt)}</p>
          {o.isOverdue ? <OverdueBadge /> : <p className="text-[11px] text-muted">{formatTime(o.dueAt)}</p>}
        </div>
      ),
    },
    { key: 'total', header: 'Total', sortable: true, align: 'right', render: (o) => <span className="font-semibold text-ink">{formatCurrency(o.total)}</span> },
    full && showFinance && { key: 'amountPaid', header: 'Paid', sortable: true, align: 'right', hideBelow: 'xl', render: (o) => <span className="text-slate-600">{formatCurrency(o.amountPaid)}</span> },
    full && { key: 'balance', header: 'Balance', sortable: true, align: 'right', hideBelow: 'lg', render: (o) => <span className={o.balance > 0 && o.status !== 'cancelled' ? 'font-semibold text-red-600' : 'text-slate-400'}>{formatCurrency(o.balance)}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (o) => <OrderStatusBadge status={o.status} /> },
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
    />
  )
}
