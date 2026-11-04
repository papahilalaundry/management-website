import { LogoMark } from '../layout/Logo'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate, formatDateTime } from '../../utils/formatDate'
import { displayPhone } from '../../utils/validators'
import { methodLabel, pricingUnit, stageLabel } from '../../data/constants'

function Header({ business, title, number }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-slate-300 pb-4">
      <div className="flex items-start gap-3">
        <LogoMark size={38} />
        <div className="text-[11px] leading-relaxed text-slate-500">
          <p className="text-[15px] font-extrabold text-ink">{business.name}</p>
          <p>{business.address}</p>
          <p>Tel: {business.phone} · {business.email}</p>
          {business.kraPin && <p>KRA PIN: {business.kraPin}</p>}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand">{title}</p>
        <p className="mt-0.5 font-mono text-[13px] font-bold text-ink">{number}</p>
      </div>
    </div>
  )
}

const Row = ({ label, value, strong, tone }) => (
  <div className={`flex justify-between gap-4 ${strong ? 'text-[14px] font-extrabold text-ink' : 'text-[12px] text-slate-600'}`}>
    <span>{label}</span>
    <span className={`tabular-nums ${tone === 'red' ? 'font-bold text-red-600' : tone === 'green' ? 'font-bold text-emerald-700' : ''}`}>{value}</span>
  </div>
)

/** Printable order receipt. `order` must include customer + payments. */
export function OrderReceipt({ order, business }) {
  const lastMethod = order.payments?.length ? methodLabel(order.payments[order.payments.length - 1].method) : '—'
  return (
    <div className="mx-auto w-full max-w-[560px] bg-white p-6 font-sans text-ink">
      <Header business={business} title="Order Receipt" number={`RCPT-${order.id.replace('PHL-', '')}`} />

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b border-dashed border-slate-300 py-4 text-[12px]">
        <p className="text-slate-500">Order no.</p><p className="text-right font-semibold">{order.id}</p>
        <p className="text-slate-500">Customer</p><p className="text-right font-semibold">{order.customer.name}</p>
        <p className="text-slate-500">Phone</p><p className="text-right">{displayPhone(order.customer.phone)}</p>
        <p className="text-slate-500">Date received</p><p className="text-right">{formatDateTime(order.receivedAt)}</p>
        <p className="text-slate-500">Expected completion</p><p className="text-right font-semibold">{formatDateTime(order.dueAt)}</p>
        {order.status === 'cancelled' && (<><p className="text-slate-500">Status</p><p className="text-right font-bold text-red-600">CANCELLED</p></>)}
      </div>

      <table className="mt-3 w-full text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10.5px] uppercase tracking-wider text-slate-500">
            <th className="py-2 font-semibold">Item / Service</th>
            <th className="py-2 text-center font-semibold">Qty</th>
            <th className="py-2 text-right font-semibold">Price</th>
            <th className="py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100 align-top">
              <td className="py-2 pr-2">
                <p className="font-semibold">{it.name}</p>
                <p className="text-[11px] text-slate-500">{it.serviceName}</p>
                {it.instructions && <p className="text-[10.5px] italic text-slate-400">{it.instructions}</p>}
              </td>
              <td className="py-2 text-center tabular-nums">{it.quantity}{it.pricingModel === 'per_kg' ? ' kg' : ''}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(it.unitPrice, { decimals: 0 })}<span className="text-[10px] text-slate-400">/{pricingUnit(it.pricingModel)}</span></td>
              <td className="py-2 text-right font-semibold tabular-nums">{formatCurrency(it.quantity * it.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1">
        <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
        {order.surcharge > 0 && <Row label={`${order.priority === 'urgent' ? 'Urgent' : 'Express'} surcharge (${order.surchargeRate}%)`} value={formatCurrency(order.surcharge)} />}
        {order.extraCharges > 0 && <Row label="Delivery / other charges" value={formatCurrency(order.extraCharges)} />}
        {order.discount > 0 && <Row label="Discount" value={`− ${formatCurrency(order.discount)}`} />}
        {order.tax > 0 && <Row label={`Tax (${order.taxRate}%)`} value={formatCurrency(order.tax)} />}
        <div className="my-2 border-t border-slate-200" />
        <Row label="Grand total" value={formatCurrency(order.total)} strong />
        <Row label="Amount paid" value={formatCurrency(order.amountPaid)} tone="green" />
        <Row label="Balance due" value={formatCurrency(order.balance)} tone={order.balance > 0 ? 'red' : undefined} />
        <Row label="Payment method" value={lastMethod} />
        <Row label="Served by" value={order.createdByName} />
      </div>

      <div className="mt-5 border-t border-dashed border-slate-300 pt-4 text-center text-[11px] leading-relaxed text-slate-500">
        <p className="font-semibold text-ink">Thank you for choosing {business.name}!</p>
        <p>{business.receiptFooter}</p>
        <p className="mt-1">{business.hours}</p>
        <p className="mt-2 text-[10px] text-slate-400">Printed {formatDateTime(new Date())} · Status: {stageLabel(order.status)}</p>
      </div>
    </div>
  )
}

/** Printable payment receipt. */
export function PaymentReceipt({ payment, order, business }) {
  return (
    <div className="mx-auto w-full max-w-[560px] bg-white p-6 font-sans text-ink">
      <Header business={business} title="Payment Receipt" number={payment.id} />
      <div className="my-5 rounded-xl bg-emerald-50 py-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Amount received</p>
        <p className="mt-1 text-[26px] font-extrabold tabular-nums text-emerald-800">{formatCurrency(payment.amount)}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
        <p className="text-slate-500">Customer</p><p className="text-right font-semibold">{payment.customerName ?? order?.customer?.name}</p>
        <p className="text-slate-500">Order no.</p><p className="text-right font-semibold">{payment.orderId}</p>
        <p className="text-slate-500">Payment date</p><p className="text-right">{formatDateTime(payment.paidAt)}</p>
        <p className="text-slate-500">Payment method</p><p className="text-right">{methodLabel(payment.method)}</p>
        <p className="text-slate-500">Transaction ref.</p><p className="text-right font-mono">{payment.reference || '—'}</p>
        <p className="text-slate-500">Received by</p><p className="text-right">{payment.recordedByName}</p>
      </div>
      <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3">
        {order && <Row label="Order total" value={formatCurrency(order.total)} />}
        <Row label="Previous balance" value={formatCurrency(payment.previousBalance)} />
        <Row label="This payment" value={`− ${formatCurrency(payment.amount)}`} />
        <div className="my-2 border-t border-slate-200" />
        <Row label="Remaining balance" value={formatCurrency(payment.balanceAfter)} strong />
      </div>
      {payment.method === 'mpesa' && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-[10.5px] text-slate-500">
          M-Pesa payment recorded manually (simulated) — no live M-Pesa transaction was processed by this system.
        </p>
      )}
      <div className="mt-5 border-t border-dashed border-slate-300 pt-4 text-center text-[11px] text-slate-500">
        <p className="font-semibold text-ink">Thank you for your payment!</p>
        <p className="mt-1">{business.receiptFooter}</p>
        <p className="mt-2 text-[10px] text-slate-400">Printed {formatDate(new Date())}</p>
      </div>
    </div>
  )
}
