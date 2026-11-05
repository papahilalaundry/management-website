import { isMpesaMethod } from '../../data/constants'
import { toInputDateTime } from '../../utils/formatDate'

/** Empty payment form state. */
export const emptyPayment = (expected = '') => ({
  method: 'paybill',
  expectedAmount: expected === '' ? '' : String(expected),
  amount: '',
  payerName: '',
  reference: '',
  accountNumber: '',
  paidAt: toInputDateTime(new Date()),
})

/** Converts the form state to the payload the payment services expect. */
export const paymentPayload = (p) => ({
  method: p.method,
  expectedAmount: p.expectedAmount === '' ? undefined : Number(p.expectedAmount),
  amount: Number(p.amount),
  payerName: isMpesaMethod(p.method) ? p.payerName : '',
  reference: isMpesaMethod(p.method) ? p.reference : '',
  accountNumber: p.method === 'paybill' ? (p.accountNumber ?? '').trim() : '',
  paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString(),
})
