import { useId } from 'react'
import { Copy, StickyNote, Trash2 } from 'lucide-react'
import { Field, Input, Select, Textarea } from '../ui/Field'
import Tooltip from '../ui/Tooltip'
import { GARMENT_CATALOG, GARMENT_CATEGORIES, pricingUnit } from '../../data/constants'
import { formatCurrency } from '../../utils/formatCurrency'
import { lineTotal } from '../../utils/calculations'

/** Suggested default service per garment (staff can always change it). */
const DEFAULT_SERVICE = {
  'Suit (2-piece)': 'SRV-08', 'Suit (3-piece)': 'SRV-08', Duvet: 'SRV-05', 'Duvet cover': 'SRV-02', Blanket: 'SRV-06',
  Curtain: 'SRV-07', 'Mixed load': 'SRV-09', Jacket: 'SRV-04', Coat: 'SRV-04', Tie: 'SRV-04', Jeans: 'SRV-01', 'T-shirt': 'SRV-01', Towel: 'SRV-01', Sweater: 'SRV-01',
}
// eslint-disable-next-line react-refresh/only-export-components
export function suggestedServiceId(name, services) {
  const id = DEFAULT_SERVICE[name] ?? 'SRV-02'
  return services.find((s) => s.id === id && s.active)?.id ?? services.find((s) => s.active)?.id ?? ''
}

/**
 * One garment line in the order form.
 * errors keys: name, quantity, serviceId, unitPrice
 */
export default function GarmentRow({ index, item, services, errors = {}, onChange, onRemove, onDuplicate, canRemove }) {
  const hasError = Object.values(errors).some(Boolean)
  const listId = useId()
  const service = services.find((s) => s.id === item.serviceId)
  const unit = pricingUnit(service?.pricingModel ?? item.pricingModel)
  const update = (patch) => onChange({ ...item, ...patch })

  const changeService = (serviceId) => {
    const s = services.find((x) => x.id === serviceId)
    update({ serviceId, unitPrice: s ? s.price : item.unitPrice, pricingModel: s?.pricingModel })
  }
  const changeName = (name) => {
    const patch = { name }
    const known = Object.values(GARMENT_CATALOG).flat().includes(name)
    if (known && !item.priceTouched) {
      const sid = suggestedServiceId(name, services)
      const s = services.find((x) => x.id === sid)
      if (s) Object.assign(patch, { serviceId: sid, unitPrice: s.price, pricingModel: s.pricingModel })
    }
    update(patch)
  }

  return (
    <div className={`rounded-xl border bg-white p-4 transition ${hasError ? 'border-red-200' : 'border-line hover:border-slate-300'}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[13px] font-bold text-ink">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy-900 text-[11px] text-white">{index + 1}</span>
          {item.name || 'New garment'}
        </span>
        <div className="flex items-center gap-1">
          <Tooltip content="Duplicate line">
            <button type="button" onClick={onDuplicate} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Duplicate garment ${index + 1}`}><Copy size={15} /></button>
          </Tooltip>
          <Tooltip content={item.showNotes ? 'Hide notes' : 'Add care / condition notes'}>
            <button type="button" onClick={() => update({ showNotes: !item.showNotes })} className={`rounded-md p-1.5 hover:bg-slate-100 ${item.instructions || item.condition ? 'text-amber-500' : 'text-slate-400 hover:text-ink'}`} aria-label={`Notes for garment ${index + 1}`} aria-expanded={!!item.showNotes}><StickyNote size={15} /></button>
          </Tooltip>
          {canRemove && (
            <Tooltip content="Remove garment">
              <button type="button" onClick={onRemove} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove garment ${index + 1}`}><Trash2 size={15} /></button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        <Field label="Category" className="sm:col-span-4 xl:col-span-3">
          {(p) => <Select {...p} value={item.category} onChange={(e) => update({ category: e.target.value, name: e.target.value === 'Other' ? '' : item.name })} options={GARMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} />}
        </Field>
        <Field label="Garment" required error={errors.name} className="sm:col-span-8 xl:col-span-4">
          {(p) => (
            <>
              <Input {...p} list={listId} value={item.name} onChange={(e) => changeName(e.target.value)} placeholder={item.category === 'Other' ? 'Describe the item' : 'e.g. Shirt'} autoComplete="off" />
              <datalist id={listId}>
                {(GARMENT_CATALOG[item.category] ?? []).map((g) => <option key={g} value={g} />)}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Service" required error={errors.serviceId} className="sm:col-span-12 xl:col-span-5">
          {(p) => (
            <Select {...p} value={item.serviceId} onChange={(e) => changeService(e.target.value)} placeholder="Select service">
              {services.filter((s) => s.active || s.id === item.serviceId).map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {formatCurrency(s.price, { decimals: 0 })}/{pricingUnit(s.pricingModel)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={unit === 'kg' ? 'Weight (kg)' : 'Quantity'} required error={errors.quantity} className="sm:col-span-4 xl:col-span-3">
          {(p) => <Input {...p} type="number" inputMode="decimal" min={unit === 'kg' ? '0.5' : '1'} step={unit === 'kg' ? '0.5' : '1'} value={item.quantity} onChange={(e) => update({ quantity: e.target.value })} />}
        </Field>
        <Field label={`Price / ${unit}`} required error={errors.unitPrice} className="sm:col-span-4 xl:col-span-4">
          {(p) => <Input {...p} type="number" inputMode="decimal" min="0" step="10" prefix="KES" value={item.unitPrice} onChange={(e) => update({ unitPrice: e.target.value, priceTouched: true })} />}
        </Field>
        <div className="flex flex-col justify-end sm:col-span-4 xl:col-span-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted sm:text-right">Subtotal</p>
          <p className="h-10 whitespace-nowrap text-[15px] font-extrabold leading-10 tabular-nums text-ink sm:text-right">{formatCurrency(lineTotal(item), { decimals: 0 })}</p>
        </div>
      </div>
      {service && Number(item.unitPrice) !== service.price && item.unitPrice !== '' && (
        <p className="mt-2 text-[11.5px] text-amber-700">Custom price — list price is {formatCurrency(service.price, { decimals: 0 })}/{unit}. The agreed price is saved on this order.</p>
      )}

      {item.showNotes && (
        <div className="mt-3 grid animate-fade-in gap-3 sm:grid-cols-2">
          <Field label="Special instructions" optional>
            {(p) => <Textarea {...p} rows={2} value={item.instructions} onChange={(e) => update({ instructions: e.target.value })} placeholder="e.g. Low heat, no starch, hang dry" />}
          </Field>
          <Field label="Condition notes" optional hint="Record stains, tears or missing buttons at drop-off.">
            {(p) => <Textarea {...p} rows={2} value={item.condition} onChange={(e) => update({ condition: e.target.value })} placeholder="e.g. Small stain on left cuff" />}
          </Field>
        </div>
      )}
    </div>
  )
}
