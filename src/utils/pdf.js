/**
 * PDF generation (jsPDF + autotable). Loaded lazily so the ~400KB library
 * is only downloaded when someone actually exports.
 */
import { format } from 'date-fns'
import { formatCurrency } from './formatCurrency'
import { formatDateTime } from './formatDate'
import { displayPhone } from './validators'
import { methodLabel, pricingUnit } from '../data/constants'

const NAVY = [20, 43, 74]
const BLUE = [37, 99, 235]
const MUTED = [100, 116, 139]

async function load() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  return { jsPDF, autoTable }
}

/* jsPDF's built-in fonts don't include some glyphs; keep text ASCII-safe. */
const safe = (s) => String(s ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/·/g, '|').replace(/−/g, '-')

function brandHeader(doc, business, title, subtitle) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, w, 26, 'F')
  doc.setFillColor(...BLUE)
  doc.roundedRect(12, 6, 14, 14, 3, 3, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.8)
  doc.circle(19, 13.5, 3.6)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(safe(business.name), 30, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(safe(`${business.address}  |  ${business.phone}  |  ${business.email}`), 30, 17.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(safe(title.toUpperCase()), w - 12, 12, { align: 'right' })
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(safe(subtitle), w - 12, 17.5, { align: 'right' })
  }
  doc.setTextColor(23, 32, 51)
  return 36
}

function footer(doc, text) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const w = doc.internal.pageSize.getWidth()
    const h = doc.internal.pageSize.getHeight()
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(safe(text), 12, h - 8)
    doc.text(`Page ${i} of ${pages}`, w - 12, h - 8, { align: 'right' })
  }
}

function keyValues(doc, autoTable, startY, rows, opts = {}) {
  autoTable(doc, {
    startY,
    body: rows.map(([k, v]) => [safe(k), safe(v)]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4 },
    columnStyles: { 0: { textColor: MUTED, cellWidth: opts.labelWidth ?? 45 }, 1: { fontStyle: 'bold', halign: opts.alignRight ? 'right' : 'left' } },
    margin: { left: 12, right: 12 },
    tableWidth: opts.width ?? 'auto',
  })
  return doc.lastAutoTable.finalY
}

