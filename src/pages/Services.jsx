import { useState } from 'react'
import { Blinds, Briefcase, Footprints, Info, ListChecks, MoreHorizontal, Pencil, PencilLine, Plus, Power, PowerOff, Ruler, Shirt, Sparkles, Tag, Trash2, Weight } from 'lucide-react'
import { toast } from 'sonner'
import { catalogService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Switch, Textarea } from '../components/ui/Field'
import Dropdown from '../components/ui/Dropdown'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { PRICING_UNITS, unitLabel } from '../data/constants'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { validateService } from '../utils/validators'

const UNIT_ICONS = { kg: Weight, pair: Footprints, piece: Shirt, sqm: Ruler, panel: Blinds, job: Briefcase, custom: Tag }
const EMPTY = { name: '', description: '', unit: 'kg', unitLabel: '', price: '', minCharge: '', priceEditable: false, trackItems: true, active: true }

const toForm = (s) => ({
  name: s.name,
  description: s.description ?? '',
  unit: s.unit ?? 'kg',
  unitLabel: s.unitLabel ?? '',
  price: String(s.price ?? ''),
  minCharge: s.minCharge ? String(s.minCharge) : '',
  priceEditable: !!s.priceEditable,
  trackItems: s.trackItems !== false,
  active: s.active !== false,
})

const perUnit = (s) => (s.unit === 'job' ? 'per job' : `per ${unitLabel(s)}`)

