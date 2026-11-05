import { MessageSquare, Trash2 } from 'lucide-react'
import { Field, Input, Select } from '../ui/Field'
import { formatQuantity, pricingUnitMeta, unitLabel } from '../../data/constants'
import { lineTotal } from '../../utils/calculations'
import { formatCurrency } from '../../utils/formatCurrency'

/** "Name — KES 250/pair" */
const serviceOptionLabel = (s) => `${s.name} — ${formatCurrency(s.price, { decimals: 0 })}/${unitLabel(s)}${s.priceEditable ? ' (price varies)' : ''}`

/**
 * One service on an order: which service, how much of it (in the service's
 * unit), the price per unit (editable only for services that allow it), notes.
 *
 * line:      { key, id?, serviceId, quantity, unitPrice, notes, showNotes }
 * effective: { unit, unitLabel, quantity, unitPrice, minCharge } — what the total is computed from
 * services:  services to choose from
 */
export default function ServiceLineRow({ index, line, effective, service, services, errors = {}, onChange, onRemove, canRemove, storedPrice }) {
  const meta = pricingUnitMeta(service?.unit)
  const unit = service ? unitLabel(service) : ''
  const total = service ? lineTotal(effective) : 0
  const raw = service ? (Number(effective.quantity) || 0) * (Number(effective.unitPrice) || 0) : 0
  const minApplied = service && Number(effective.quantity) > 0 && effective.minCharge > 0 && raw < effective.minCharge
  const set = (patch) => onChange({ ...line, ...patch })

  return (
    <div className="rounded-xl border border-line bg-white p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_130px_auto] sm:items-start">
        <Field label={index === 0 ? 'Service' : <span className="sm:sr-only">Service</span>} required error={errors.serviceId}>
          {(p) => (
            <Select
              {...p}
              value={line.serviceId}
              onChange={(e) => {
                const next = services.find((s) => s.id === e.target.value)
                set({ serviceId: e.target.value, unitPrice: next ? String(next.price) : '' })
              }}
              placeholder="Select service"
            >
              {services.map((s) => <option key={s.id} value={s.id}>{serviceOptionLabel(s)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={index === 0 ? 'Quantity' : <span className="sm:sr-only">Quantity</span>} required error={errors.quantity}>
          {(p) => (
            <Input
              {...p}
              type="number"
              inputMode={meta.decimals ? 'decimal' : 'numeric'}
              min={meta.decimals ? '0.1' : '1'}
              step={meta.decimals ? '0.1' : '1'}
              suffix={unit || undefined}
              value={line.quantity}
              onChange={(e) => set({ quantity: e.target.value })}
              placeholder={meta.decimals ? '0.0' : '0'}
            />
          )}
        </Field>
        <Field label={index === 0 ? `Price${unit ? ` per ${unit}` : ''}` : <span className="sm:sr-only">Price</span>} error={errors.unitPrice}>
          {(p) => service?.priceEditable ? (
            <Input {...p} type="number" min="0" step="1" prefix="KES" value={line.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} />
          ) : (
            <Input {...p} prefix="KES" value={service ? String(effective.unitPrice) : ''} disabled title={storedPrice != null && service && storedPrice !== service.price ? `Agreed price on this order (current price ${formatCurrency(service.price, { decimals: 0 })})` : 'Set on the Services page'} />
          )}
        </Field>
        <div className={`flex items-center justify-between gap-2 sm:flex-col sm:items-end ${index === 0 ? 'sm:pt-[26px]' : ''}`}>
          <span className="text-[15px] font-extrabold tabular-nums text-ink sm:h-10 sm:leading-10">{formatCurrency(total, { decimals: 0 })}</span>
          <div className="flex gap-1">
            <button type="button" onClick={() => set({ showNotes: !line.showNotes })} className={`rounded-lg p-2 transition hover:bg-slate-100 ${line.notes ? 'text-brand' : 'text-slate-400'}`} aria-label="Line notes" title="Notes (e.g. white sneakers)">
              <MessageSquare size={16} />
            </button>
            {canRemove && (
              <button type="button" onClick={onRemove} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Remove service">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      {service && (
        <p className="mt-2 text-[11.5px] text-muted">
          {formatQuantity(Number(effective.quantity) || 0, effective)} × {formatCurrency(effective.unitPrice, { decimals: 0 })}
          {minApplied && <span className="font-semibold text-amber-700"> · minimum charge {formatCurrency(effective.minCharge, { decimals: 0 })} applies</span>}
          {!minApplied && effective.minCharge > 0 && <span> · minimum charge {formatCurrency(effective.minCharge, { decimals: 0 })}</span>}
          {storedPrice != null && !service.priceEditable && storedPrice !== service.price && <span className="text-amber-700"> · agreed price kept (current {formatCurrency(service.price, { decimals: 0 })})</span>}
        </p>
      )}
      {line.showNotes && (
        <Input className="mt-2" value={line.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Notes for this service, e.g. white sneakers, 2 large rugs" aria-label="Service notes" />
      )}
    </div>
  )
}
