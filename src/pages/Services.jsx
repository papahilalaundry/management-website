import { useState } from 'react'
import { BedDouble, Blinds, Flame, Info, MoreHorizontal, Pencil, Plus, Shirt, Sparkles, Trash2, WashingMachine, Weight, Wind, Power, PowerOff, Tag, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { catalogService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select, Switch, Textarea } from '../components/ui/Field'
import Dropdown from '../components/ui/Dropdown'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import { Skeleton } from '../components/ui/Skeleton'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { PRICING_MODELS, pricingUnit } from '../data/constants'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate } from '../utils/formatDate'
import { validateService } from '../utils/validators'

const ICONS = { 'SRV-01': WashingMachine, 'SRV-02': Shirt, 'SRV-03': Flame, 'SRV-04': Sparkles, 'SRV-05': BedDouble, 'SRV-06': Layers, 'SRV-07': Blinds, 'SRV-08': Shirt, 'SRV-09': Weight, 'SRV-10': Wind }
const EMPTY = { name: '', description: '', pricingModel: 'per_item', price: '', active: true }

function ServiceFormModal({ open, onClose, service, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(service ? { name: service.name, description: service.description, pricingModel: service.pricingModel, price: String(service.price), active: service.active } : EMPTY)
      setErrors({})
    }
  }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e })); setErrors((x) => ({ ...x, [k]: undefined })) }
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
    <Modal open={open} onClose={onClose} icon={service ? Pencil : Plus} title={service ? `Edit ${service.name}` : 'Add service'} description="Prices are used as defaults on new orders."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="service-form" loading={saving}>{service ? 'Save changes' : 'Add service'}</Button></>}>
      <form id="service-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Service name" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set('name')} placeholder="e.g. Shoe Cleaning" />}</Field>
        <Field label="Description" optional>{(p) => <Textarea {...p} rows={2} value={form.description} onChange={set('description')} placeholder="What’s included in this service" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pricing model" required error={errors.pricingModel}>{(p) => <Select {...p} value={form.pricingModel} onChange={set('pricingModel')} options={PRICING_MODELS} />}</Field>
          <Field label={`Price per ${pricingUnit(form.pricingModel)}`} required error={errors.price}>{(p) => <Input {...p} type="number" min="0" step="10" prefix="KES" value={form.price} onChange={set('price')} />}</Field>
        </div>
        <div className="rounded-xl border border-line p-3.5"><Switch checked={form.active} onChange={set('active')} label="Available for new orders" description="Inactive services are hidden when creating orders." /></div>
        {service && Number(form.price) !== service.price && form.price !== '' && (
          <p className="flex items-start gap-2 rounded-lg bg-sky-soft px-3 py-2 text-xs text-navy-800"><Info size={14} className="mt-0.5 shrink-0 text-brand" /> Changing from {formatCurrency(service.price)} to {formatCurrency(form.price)} affects new orders only. Existing orders keep the price agreed at drop-off.</p>
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
  const shown = services.filter((s) => (view === 'active' ? s.active : view === 'inactive' ? !s.active : true))
  const avg = services.length ? services.filter((s) => s.pricingModel === 'per_item').reduce((a, s) => a + s.price, 0) / Math.max(1, services.filter((s) => s.pricingModel === 'per_item').length) : 0
  const top = [...services].sort((a, b) => b.garmentCount - a.garmentCount)[0]

  const toggle = async (s) => {
    try {
      await catalogService.setServiceActive(s.id, !s.active)
      toast.success(`${s.name} ${s.active ? 'deactivated' : 'activated'}`)
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
        description="Your service catalogue and default prices."
        actions={manage && <Button icon={Plus} onClick={() => setModal({})}>Add service</Button>}
      />
      {!manage && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[13px] text-slate-600">
          <Info size={16} className="text-brand" /> You can view the catalogue. Only administrators can change services and prices.
        </div>
      )}

      <section className="stat-strip grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Services" value={formatNumber(services.length)} icon={Tag} tone="blue" />
        <MiniStat label="Active" value={formatNumber(services.filter((s) => s.active).length)} icon={Power} tone="green" />
        <MiniStat label="Average item price" value={formatCurrency(avg, { decimals: 0 })} icon={Shirt} tone="violet" sub="Per-item services" />
        <MiniStat label="Most popular" value={top?.name ?? '—'} icon={Sparkles} tone="amber" sub={top ? `${formatNumber(top.garmentCount)} items processed` : undefined} />
      </section>

      <Tabs variant="pills" className="w-fit" value={view} onChange={setView} tabs={[{ value: 'all', label: 'All', count: services.length }, { value: 'active', label: 'Active', count: services.filter((s) => s.active).length }, { value: 'inactive', label: 'Inactive', count: services.filter((s) => !s.active).length }]} />

      {error && !data ? (
        <Card><ErrorState error={error} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</div>
      ) : shown.length === 0 ? (
        <Card><EmptyState icon={Tag} title="No services here" description="Try another filter or add a new service." /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => {
            const Icon = ICONS[s.id] ?? Tag
            return (
              <Card key={s.id} className={`flex flex-col p-5 transition hover:border-slate-300 ${s.active ? '' : 'bg-slate-50/60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.active ? 'bg-sky-soft text-brand' : 'bg-slate-100 text-slate-400'}`}><Icon size={20} /></span>
                  <div className="flex items-center gap-1">
                    {s.active ? <Badge tone="green" dot>Available</Badge> : <Badge tone="slate" dot>Inactive</Badge>}
                    {manage && (
                      <Dropdown
                        items={[
                          { label: 'Edit service', icon: Pencil, onClick: () => setModal({ service: s }) },
                          { label: s.active ? 'Deactivate' : 'Activate', icon: s.active ? PowerOff : Power, onClick: () => toggle(s) },
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
                <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
                  <div>
                    <p className="text-[22px] font-extrabold tabular-nums text-ink">{formatCurrency(s.price, { decimals: 0 })}</p>
                    <p className="text-xs text-muted">per {pricingUnit(s.pricingModel)} · {PRICING_MODELS.find((m) => m.value === s.pricingModel)?.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-bold tabular-nums text-ink">{formatNumber(s.orderCount)} orders</p>
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
