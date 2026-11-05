import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addDays, addHours, setHours, setMinutes } from 'date-fns'
import {
  CalendarDays, CircleAlert, ClipboardList, Plus, Printer, Save, Scale, Shirt, User, UserPlus, Wallet, Calculator, Zap, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { catalogService, customerService, orderService, staffService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useSms } from '../context/SmsContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import { PageSkeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ui/Modal'
import Avatar from '../components/ui/Avatar'
import CustomerPicker from '../components/customers/CustomerPicker'
import CustomerFields from '../components/customers/CustomerFields'
import GarmentRow from '../components/orders/GarmentRow'
import PaymentFields from '../components/payments/PaymentFields'
import { emptyPayment, paymentPayload } from '../components/payments/paymentForm'
import { ClientTypeBadge } from '../components/shared/StatusBadges'
import { isMpesaMethod, PRIORITIES } from '../data/constants'
import { calcOrderTotals, garmentCount as countGarments } from '../utils/calculations'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDateTime, toInputDateTime } from '../utils/formatDate'
import { displayPhone, hasErrors, isValidMpesaRef, validateCustomer } from '../utils/validators'

let keySeq = 0
const newItem = (name = 'Shirt', category = 'Clothing') => ({ key: `k${++keySeq}`, category, name, quantity: 1, instructions: '', condition: '', showNotes: false })
const QUICK_ADD = [['Trousers', 'Clothing'], ['T-shirt', 'Clothing'], ['Shirt', 'Clothing'], ['Bedsheet', 'Household'], ['Towel', 'Household'], ['Mixed load', 'Household']]
const PAYMENT_KEYS = ['method', 'expectedAmount', 'amount', 'payerName', 'reference', 'paidAt']

function dueFor(priority, from = new Date()) {
  if (priority === 'urgent') return addHours(from, 6)
  return setMinutes(setHours(addDays(from, priority === 'express' ? 1 : 2), 17), 0)
}

