import { Field, Input, Textarea } from '../ui/Field'

/** Shared customer fields for the customer modal and inline registration. */
export default function CustomerFields({ value, onChange, errors = {}, showNote = false, autoFocus = false }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" required error={errors.name}>
        {(p) => <Input {...p} value={value.name} onChange={set('name')} placeholder="e.g. Wanjiru Kamau" autoComplete="off" data-autofocus={autoFocus || undefined} autoFocus={autoFocus} />}
      </Field>
      <Field label="Phone number" required error={errors.phone} hint={!errors.phone ? 'Safaricom / Airtel, e.g. 0712 345 678' : undefined}>
        {(p) => <Input {...p} type="tel" inputMode="tel" value={value.phone} onChange={set('phone')} placeholder="07XX XXX XXX" autoComplete="off" />}
      </Field>
      <Field label="Email" optional error={errors.email}>
        {(p) => <Input {...p} type="email" value={value.email} onChange={set('email')} placeholder="name@example.com" autoComplete="off" />}
      </Field>
      <Field label="Address" optional error={errors.address}>
        {(p) => <Input {...p} value={value.address} onChange={set('address')} placeholder="Estate, street, house no." autoComplete="off" />}
      </Field>
      {showNote && (
        <Field label="Note" optional className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={value.note ?? ''} onChange={set('note')} placeholder="Preferences, allergies, billing notes…" />}
        </Field>
      )}
    </div>
  )
}
