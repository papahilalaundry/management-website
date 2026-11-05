import { useId } from 'react'
import { Copy, StickyNote, Trash2 } from 'lucide-react'
import { Field, Input, Select, Textarea } from '../ui/Field'
import Tooltip from '../ui/Tooltip'
import { GARMENT_CATALOG, GARMENT_CATEGORIES } from '../../data/constants'

/**
 * One garment line in the order form. Garments are counted for tracking only —
 * the order is priced by weight, so there is no price or service per garment.
 * errors keys: name, quantity
 */
export default function GarmentRow({ index, item, errors = {}, onChange, onRemove, onDuplicate, canRemove }) {
  const hasError = Object.values(errors).some(Boolean)
  const listId = useId()
  const update = (patch) => onChange({ ...item, ...patch })

  return (
    <div className={`rounded-xl border bg-white p-3.5 transition sm:p-4 ${hasError ? 'border-red-200' : 'border-line hover:border-slate-300'}`}>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
        <Field label="Category" className="sm:col-span-4">
          {(p) => <Select {...p} value={item.category} onChange={(e) => update({ category: e.target.value, name: e.target.value === 'Other' ? '' : item.name })} options={GARMENT_CATEGORIES.map((c) => ({ value: c, label: c }))} />}
        </Field>
        <Field label="Garment" required error={errors.name} className="sm:col-span-5">
          {(p) => (
            <>
              <Input {...p} list={listId} value={item.name} onChange={(e) => update({ name: e.target.value })} placeholder={item.category === 'Other' ? 'Describe the item' : 'e.g. Trousers'} autoComplete="off" />
              <datalist id={listId}>
                {(GARMENT_CATALOG[item.category] ?? []).map((g) => <option key={g} value={g} />)}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Pieces" required error={errors.quantity} className="col-span-2 sm:col-span-3">
          {(p) => <Input {...p} type="number" inputMode="numeric" min="1" step="1" value={item.quantity} onChange={(e) => update({ quantity: e.target.value })} />}
        </Field>
      </div>

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
