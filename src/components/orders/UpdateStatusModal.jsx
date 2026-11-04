import { useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Field, Textarea } from '../ui/Field'
import { ORDER_STAGES, stageIndex } from '../../data/constants'
import { STATUS_META } from '../../data/statusMeta'
import { orderService } from '../../services'
import { useAuth } from '../../context/AuthContext'
import { useSms } from '../../context/SmsContext'
import { formatCurrency } from '../../utils/formatCurrency'

export default function UpdateStatusModal({ open, onClose, order, onUpdated }) {
  const { can } = useAuth()
  const { notifySms } = useSms()
  const current = order ? stageIndex(order.status) : 0
  const [status, setStatus] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open && order) {
      setStatus(ORDER_STAGES[Math.min(current + 1, ORDER_STAGES.length - 1)].value)
      setNote('')
    }
  }
  if (!order) return null
  const canRevert = can('orders.cancel')

  const submit = async () => {
    setSaving(true)
    try {
      const res = await orderService.updateOrderStatus(order.id, status, note)
      toast.success(`${order.id} moved to ${ORDER_STAGES.find((s) => s.value === status).label}`)
      notifySms(res.sms)
      onUpdated?.(res.order)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update laundry status"
      description={`${order.id} · ${order.customer.name}`}
      icon={RefreshCw}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={!status || stageIndex(status) === current}>Update status</Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-slate-700">New status</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ORDER_STAGES.map((s, i) => {
            const Icon = STATUS_META[s.value].icon
            const disabled = i === current || (i < current && !canRevert)
            const selected = status === s.value
            return (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => setStatus(s.value)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${selected ? 'border-brand bg-sky-soft/70 ring-4 ring-brand/15' : 'border-line hover:border-slate-300'}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${STATUS_META[s.value].color}1a`, color: STATUS_META[s.value].color }}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-ink">{s.label}</span>
                {i < current && <Check size={15} className="text-emerald-500" aria-label="Completed" />}
                {i === current && <span className="text-[10.5px] font-semibold uppercase text-muted">Current</span>}
              </button>
            )
          })}
        </div>
        {!canRevert && <p className="mt-2 text-xs text-muted">Only managers can move an order back to an earlier stage.</p>}
      </fieldset>
      {status === 'delivered' && order.balance > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          This order still has an outstanding balance of <strong>{formatCurrency(order.balance)}</strong>. Consider recording payment before delivery.
        </p>
      )}
      <Field label="Note" optional className="mt-4">
        {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Collected by customer’s driver" />}
      </Field>
      <p className="mt-3 text-xs text-muted">All garments behind this stage will be moved along with the order. Customers receive a simulated SMS when an order is ready or delivered.</p>
    </Modal>
  )
}