export async function downloadOrderReceiptPdf(order, business) {
  const { jsPDF, autoTable } = await load()
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  let y = brandHeader(doc, business, 'Order Receipt', `RCPT-${order.id.replace('PHL-', '')}`)
  y = keyValues(doc, autoTable, y, [
    ['Order no.', order.id],
    ['Customer', order.customer.name],
    ['Phone', displayPhone(order.customer.phone)],
    ['Date received', formatDateTime(order.receivedAt)],
    ['Expected completion', formatDateTime(order.dueAt)],
    ...(order.status === 'cancelled' ? [['Status', 'CANCELLED']] : []),
  ])
  autoTable(doc, {
    startY: y + 4,
    head: [['Item', 'Service', 'Qty', 'Unit price', 'Subtotal']],
    body: order.items.map((it) => [safe(it.name + (it.instructions ? `\n${it.instructions}` : '')), safe(it.serviceName), `${it.quantity}${it.pricingModel === 'per_kg' ? ' kg' : ''}`, `${formatCurrency(it.unitPrice, { decimals: 0 })}/${pricingUnit(it.pricingModel)}`, formatCurrency(it.quantity * it.unitPrice)]),
    headStyles: { fillColor: NAVY, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 12, right: 12 },
  })
  y = doc.lastAutoTable.finalY + 3
  const lastMethod = order.payments?.length ? methodLabel(order.payments[order.payments.length - 1].method) : '-'
  const totals = [
    ['Subtotal', formatCurrency(order.subtotal)],
    ...(order.surcharge > 0 ? [[`Priority surcharge (${order.surchargeRate}%)`, formatCurrency(order.surcharge)]] : []),
    ...(order.extraCharges > 0 ? [['Delivery / other charges', formatCurrency(order.extraCharges)]] : []),
    ...(order.discount > 0 ? [['Discount', `- ${formatCurrency(order.discount)}`]] : []),
    ...(order.tax > 0 ? [[`Tax (${order.taxRate}%)`, formatCurrency(order.tax)]] : []),
    ['GRAND TOTAL', formatCurrency(order.total)],
    ['Amount paid', formatCurrency(order.amountPaid)],
    ['Balance due', formatCurrency(order.balance)],
    ['Payment method', lastMethod],
    ['Served by', order.createdByName],
  ]
  const w = doc.internal.pageSize.getWidth()
  autoTable(doc, {
    startY: y,
    body: totals.map(([k, v]) => [safe(k), safe(v)]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { textColor: MUTED }, 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: w / 2 - 12, right: 12 },
    didParseCell: (d) => {
      if (d.row.raw[0] === 'GRAND TOTAL') {
        d.cell.styles.fontSize = 11
        d.cell.styles.textColor = NAVY
        d.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = doc.lastAutoTable.finalY + 8
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(safe(`Thank you for choosing ${business.name}!`), w / 2, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(doc.splitTextToSize(safe(business.receiptFooter), w - 30), w / 2, y + 5, { align: 'center' })
  footer(doc, `${business.name} | Generated ${format(new Date(), 'dd MMM yyyy, HH:mm')}`)
  doc.save(`Receipt-${order.id}.pdf`)
}

export async function downloadPaymentReceiptPdf(payment, order, business) {
  const { jsPDF, autoTable } = await load()
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const w = doc.internal.pageSize.getWidth()
  let y = brandHeader(doc, business, 'Payment Receipt', payment.id)
  doc.setFillColor(236, 253, 245)
  doc.roundedRect(12, y, w - 24, 20, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(4, 120, 87)
  doc.text('AMOUNT RECEIVED', w / 2, y + 7, { align: 'center' })
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(formatCurrency(payment.amount), w / 2, y + 15, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(23, 32, 51)
  y = keyValues(doc, autoTable, y + 26, [
    ['Customer', payment.customerName ?? order?.customer?.name],
    ['Order no.', payment.orderId],
    ['Payment date', formatDateTime(payment.paidAt)],
    ['Payment method', methodLabel(payment.method)],
    ['Transaction ref.', payment.reference || '-'],
    ['Received by', payment.recordedByName],
    ['Previous balance', formatCurrency(payment.previousBalance)],
    ['Remaining balance', formatCurrency(payment.balanceAfter)],
  ])
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  if (payment.method === 'mpesa') doc.text('M-Pesa payment recorded manually (simulated). No live M-Pesa transaction was processed.', w / 2, y + 8, { align: 'center' })
  doc.text(doc.splitTextToSize(safe(business.receiptFooter), w - 30), w / 2, y + 14, { align: 'center' })
  footer(doc, `${business.name} | Generated ${format(new Date(), 'dd MMM yyyy, HH:mm')}`)
  doc.save(`Payment-${payment.id}.pdf`)
}

/**
 * Generic branded PDF report.
 * sections: [{ title, summary?: [[label, value]], table?: { head: [...], body: [[...]], foot?: [...] } }]
 */
export async function downloadReportPdf({ title, subtitle, business, sections, fileName, landscape = false }) {
  const { jsPDF, autoTable } = await load()
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: landscape ? 'landscape' : 'portrait' })
  let y = brandHeader(doc, business, title, subtitle)
  for (const s of sections) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage()
      y = 16
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...NAVY)
    doc.text(safe(s.title), 12, y)
    doc.setTextColor(23, 32, 51)
    doc.setFont('helvetica', 'normal')
    y += 2
    if (s.summary) y = keyValues(doc, autoTable, y + 1, s.summary, { labelWidth: 70 }) + 4
    if (s.table) {
      autoTable(doc, {
        startY: y + 1,
        head: [s.table.head.map(safe)],
        body: s.table.body.map((r) => r.map(safe)),
        foot: s.table.foot ? [s.table.foot.map(safe)] : undefined,
        headStyles: { fillColor: NAVY, fontSize: 8 },
        footStyles: { fillColor: [234, 243, 255], textColor: NAVY, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles: s.table.align ? Object.fromEntries(s.table.align.map((a, i) => [i, { halign: a }])) : undefined,
        margin: { left: 12, right: 12 },
      })
      y = doc.lastAutoTable.finalY + 10
    }
  }
  footer(doc, `${business.name} | ${title} | Generated ${format(new Date(), 'dd MMM yyyy, HH:mm')}`)
  doc.save(fileName)
}
