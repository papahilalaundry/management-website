import { useEffect, useState } from 'react'
import { CheckCircle2, Printer, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Field, Select, Textarea } from '../ui/Field'
import CustomerPicker from '../customers/CustomerPicker'
import PaymentFields from './PaymentFields'
import { emptyPayment, paymentPayload } from './paymentForm'
import ReceiptModal from '../receipts/ReceiptModal'
import { paymentService } from '../../services'
import { useSms } from '../../context/SmsContext'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { methodLabel } from '../../data/constants'
import { validatePayment } from '../../utils/validators'

const emptyForm = (order) => ({
  ...emptyPayment(order ? order.balance : ''),
  orderId: order?.id ?? '',
  amount: order ? String(order.balance) : '',
  notes: '',
})

/**
 * Record a payment (Paybill, M-Pesa number or cash) as entered from the
 * M-Pesa message or the cash received — no money moves through this system.
 * Pass `order` (enriched, with balance) to lock the order; otherwise the user
 * picks a customer then one of their orders with an outstanding balance.
 */
export default function RecordPaymentModal({ open, onClose, order: fixedOrder, customer: presetCustomer, onRecorded }) {
  const { notifySms } = useSms()
  const [customer, setCustomer] = useState(null)
  const [payable, setPayable] = useState({ customerId: null, list: [] })
  const [form, setForm] = useState(() => emptyForm(fixedOrder))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [showReceipt, setShowReceipt] = useState(false)

  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(emptyForm(fixedOrder))
      setErrors({})
      setResult(null)
      setCustomer(presetCustomer ? { id: presetCustomer.id, name: presetCustomer.name, phone: presetCustomer.phone, email: presetCustomer.email, address: presetCustomer.address, clientType: presetCustomer.clientType } : null)
    }
  }

  useEffect(() => {
    if (!customer) return undefined
    let cancelled = false
    paymentService.getPayableOrders(customer.id).then((list) => {
      if (cancelled) return
      setPayable({ customerId: customer.id, list })
      if (list.length === 1) setForm((f) => ({ ...f, orderId: list[0].id, amount: String(list[0].balance), expectedAmount: String(list[0].balance) }))
    }).catch((err) => {
      if (cancelled) return
      setPayable({ customerId: customer.id, list: [] })
      toast.error(err.message)
    })
    return () => {
      cancelled = true
    }
  }, [customer])
  const orders = customer && payable.customerId === customer.id ? payable.list : []
  const loadingOrders = !!customer && payable.customerId !== customer.id

  const order = fixedOrder ?? orders.find((o) => o.id === form.orderId)
  const patch = (p) => {
    setForm((f) => ({ ...f, ...p }))
    setErrors((er) => ({ ...er, ...Object.fromEntries(Object.keys(p).map((k) => [k, undefined])) }))
  }
  const amount = Number(form.amount) || 0
  const remaining = order ? Math.max(0, order.balance - amount) : 0

  const submit = async (e) => {
    e.preventDefault()
    const payload = paymentPayload(form)
    const v = validatePayment({ ...payload, orderId: order?.id }, { outstanding: order?.balance })
    if (!order) v.orderId = 'Select an order with an outstanding balance'
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const res = await paymentService.createPayment({ orderId: order.id, ...payload, notes: form.notes })
      setResult(res)
      toast.success(`Payment of ${formatCurrency(res.payment.amount)} recorded`, { description: `${res.order.id} · ${res.order.balance > 0 ? `Balance ${formatCurrency(res.order.balance)}` : 'Fully paid'}` })
      notifySms(res.sms, { autoPreview: false })
      onRecorded?.(res)
    } catch (err) {
      setErrors(err.fields ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (result) {
    const p = result.payment
    return (
      <>
        <Modal open={open && !showReceipt} onClose={onClose} size="sm" footer={<><Button variant="secondary" icon={Printer} onClick={() => setShowReceipt(true)}>View receipt</Button><Button onClick={onClose}>Done</Button></>}>
          <div className="py-2 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={28} />
            </span>
            <h2 className="mt-4 text-lg font-extrabold text-ink">Payment recorded</h2>
            <p className="mt-1 text-sm text-muted">
              {formatCurrency(p.amount)} via {methodLabel(p.method)} for {result.order.id}{p.payerName ? ` · from ${p.payerName}` : ''}
            </p>
            <div className="mx-auto mt-5 max-w-xs space-y-1.5 rounded-xl bg-slate-50 p-4 text-left text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Transaction</span><span className="font-mono font-semibold">{p.id}</span></div>
              {p.expectedAmount != null && <div className="flex justify-between"><span className="text-muted">Estimated amount</span><span className="tabular-nums">{formatCurrency(p.expectedAmount)}</span></div>}
              <div className="flex justify-between"><span className="text-muted">Previous balance</span><span className="tabular-nums">{formatCurrency(p.previousBalance)}</span></div>
              <div className="flex justify-between font-bold"><span>Remaining balance</span><span className="tabular-nums">{formatCurrency(p.balanceAfter)}</span></div>
            </div>
            {p.reference && <p className="mt-3 text-[11px] text-muted">M-Pesa code <span className="font-mono font-semibold">{p.reference}</span></p>}
          </div>
        </Modal>
        <ReceiptModal open={open && showReceipt} onClose={() => { setShowReceipt(false); onClose() }} type="payment" payment={p} />
      </>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description="Record a Paybill, M-Pesa number or cash payment against an order."
      icon={Wallet}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="record-payment-form" loading={saving} icon={CheckCircle2}>Record payment</Button>
        </>
      }
    >
      <form id="record-payment-form" onSubmit={submit} noValidate className="space-y-4">
        {fixedOrder ? (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-slate-50/70 p-3.5 text-[13px] sm:grid-cols-3">
            <div><p className="text-xs text-muted">Customer</p><p className="font-semibold text-ink">{fixedOrder.customer.name}</p></div>
            <div><p className="text-xs text-muted">Order</p><p className="font-semibold text-ink">{fixedOrder.id}</p></div>
            <div><p className="text-xs text-muted">Outstanding</p><p className="font-bold text-red-600 tabular-nums">{formatCurrency(fixedOrder.balance)}</p></div>
          </div>
        ) : (
          <>
            <Field label="Customer" required error={!customer && errors.orderId ? 'Select a customer first' : undefined}>
              {() => <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setForm((f) => ({ ...f, orderId: '', amount: '', expectedAmount: '' })) }} autoFocus />}
            </Field>
            {customer && (
              <Field label="Order" required error={errors.orderId} hint={!loadingOrders && !orders.length ? 'This customer has no outstanding balances.' : undefined}>
                {(p) => (
                  <Select
                    {...p}
                    value={form.orderId}
                    disabled={loadingOrders || !orders.length}
                    onChange={(e) => {
                      const o = orders.find((x) => x.id === e.target.value)
                      setForm((f) => ({ ...f, orderId: e.target.value, amount: o ? String(o.balance) : '', expectedAmount: o ? String(o.balance) : '' }))
                      setErrors({})
                    }}
                    placeholder={loadingOrders ? 'Loading orders…' : 'Select an order'}
                    options={orders.map((o) => ({ value: o.id, label: `${o.id} · ${formatDate(o.receivedAt)} · ${o.weightKg ?? '—'} kg · balance ${formatCurrency(o.balance)}` }))}
                  />
                )}
              </Field>
            )}
          </>
        )}

        {order && !fixedOrder && (
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-[13px]">
            <span className="text-red-700">Outstanding balance</span>
            <span className="font-bold tabular-nums text-red-700">{formatCurrency(order.balance)}</span>
          </div>
        )}

        <PaymentFields value={form} onChange={patch} errors={errors} maxAmount={order?.balance} />
        {order && (
          <div className="-mt-1 flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => patch({ amount: String(order.balance) })} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">Full balance</button>
            <button type="button" onClick={() => patch({ amount: String(Math.round(order.balance / 2)) })} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">Half</button>
            <span className="ml-auto text-xs text-muted">Remaining after payment: <strong className="tabular-nums text-ink">{formatCurrency(remaining)}</strong></span>
          </div>
        )}

        <Field label="Notes" optional>
          {(p) => <Textarea {...p} rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Anything worth noting about this payment" />}
        </Field>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
          Enter the details from the M-Pesa message or the cash received. This system does not connect to Safaricom or move any money.
        </p>
      </form>
    </Modal>
  )
}