function ServiceFormModal({ open, onClose, service, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(service ? toForm(service) : EMPTY)
      setErrors({})
    }
  }
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  // Sensible defaults for a new service when the unit is chosen (staff can still change them).
  const chooseUnit = (unit) => {
    setForm((f) => ({ ...f, unit, ...(service ? {} : { trackItems: ['kg', 'piece'].includes(unit), priceEditable: unit === 'pair' }) }))
    setErrors((x) => ({ ...x, unit: undefined, unitLabel: undefined }))
  }
  const unitName = form.unit === 'custom' ? form.unitLabel.trim() || 'unit' : PRICING_UNITS.find((u) => u.value === form.unit)?.unit

  const submit = async (e) => {
    e.preventDefault()
    const v = validateService(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const saved = service ? await catalogService.updateService(service.id, form) : await catalogService.createService(form)
      toast.success(service ? `${saved.name} updated` : `${saved.name} added to the catalogue`)
      onSaved()
      onClose()
    } catch (err) {
      setErrors(err.fields ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} icon={service ? Pencil : Plus} size="lg" title={service ? `Edit ${service.name}` : 'Add service'} description="Choose how the service is measured and what it costs per unit."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="service-form" loading={saving}>{service ? 'Save changes' : 'Add service'}</Button></>}>
      <form id="service-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Service name" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set('name')} placeholder="e.g. Shoe cleaning" />}</Field>
        <Field label="Description" optional>{(p) => <Textarea {...p} rows={2} value={form.description} onChange={set('description')} placeholder="What’s included in this service" />}</Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-slate-700">How is it measured? <span className="text-red-500" aria-hidden>*</span></legend>
          <div role="radiogroup" aria-label="How is it measured" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRICING_UNITS.map((u) => {
              const Icon = UNIT_ICONS[u.value] ?? Tag
              const selected = form.unit === u.value
              return (
                <button key={u.value} type="button" role="radio" aria-checked={selected} onClick={() => chooseUnit(u.value)}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${selected ? 'border-brand bg-sky-soft/70 ring-4 ring-brand/15' : 'border-line hover:border-slate-300'}`}>
                  <Icon size={16} className={`mt-0.5 shrink-0 ${selected ? 'text-brand' : 'text-slate-400'}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-ink">{u.label}</span>
                    <span className="block text-[11px] leading-snug text-muted">{u.example}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {errors.unit && <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{errors.unit}</p>}
        </fieldset>

        {form.unit === 'custom' && (
          <Field label="Unit name" required error={errors.unitLabel} hint="Singular, e.g. seat, bag, rug">
            {(p) => <Input {...p} value={form.unitLabel} onChange={set('unitLabel')} placeholder="e.g. seat" maxLength={20} />}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={form.unit === 'job' ? 'Price per job' : `Price per ${unitName}`} required error={errors.price}>
            {(p) => <Input {...p} type="number" min="0" step="1" prefix="KES" suffix={form.unit === 'job' ? undefined : `/${unitName}`} value={form.price} onChange={set('price')} />}
          </Field>
          <Field label="Minimum charge" optional error={errors.minCharge} hint={errors.minCharge ? undefined : 'e.g. carpets: charge at least KES 1,000'}>
            {(p) => <Input {...p} type="number" min="0" step="1" prefix="KES" value={form.minCharge} onChange={set('minCharge')} placeholder="None" />}
          </Field>
        </div>

        <div className="divide-y divide-line rounded-xl border border-line px-3.5">
          <div className="py-3"><Switch checked={form.priceEditable} onChange={set('priceEditable')} label="Staff can change the price on each order" description="For items whose cost varies, like shoes. The price above becomes the default." /></div>
          <div className="py-3"><Switch checked={form.trackItems} onChange={set('trackItems')} label="List garments/items on the order" description="For laundry and ironing, so pieces are counted and tracked. Usually off for carpets, curtains and shoes." /></div>
          <div className="py-3"><Switch checked={form.active} onChange={set('active')} label="Available for new orders" description="Inactive services are hidden when creating orders." /></div>
        </div>

        {service && form.price !== '' && (Number(form.price) !== service.price || form.unit !== service.unit) && (
          <p className="flex items-start gap-2 rounded-lg bg-sky-soft px-3 py-2 text-xs text-navy-800"><Info size={14} className="mt-0.5 shrink-0 text-brand" /> New prices apply to new orders only. Existing orders keep the price agreed at drop-off.</p>
        )}
      </form>
    </Modal>
  )
}

export default function Services() {
  const { can } = useAuth()
  const manage = can('services.manage')
  const { data, loading, error, reload } = useAsync(() => catalogService.getServices({ withUsage: true }), [], { live: true, watch: ['services'] })
  const [view, setView] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const services = data ?? []
  const shown = services.filter((s) => (view === 'active' ? s.active !== false : view === 'inactive' ? s.active === false : true))
  const active = services.filter((s) => s.active !== false)
  const top = [...services].sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0))[0]

  const toggle = async (s) => {
    try {
      await catalogService.setServiceActive(s.id, s.active === false)
      toast.success(`${s.name} ${s.active !== false ? 'deactivated' : 'activated'}`)
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }
  const confirmDelete = async () => {
    setBusy(true)
    try {
      await catalogService.deleteService(deleting.id)
      toast.success(`${deleting.name} deleted`)
      setDeleting(null)
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services & Pricing"
        description="Price each service by weight, pair, piece, area, panel, job or a custom unit."
        actions={manage && <Button icon={Plus} onClick={() => setModal({})}>Add service</Button>}
      />
      {!manage && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-slate-600">
          <Info size={16} className="text-brand" /> You can view the catalogue. Only administrators can change services and prices.
        </div>
      )}

      <section className="stat-strip grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Services" value={formatNumber(services.length)} icon={Tag} tone="blue" />
        <MiniStat label="Active" value={formatNumber(active.length)} icon={Power} tone="green" />
        <MiniStat label="Price set per order" value={formatNumber(active.filter((s) => s.priceEditable).length)} icon={PencilLine} tone="violet" sub="Active services with variable prices" />
        <MiniStat label="Most popular" value={top?.name ?? '—'} icon={Sparkles} tone="amber" sub={top ? `${formatNumber(top.orderCount ?? 0)} orders` : undefined} />
      </section>

      <Tabs variant="pills" className="w-fit" value={view} onChange={setView} tabs={[{ value: 'all', label: 'All', count: services.length }, { value: 'active', label: 'Active', count: active.length }, { value: 'inactive', label: 'Inactive', count: services.length - active.length }]} />

      {error && !data ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      ) : shown.length === 0 ? (
        <Card><EmptyState icon={Tag} title="No services here" description="Try another filter or add a new service." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => {
            const Icon = UNIT_ICONS[s.unit] ?? Tag
            return (
              <Card key={s.id} className={`flex flex-col p-5 transition hover:border-slate-300 ${s.active !== false ? '' : 'bg-slate-50/60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.active !== false ? 'bg-sky-soft text-brand' : 'bg-slate-100 text-slate-400'}`}><Icon size={20} /></span>
                  <div className="flex items-center gap-1">
                    {s.active !== false ? <Badge tone="green" dot>Available</Badge> : <Badge tone="slate" dot>Inactive</Badge>}
                    {manage && (
                      <Dropdown
                        items={[
                          { label: 'Edit service', icon: Pencil, onClick: () => setModal({ service: s }) },
                          { label: s.active !== false ? 'Deactivate' : 'Activate', icon: s.active !== false ? PowerOff : Power, onClick: () => toggle(s) },
                          { divider: true },
                          { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleting(s), disabled: s.orderCount > 0 },
                        ]}
                        trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${s.name}`}><MoreHorizontal size={18} /></button>}
                      />
                    )}
                  </div>
                </div>
                <h3 className="mt-4 text-base font-bold text-ink">{s.name}</h3>
                <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-muted">{s.description || 'No description.'}</p>
                {(s.priceEditable || s.trackItems) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.priceEditable && <Badge tone="amber" icon={PencilLine} size="sm">Price set per order</Badge>}
                    {s.trackItems && <Badge tone="indigo" icon={ListChecks} size="sm">Lists garments</Badge>}
                  </div>
                )}
                <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
                  <div>
                    <p className="text-[22px] font-extrabold tabular-nums text-ink">{formatCurrency(s.price, { decimals: 0 })}</p>
                    <p className="text-xs text-muted">{perUnit(s)}{s.minCharge > 0 ? ` · min ${formatCurrency(s.minCharge, { decimals: 0 })}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold tabular-nums text-ink">{formatNumber(s.orderCount ?? 0)} orders</p>
                    <p className="text-xs text-muted">Updated {formatDate(s.updatedAt)}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ServiceFormModal open={!!modal} service={modal?.service} onClose={() => setModal(null)} onSaved={() => reload({ silent: true })} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={busy} title={`Delete ${deleting?.name}?`} message="This service will be permanently removed from the catalogue." confirmLabel="Delete service" />
    </div>
  )
}
