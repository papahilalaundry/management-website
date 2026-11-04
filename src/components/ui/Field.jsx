import { forwardRef, useId } from 'react'
import { Check, ChevronDown, CircleAlert } from 'lucide-react'

/**
 * Label + control + hint/error wrapper.
 * Children may be a render function receiving accessibility props:
 *   <Field label="Name">{(p) => <Input {...p} />}</Field>
 */
export function Field({ label, error, hint, required, children, className = '', htmlFor, optional }) {
  const autoId = useId()
  const id = htmlFor ?? autoId
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
          {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined, error: !!error })
        : children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs font-medium text-red-600" role="alert">
          <CircleAlert size={13} aria-hidden className="shrink-0" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className = '', error, prefix, suffix, ...props }, ref) {
  if (prefix || suffix) {
    return (
      <div className={`relative flex items-center ${className}`}>
        {prefix && <span className="pointer-events-none absolute left-3 text-xs font-semibold text-slate-400">{prefix}</span>}
        <input
          ref={ref}
          className={`field-input ${error ? 'has-error' : ''} ${prefix ? (String(prefix).length > 2 ? 'pl-12' : 'pl-9') : ''} ${suffix ? 'pr-14' : ''}`}
          {...props}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-xs font-medium text-slate-400">{suffix}</span>}
      </div>
    )
  }
  return <input ref={ref} className={`field-input ${error ? 'has-error' : ''} ${className}`} {...props} />
})

export const Select = forwardRef(function Select({ className = '', error, options = [], placeholder, children, ...props }, ref) {
  return (
    <div className={`relative ${className}`}>
      <select ref={ref} className={`field-input cursor-pointer appearance-none pr-9 ${error ? 'has-error' : ''}`} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className = '', error, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={`field-input h-auto min-h-[72px] resize-y py-2.5 ${error ? 'has-error' : ''} ${className}`} {...props} />
})

export function Checkbox({ label, description, className = '', id: idProp, ...props }) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <label htmlFor={id} className={`flex cursor-pointer select-none items-start gap-2.5 ${className}`}>
      <span className="relative mt-px flex h-[18px] w-[18px] shrink-0">
        <input
          id={id}
          type="checkbox"
          className="peer h-full w-full cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-slate-300 bg-white shadow-[inset_0_1px_1px_rgb(16_24_40/0.06)] transition-all duration-150 hover:border-brand/70 checked:border-brand checked:bg-brand checked:shadow-[0_2px_6px_-1px_rgb(37_99_235/0.45)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        />
        <Check
          size={13}
          strokeWidth={3.5}
          className="pointer-events-none absolute inset-0 m-auto scale-50 text-white opacity-0 transition-all duration-150 ease-out peer-checked:scale-100 peer-checked:opacity-100"
          aria-hidden
        />
      </span>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-ink">{label}</span>}
          {description && <span className="text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  )
}

export function Switch({ checked, onChange, label, description, disabled, id: idProp }) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <label htmlFor={id} className="flex cursor-pointer flex-col">
          <span className="text-sm font-semibold text-ink">{label}</span>
          {description && <span className="mt-0.5 text-xs text-muted">{description}</span>}
        </label>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