function Section({ step, title, description, icon: Icon, children, action }) {
  return (
    <Card as="section" aria-labelledby={`step-${step}`}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-brand"><Icon size={18} aria-hidden /></span>
          <div>
            <h2 id={`step-${step}`} className="text-[15px] font-bold text-ink"><span className="mr-1.5 text-muted">{step}.</span>{title}</h2>
            {description && <p className="hidden text-xs text-muted sm:block">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </Card>
  )
}

function SummaryRow({ label, value, strong, tone }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'text-base font-extrabold text-ink' : 'text-[13px] text-slate-600'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${tone === 'red' ? 'font-bold text-red-600' : tone === 'green' ? 'font-semibold text-emerald-700' : tone === 'muted' ? 'text-emerald-700' : ''}`}>{value}</span>
    </div>
  )
}

/** Client-side mirror of the server validation for instant feedback. */
function validate(form, totals, payment) {
  const e = {}
  if (!form.customer && !form.newCustomer) e.customerId = 'Select an existing customer or register a new one'
  if (form.newCustomer) Object.entries(validateCustomer(form.newCustomer)).forEach(([k, v]) => (e[`customer.${k}`] = v))
  if (!form.serviceId) e.serviceId = 'Select a service'
  const kg = Number(form.weightKg)
  if (form.weightKg === '' || !(kg > 0)) e.weightKg = 'Enter the laundry weight in kg'
  else if (kg > 500) e.weightKg = 'That weight looks too large — check the scale reading'
  if (!form.items.length) e.items = 'List at least one garment (use "Mixed load" if not counted)'
  form.items.forEach((it, i) => {
    if (!it.name?.trim()) e[`items.${i}.name`] = 'Garment name is required'
    const q = Number(it.quantity)
    if (!(q > 0) || !Number.isInteger(q)) e[`items.${i}.quantity`] = 'Whole number of pieces'
  })
  if (!form.receivedAt) e.receivedAt = 'Required'
  if (!form.dueAt) e.dueAt = 'Required'
  else if (form.receivedAt && form.dueAt < form.receivedAt) e.dueAt = 'Completion cannot be earlier than the date received'
  if (form.deliveryAt && form.deliveryAt < form.receivedAt) e.deliveryAt = 'Delivery cannot be before the date received'
  if (Number(form.discount) < 0) e.discount = 'Discount cannot be negative'
  if (Number(form.extraCharges) < 0) e.extraCharges = 'Charges cannot be negative'
  if (payment) {
    const amt = Number(payment.amount)
    if (!(amt > 0)) e['payment.amount'] = 'Enter an amount greater than zero'
    else if (amt > totals.total + 0.001) e['payment.amount'] = 'Payment cannot exceed the order total'
    if (payment.expectedAmount !== '' && Number(payment.expectedAmount) < 0) e['payment.expectedAmount'] = 'Cannot be negative'
    if (isMpesaMethod(payment.method) && !payment.payerName?.trim()) e['payment.payerName'] = 'Enter the name shown on the M-Pesa message'
    if (isMpesaMethod(payment.method) && payment.reference && !isValidMpesaRef(payment.reference)) e['payment.reference'] = 'M-Pesa codes are 10 letters/digits'
    if (!payment.paidAt) e['payment.paidAt'] = 'Payment date is required'
  }
  return e
}

export default function CreateOrder() {
  const { id: editId } = useParams()
  const isEdit = !!editId
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const settings = useSettings()
  const { notifySms } = useSms()

  const boot = useAsync(async () => {
    const [services, staff, order, presetCustomer] = await Promise.all([
      catalogService.getServices(),
      staffService.getAssignableStaff(),
      isEdit ? orderService.getOrderById(editId) : null,
      !isEdit && params.get('customer') ? customerService.getCustomerById(params.get('customer')).catch(() => null) : null,
    ])
    return { services, staff, order, presetCustomer }
  }, [editId])

  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(null) // 'save' | 'print'
  const [dueTouched, setDueTouched] = useState(isEdit)
  const [confirmLeave, setConfirmLeave] = useState(false)

  // Initialise the form once reference data has loaded (state set during render, not in an effect).
  if (boot.data && !form) {
    const { services, order, presetCustomer, staff } = boot.data
    const now = new Date()
    const defaultService = services.find((s) => s.active !== false)?.id ?? ''
    if (order) {
      setForm({
        customer: order.customer,
        newCustomer: null,
        serviceId: order.serviceId,
        weightKg: String(order.weightKg ?? ''),
        items: order.items.map((it) => ({ ...it, key: it.id, showNotes: !!(it.instructions || it.condition) })),
        receivedAt: toInputDateTime(order.receivedAt),
        dueAt: toInputDateTime(order.dueAt),
        pickupAt: toInputDateTime(order.pickupAt),
        deliveryAt: toInputDateTime(order.deliveryAt),
        assignedTo: order.assignedTo ?? '',
        priority: order.priority,
        extraCharges: order.extraCharges || '',
        discount: order.discount || '',
        notes: order.notes,
        payOption: 'none',
        payment: emptyPayment(),
        expectedTouched: false,
      })
    } else {
      setForm({
        customer: presetCustomer ? { id: presetCustomer.id, name: presetCustomer.name, phone: presetCustomer.phone, email: presetCustomer.email, address: presetCustomer.address, clientType: presetCustomer.clientType } : null,
        newCustomer: null,
        serviceId: defaultService,
        weightKg: '',
        items: [newItem()],
        receivedAt: toInputDateTime(now),
        dueAt: toInputDateTime(dueFor('normal', now)),
        pickupAt: '',
        deliveryAt: '',
        assignedTo: staff.find((s) => s.role === 'staff')?.id ?? '',
        priority: 'normal',
        extraCharges: '',
        discount: '',
        notes: '',
        payOption: 'none',
        payment: emptyPayment(),
        expectedTouched: false,
      })
    }
  }

  const service = form && boot.data?.services.find((s) => s.id === form.serviceId)
  const editing = boot.data?.order
  // The agreed rate stays on an existing order unless its service changes.
  const ratePerKg = form ? (isEdit && editing && form.serviceId === editing.serviceId ? editing.ratePerKg : service?.price ?? 0) : 0

  const totals = useMemo(
    () => (form ? calcOrderTotals({ weightKg: form.weightKg, ratePerKg, priority: form.priority, extraCharges: form.extraCharges, discount: form.discount, taxRate: isEdit ? editing?.taxRate : settings.pricing.taxRate }, settings.pricing) : null),
    [form, ratePerKg, settings.pricing, isEdit, editing],
  )

  if (boot.error) return <Card><ErrorState error={boot.error} onRetry={boot.reload} /></Card>
  if (!form || !boot.data) return <PageSkeleton />
  const { services, staff } = boot.data
  if (editing?.status === 'cancelled') return <Card><ErrorState error={{ message: 'Cancelled orders cannot be edited.' }} /></Card>

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    const keys = Object.keys(patch)
    const affected = (k) =>
      keys.some((p) => k === p || k.startsWith(`${p}.`) || (p === 'customer' && k === 'customerId') || (p === 'newCustomer' && k.startsWith('customer.')))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !affected(k))))
  }
  const setItem = (i, item) => {
    const items = form.items.map((x, idx) => (idx === i ? item : x))
    setForm((f) => ({ ...f, items }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(`items.${i}.`) && k !== 'items')))
  }
  const setPayment = (patch) => {
    setForm((f) => ({ ...f, payment: { ...f.payment, ...patch }, expectedTouched: f.expectedTouched || 'expectedAmount' in patch }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !Object.keys(patch).some((p) => k === `payment.${p}`))))
  }

  // Effective payment state: estimated amount follows the total until edited; "Pay in full" pays the total.
  const payment = form.payOption === 'none' ? null : {
    ...form.payment,
    expectedAmount: form.expectedTouched ? form.payment.expectedAmount : String(totals.total),
    amount: form.payOption === 'full' ? String(totals.total) : form.payment.amount,
  }
  const paidNow = payment ? Number(payment.amount) || 0 : 0
  const garmentCount = countGarments(form.items)
  const customerDisplay = form.customer ?? (form.newCustomer?.name ? { name: form.newCustomer.name, phone: form.newCustomer.phone } : null)
  const err = (k) => errors[k]
  const paymentErrors = Object.fromEntries(PAYMENT_KEYS.map((k) => [k, errors[`payment.${k}`]]))

  const submit = async (mode) => {
    const v = validate(form, totals, payment)
    setErrors(v)
    if (hasErrors(v)) {
      toast.error('Please fix the highlighted fields before saving.')
      setTimeout(() => document.querySelector('[aria-invalid="true"], .has-error')?.focus?.(), 50)
      return
    }
    setSaving(mode)
    try {
      let customer = form.customer
      if (!customer && form.newCustomer) {
        try {
          customer = await customerService.createCustomer(form.newCustomer)
          set({ customer, newCustomer: null })
          toast.success(`Customer ${customer.name} registered`)
        } catch (e) {
          setErrors(Object.fromEntries(Object.entries(e.fields ?? {}).map(([k, val]) => [`customer.${k}`, val])))
          throw e
        }
      }
      const payload = {
        customerId: customer.id,
        serviceId: form.serviceId,
        weightKg: Number(form.weightKg),
        items: form.items.map(({ id, category, name, quantity, instructions, condition }) => ({ id, category, name, quantity: Number(quantity), instructions, condition })),
        receivedAt: new Date(form.receivedAt).toISOString(),
        dueAt: new Date(form.dueAt).toISOString(),
        pickupAt: form.pickupAt ? new Date(form.pickupAt).toISOString() : null,
        deliveryAt: form.deliveryAt ? new Date(form.deliveryAt).toISOString() : null,
        assignedTo: form.assignedTo,
        priority: form.priority,
        extraCharges: Number(form.extraCharges) || 0,
        discount: Number(form.discount) || 0,
        notes: form.notes,
        payment: !isEdit && payment ? paymentPayload(payment) : null,
      }
      if (isEdit) {
        const res = await orderService.updateOrder(editId, payload)
        toast.success(`Order ${res.order.id} updated`)
        navigate(`/orders/${res.order.id}${mode === 'print' ? '?print=1' : ''}`, { replace: true })
      } else {
        const res = await orderService.createOrder(payload)
        toast.success(`Order ${res.order.id} created`, { description: `${res.order.weightKg} kg · ${garmentCount} garments · ${formatCurrency(res.order.total)}` })
        notifySms(res.sms)
        navigate(`/orders/${res.order.id}${mode === 'print' ? '?print=1' : ''}`, { replace: true })
      }
    } catch (e) {
      if (e.fields) {
        // Payment validation errors come back without the "payment." prefix.
        const mapped = Object.fromEntries(Object.entries(e.fields).map(([k, val]) => [PAYMENT_KEYS.includes(k) ? `payment.${k}` : k, val]))
        setErrors((prev) => ({ ...prev, ...mapped }))
      }
      toast.error(e.message)
      setSaving(null)
    }
  }

  const activeServices = services.filter((s) => s.active !== false || s.id === form.serviceId)

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Orders', to: '/orders' }, ...(isEdit ? [{ label: editId, to: `/orders/${editId}` }] : []), { label: isEdit ? 'Edit' : 'New order' }]}
        title={isEdit ? `Edit order ${editId}` : 'Create new order'}
        description={isEdit ? 'Update weight, garments, schedule and pricing. Recorded payments are not affected.' : 'Register the client, weigh the laundry, count the garments, then confirm payment.'}
      />

      <form id="order-form" onSubmit={(e) => { e.preventDefault(); submit('save') }} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* 1. Customer */}
          <Section step={1} title="Client information" description="Find an existing client or register a new one." icon={User}
            action={!form.customer && !isEdit && (form.newCustomer
              ? <Button size="sm" variant="ghost" icon={X} onClick={() => set({ newCustomer: null })}>Cancel</Button>
              : <Button size="sm" variant="soft" icon={UserPlus} onClick={() => set({ newCustomer: { name: '', phone: '', email: '', address: '' } })}>New client</Button>)}
          >
            {form.newCustomer ? (
              <div className="rounded-xl border border-dashed border-blue-300 bg-sky-soft/30 p-4">
                <p className="mb-3 text-[13px] font-semibold text-brand">Registering a new client — they’ll be saved with this order.</p>
                <CustomerFields
                  value={form.newCustomer}
                  onChange={(v) => set({ newCustomer: v })}
                  errors={Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith('customer.')).map(([k, v]) => [k.slice(9), v]))}
                  autoFocus
                />
              </div>
            ) : (
              <Field label="Client" required error={err('customerId')}>
                {() => (
                  <CustomerPicker
                    value={form.customer}
                    onChange={(c) => set({ customer: c })}
                    onCreateNew={(q) => set({ newCustomer: { name: /\d/.test(q) ? '' : q, phone: /\d/.test(q) ? q : '', email: '', address: '' } })}
                    error={err('customerId')}
                    disabled={isEdit}
                  />
                )}
              </Field>
            )}
          </Section>

          {/* 2. Laundry & garments */}
          <Section step={2} title="Laundry & garments" description="Weigh the laundry (priced per kg) and count the garments for tracking." icon={Shirt}
            action={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{garmentCount} piece{garmentCount === 1 ? '' : 's'}</span>}
          >
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <Field label="Service" required error={err('serviceId')} className="sm:col-span-2">
                {(p) => (
                  <Select {...p} value={form.serviceId} onChange={(e) => set({ serviceId: e.target.value })} placeholder="Select service">
                    {activeServices.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.price, { decimals: 0 })}/kg</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Weight (kg)" required error={err('weightKg')} hint={ratePerKg ? `${formatCurrency(ratePerKg, { decimals: 0 })} per kg` : undefined}>
                {(p) => <Input {...p} type="number" inputMode="decimal" min="0.1" step="0.1" suffix="kg" value={form.weightKg} onChange={(e) => set({ weightKg: e.target.value })} placeholder="0.0" />}
              </Field>
            </div>
            {isEdit && editing && form.serviceId === editing.serviceId && service && service.price !== editing.ratePerKg && (
              <p className="-mt-2 mb-4 text-[11.5px] text-amber-700">This order keeps its agreed rate of {formatCurrency(editing.ratePerKg, { decimals: 0 })}/kg (current price is {formatCurrency(service.price, { decimals: 0 })}/kg).</p>
            )}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] text-slate-600"><Scale size={16} className="text-slate-400" aria-hidden /> {totals.weightKg || 0} kg × {formatCurrency(ratePerKg, { decimals: 0 })}/kg</span>
              <span className="text-[15px] font-extrabold tabular-nums text-ink">{formatCurrency(totals.subtotal, { decimals: 0 })}</span>
            </div>

            {err('items') && <p className="mb-3 flex items-center gap-1.5 text-[13px] font-medium text-red-600" role="alert"><CircleAlert size={15} /> {err('items')}</p>}
            <div className="space-y-3">
              {form.items.map((item, i) => (
                <GarmentRow
                  key={item.key}
                  index={i}
                  item={item}
                  errors={{ name: err(`items.${i}.name`), quantity: err(`items.${i}.quantity`) }}
                  onChange={(it) => setItem(i, it)}
                  onRemove={() => set({ items: form.items.filter((_, idx) => idx !== i) })}
                  onDuplicate={() => set({ items: [...form.items.slice(0, i + 1), { ...item, key: `k${++keySeq}`, id: undefined, status: undefined }, ...form.items.slice(i + 1)] })}
                  canRemove={form.items.length > 1}
                />
              ))}
            </div>
            <Button variant="secondary" icon={Plus} className="mt-3 w-full sm:hidden" onClick={() => set({ items: [...form.items, newItem()] })}>Add garment</Button>
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:mt-3 sm:flex-wrap sm:px-0 [&>*]:shrink-0">
              <Button variant="secondary" icon={Plus} className="max-sm:hidden" onClick={() => set({ items: [...form.items, newItem()] })}>Add garment</Button>
              {QUICK_ADD.map(([g, cat]) => (
                <Button key={g} variant="ghost" size="sm" icon={Plus} className="max-sm:h-9 max-sm:rounded-full max-sm:border max-sm:border-line max-sm:bg-white" onClick={() => set({ items: [...form.items, newItem(g, cat)] })}>{g}</Button>
              ))}
            </div>
          </Section>

          {/* 3. Scheduling */}
          <Section step={3} title="Scheduling" description="When the order came in, when it will be ready and when it will be delivered." icon={CalendarDays}>
            <fieldset className="mb-4">
              <legend className="mb-2 text-[13px] font-semibold text-slate-700">Priority</legend>
              <div className="grid grid-cols-3 gap-2">
                {PRIORITIES.map((p) => {
                  const rate = p.value === 'express' ? settings.pricing.expressSurcharge : p.value === 'urgent' ? settings.pricing.urgentSurcharge : 0
                  const selected = form.priority === p.value
                  return (
                    <button key={p.value} type="button" role="radio" aria-checked={selected}
                      onClick={() => set({ priority: p.value, ...(dueTouched ? {} : { dueAt: toInputDateTime(dueFor(p.value, new Date(form.receivedAt || Date.now()))) }) })}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-brand bg-sky-soft/70 ring-4 ring-brand/15' : 'border-line hover:border-slate-300'}`}
                    >
                      <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">{p.value !== 'normal' && <Zap size={13} className={p.value === 'urgent' ? 'text-red-500' : 'text-orange-500'} />}{p.label}</span>
                      <span className="text-[11px] text-muted">{p.value === 'normal' ? '2 days · no surcharge' : p.value === 'express' ? `Next day · +${rate}%` : `Same day · +${rate}%`}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date received" required error={err('receivedAt')}>
                {(p) => <Input {...p} type="datetime-local" value={form.receivedAt} onChange={(e) => set({ receivedAt: e.target.value })} />}
              </Field>
              <Field label="Expected completion" required error={err('dueAt')}>
                {(p) => <Input {...p} type="datetime-local" value={form.dueAt} min={form.receivedAt} onChange={(e) => { setDueTouched(true); set({ dueAt: e.target.value }) }} />}
              </Field>
              <Field label="Pickup date" optional error={err('pickupAt')} hint="If we collect from the client">
                {(p) => <Input {...p} type="datetime-local" value={form.pickupAt} onChange={(e) => set({ pickupAt: e.target.value })} />}
              </Field>
              <Field label="Delivery date" optional error={err('deliveryAt')} hint="When we deliver to the client (leave empty if they collect)">
                {(p) => <Input {...p} type="datetime-local" value={form.deliveryAt} min={form.receivedAt} onChange={(e) => set({ deliveryAt: e.target.value })} />}
              </Field>
              <Field label="Assigned staff member" className="sm:col-span-2">
                {(p) => <Select {...p} value={form.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })} placeholder="Unassigned" options={staff.map((s) => ({ value: s.id, label: `${s.name}${s.title ? ` — ${s.title}` : ''}` }))} />}
              </Field>
              <Field label="Comments" optional hint="Client’s comments or instructions for this order" className="sm:col-span-2">
                {(p) => <Textarea {...p} rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Call before delivery; separate whites" />}
              </Field>
            </div>
          </Section>

          {/* 4. Pricing */}
          <Section step={4} title="Pricing" description="Additional charges, discounts and tax." icon={Calculator}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Delivery / other charges" error={err('extraCharges')} hint={
                <button type="button" className="font-semibold text-brand hover:underline" onClick={() => set({ extraCharges: (Number(form.extraCharges) || 0) + settings.pricing.deliveryFee })}>+ Add delivery fee ({formatCurrency(settings.pricing.deliveryFee, { decimals: 0 })})</button>
              }>
                {(p) => <Input {...p} type="number" min="0" step="10" prefix="KES" value={form.extraCharges} onChange={(e) => set({ extraCharges: e.target.value })} placeholder="0" />}
              </Field>
              <Field label="Discount" error={err('discount')} hint={!can('orders.discount') ? 'Only managers and admins can apply discounts' : undefined}>
                {(p) => <Input {...p} type="number" min="0" step="10" prefix="KES" value={form.discount} disabled={!can('orders.discount')} onChange={(e) => set({ discount: e.target.value })} placeholder="0" />}
              </Field>
              <Field label={`${settings.pricing.taxLabel || 'Tax'} rate`} hint="Configured in Settings">
                {(p) => <Input {...p} value={`${totals.taxRate}%`} disabled />}
              </Field>
            </div>
          </Section>

          {/* 5. Payment */}
          {!isEdit && (
            <Section step={5} title="Payment" description="Record a payment now, or let the client pay later." icon={Wallet}>
              <div role="radiogroup" aria-label="Payment option" className="mb-4 grid grid-cols-3 gap-2">
                {[['none', 'Pay later', 'No payment now'], ['partial', 'Deposit', 'Part payment'], ['full', 'Pay in full', formatCurrency(totals.total, { decimals: 0 })]].map(([v, label, sub]) => (
                  <button key={v} type="button" role="radio" aria-checked={form.payOption === v}
                    onClick={() => {
                      set({ payOption: v })
                      if (v === 'partial') setPayment({ amount: String(Math.round(totals.total / 2 / 50) * 50 || '') })
                    }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${form.payOption === v ? 'border-brand bg-sky-soft/70 ring-4 ring-brand/15' : 'border-line hover:border-slate-300'}`}
                  >
                    <span className="block text-[13px] font-bold text-ink">{label}</span>
                    <span className="block truncate text-[11px] text-muted">{sub}</span>
                  </button>
                ))}
              </div>
              {payment && (
                <div className="animate-fade-in">
                  <PaymentFields value={payment} onChange={setPayment} errors={paymentErrors} maxAmount={totals.total} amountDisabled={form.payOption === 'full'} />
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Live summary */}
        <aside className="lg:sticky lg:top-24" aria-label="Order summary">
          <Card className="overflow-hidden">
            <div className="bg-navy-900 px-5 py-4 text-white">
              <p className="flex items-center gap-2 text-sm font-bold"><ClipboardList size={16} /> Order summary</p>
              <p className="mt-0.5 text-xs text-navy-200">{isEdit ? editId : 'New order'} · {PRIORITIES.find((p) => p.value === form.priority).label} priority</p>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                {customerDisplay ? <Avatar name={customerDisplay.name} /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400"><User size={16} /></span>}
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-[13px] font-bold text-ink">
                    {customerDisplay?.name || 'No client selected'}
                    {form.customer?.clientType && <ClientTypeBadge type={form.customer.clientType} size="sm" />}
                  </p>
                  <p className="truncate text-xs text-muted">{customerDisplay?.phone ? displayPhone(customerDisplay.phone) : form.newCustomer ? 'New client' : 'Select a client'}</p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <span>{garmentCount} garments · {form.items.length} lines</span>
                  <span>{totals.weightKg || 0} kg</span>
                </div>
                <ul className="scroll-thin max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {form.items.map((it) => (
                    <li key={it.key} className="flex justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate text-slate-600">{it.name || '—'} <span className="text-slate-400">· {it.category}</span></span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">×{it.quantity || 0}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <SummaryRow label={`${totals.weightKg || 0} kg × ${formatCurrency(ratePerKg, { decimals: 0 })}`} value={formatCurrency(totals.subtotal)} />
                {totals.surcharge > 0 && <SummaryRow label={`${form.priority === 'urgent' ? 'Urgent' : 'Express'} surcharge (${totals.surchargeRate}%)`} value={formatCurrency(totals.surcharge)} />}
                {totals.extraCharges > 0 && <SummaryRow label="Additional charges" value={formatCurrency(totals.extraCharges)} />}
                {totals.discount > 0 && <SummaryRow label="Discount" value={`− ${formatCurrency(totals.discount)}`} tone="muted" />}
                <SummaryRow label={`${settings.pricing.taxLabel || 'Tax'} (${totals.taxRate}%)`} value={formatCurrency(totals.tax)} />
                <div className="my-2 border-t border-dashed border-line" />
                <SummaryRow label="Total" value={formatCurrency(totals.total)} strong />
                {!isEdit && <SummaryRow label="Paid now" value={formatCurrency(paidNow)} tone="green" />}
                {isEdit && <SummaryRow label="Already paid" value={formatCurrency(editing.amountPaid)} tone="green" />}
                <SummaryRow label="Balance due" value={formatCurrency(Math.max(0, totals.total - (isEdit ? editing.amountPaid : paidNow)))} tone={totals.total - (isEdit ? editing.amountPaid : paidNow) > 0 ? 'red' : undefined} />
              </div>

              <div className="space-y-1.5 rounded-lg bg-sky-soft/70 px-3 py-2 text-xs text-navy-800">
                <p className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-brand" /> Ready by <strong>{form.dueAt ? formatDateTime(form.dueAt) : '—'}</strong></p>
                {form.deliveryAt && <p className="pl-[22px]">Delivery <strong>{formatDateTime(form.deliveryAt)}</strong></p>}
              </div>

              <div className="hidden space-y-2 lg:block">
                <Button type="submit" className="w-full" size="lg" icon={Save} loading={saving === 'save'} disabled={!!saving}>{isEdit ? 'Save changes' : 'Save order'}</Button>
                <Button variant="secondary" className="w-full" icon={Printer} loading={saving === 'print'} disabled={!!saving} onClick={() => submit('print')}>Save & print receipt</Button>
                <Button variant="ghost" className="w-full" disabled={!!saving} onClick={() => setConfirmLeave(true)}>Cancel</Button>
              </div>
              <p className="text-center text-[11px] text-muted">Created by {user.name}</p>
            </div>
          </Card>
        </aside>

      </form>

      {/* Mobile action bar (outside the form so the page-entrance animation
          can't pin this fixed bar to the form; submits via form="order-form") */}
      <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3.5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-8px_rgb(16_24_40/0.12)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2.5">
          <div className="mr-auto min-w-0">
            <p className="text-[11px] font-medium text-muted">{totals.weightKg || 0} kg · {garmentCount} item{garmentCount === 1 ? '' : 's'} · Total</p>
            <p className="truncate text-lg font-extrabold leading-tight tabular-nums text-ink">{formatCurrency(totals.total, { decimals: 0 })}</p>
          </div>
          <Button variant="secondary" size="icon-lg" icon={Printer} className="shrink-0" aria-label="Save and print receipt" onClick={() => submit('print')} disabled={!!saving} />
          <Button type="submit" form="order-form" size="lg" icon={Save} className="shrink-0" loading={saving === 'save'} disabled={!!saving}>{isEdit ? 'Save changes' : 'Save order'}</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => navigate(isEdit ? `/orders/${editId}` : '/orders', { replace: true })}
        title="Discard this order?"
        message="Any information you’ve entered will be lost."
        confirmLabel="Discard"
      />
    </div>
  )
}
