import { Banknote, Building2, Clock, Repeat, Smartphone, Sparkles, Star, Zap, TriangleAlert } from 'lucide-react'
import { STATUS_META } from '../../data/statusMeta'
import Badge from '../ui/Badge'
import { stageShort } from '../../data/constants'


export function OrderStatusBadge({ status, size }) {
  const meta = STATUS_META[status] ?? STATUS_META.received
  return (
    <Badge tone={meta.tone} dot size={size}>
      {stageShort(status)}
    </Badge>
  )
}

/** Garment-level status uses the same workflow stages. */
export const GarmentStatusBadge = OrderStatusBadge

const PAYMENT_META = {
  paid: { tone: 'green', label: 'Paid' },
  partial: { tone: 'amber', label: 'Partial' },
  unpaid: { tone: 'red', label: 'Unpaid' },
}
export function PaymentStatusBadge({ status, size }) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.unpaid
  return <Badge tone={meta.tone} size={size}>{meta.label}</Badge>
}

export function PriorityBadge({ priority }) {
  if (priority === 'urgent') return <Badge tone="red" icon={Zap}>Urgent</Badge>
  if (priority === 'express') return <Badge tone="orange" icon={Clock}>Express</Badge>
  return <Badge tone="slate">Normal</Badge>
}

export function OverdueBadge() {
  return <Badge tone="red" icon={TriangleAlert} size="sm">Overdue</Badge>
}

export function StockBadge({ status }) {
  if (status === 'out') return <Badge tone="red" dot>Out of Stock</Badge>
  if (status === 'low') return <Badge tone="amber" dot>Low Stock</Badge>
  return <Badge tone="green" dot>In Stock</Badge>
}

export function RoleBadge({ role }) {
  if (role === 'admin') return <Badge tone="navy">Admin</Badge>
  if (role === 'manager') return <Badge tone="indigo">Manager</Badge>
  return <Badge tone="slate">Staff</Badge>
}

export function MethodBadge({ method }) {
  if (method === 'paybill') return <Badge tone="green" icon={Building2}>Paybill</Badge>
  if (method === 'mpesa_number') return <Badge tone="green" icon={Smartphone}>M-Pesa no.</Badge>
  if (method === 'mpesa') return <Badge tone="green" icon={Smartphone}>M-Pesa</Badge>
  if (method === 'bank') return <Badge tone="indigo" icon={Building2}>Bank</Badge>
  return <Badge tone="slate" icon={Banknote}>Cash</Badge>
}

/** New vs regular client (regular from their 2nd order). */
export function ClientTypeBadge({ type, size }) {
  return type === 'regular'
    ? <Badge tone="indigo" icon={Repeat} size={size}>Regular</Badge>
    : <Badge tone="cyan" icon={Sparkles} size={size}>New</Badge>
}

/** Client feedback rating, e.g. ★ 4/5. */
export function RatingBadge({ rating, size }) {
  if (!rating) return null
  return <Badge tone={rating >= 4 ? 'green' : rating === 3 ? 'amber' : 'red'} icon={Star} size={size}>{rating}/5</Badge>
}
