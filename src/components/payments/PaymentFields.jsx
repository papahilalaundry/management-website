import { Field, Input } from '../ui/Field'
import MethodToggle from './MethodToggle'
import { isMpesaMethod } from '../../data/constants'
import { formatCurrency } from '../../utils/formatCurrency'
import { toInputDateTime } from '../../utils/formatDate'

/**
 * Payment details: mode (Paybill / M-Pesa number / Cash), estimated amount,
 * amount actually paid, date paid, and — for M-Pesa — the payer's name as it
 * appears on the M-Pesa message plus the optional M-Pesa code.
 *
 * value:    state from emptyPayment()
 * onChange: (patch) => void
 * errors:   { method, expectedAmount, amount, payerName, reference, paidAt }
 * maxAmount: outstanding balance (amount paid cannot exceed it)
 */
export default function PaymentFields({ value, onChange, errors = {}, maxAmount, amountDisabled = false }) {
  const mpesa = isMpesaMethod(value.method)
  const expected = Number(value.expectedAmount) || 0
  const paid = Number(value.amount) || 0
  const short = expected > 0 && paid > 0 && paid < expected ? expected - paid : 0
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Mode of payment" required error={errors.method} className="sm:col-span-2">
        {() => <MethodToggle value={value.method} onChange={(method) => onChange({ method })} error={errors.method} />}
      </Field>
      <Field label="Estimated amount" optional error={errors.expectedAmount} hint="What the client was expected to pay">
        {(p) => <Input {...p} type="number" min="0" step="1" prefix="KES" value={value.expectedAmount} onChange={(e) => onChange({ expectedAmount: e.target.value })} />}
      </Field>
      <Field
        label="Amount actually paid"
        required
        error={errors.amount}
        hint={short ? `${formatCurrency(short, { decimals: 0 })} less than estimated` : maxAmount != null ? `Up to ${formatCurrency(maxAmount, { decimals: 0 })}` : undefined}
      >
        {(p) => <Input {...p} type="number" min="0" step="1" prefix="KES" value={value.amount} disabled={amountDisabled} onChange={(e) => onChange({ amount: e.target.value })} />}
      </Field>
      {mpesa && (
        <>
          <Field label="Name on M-Pesa message" required error={errors.payerName} hint="Who sent the money, as shown by M-Pesa">
            {(p) => <Input {...p} value={value.payerName} autoComplete="off" onChange={(e) => onChange({ payerName: e.target.value })} placeholder="e.g. JANE WANJIRU" />}
          </Field>
          <Field label="M-Pesa code" optional error={errors.reference}>
            {(p) => <Input {...p} value={value.reference} maxLength={10} className="font-mono uppercase" onChange={(e) => onChange({ reference: e.target.value.toUpperCase() })} placeholder="e.g. TKD4H7J2LQ" />}
          </Field>
        </>
      )}
      <Field label="Date of payment" required error={errors.paidAt} className={mpesa ? 'sm:col-span-2' : ''}>
        {(p) => <Input {...p} type="datetime-local" value={value.paidAt} max={toInputDateTime(new Date())} onChange={(e) => onChange({ paidAt: e.target.value })} />}
      </Field>
    </div>
  )
}
