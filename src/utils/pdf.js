/**
 * PDF generation (jsPDF + autotable). Loaded lazily so the ~400KB library
 * is only downloaded when someone actually exports.
 */
import { format } from 'date-fns'
import { formatCurrency } from './formatCurrency'
import { formatDate, formatDateTime } from './formatDate'
import { displayPhone } from './validators'
import { formatQuantity, isMpesaMethod, methodLabel } from '../data/constants'

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
  doc.text(safe([business.address, business.phone, business.email].filter(Boolean).join('  |  ')), 30, 17.5)
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
    ...(order.deliveryAt ? [['Delivery date', formatDateTime(order.deliveryAt)]] : []),
    ...(order.deliveredAt ? [['Delivered on', formatDateTime(order.deliveredAt)]] : []),
    ...(order.status === 'cancelled' ? [['Status', 'CANCELLED']] : []),
  ])
  autoTable(doc, {
    startY: y + 4,
    head: [['Service', 'Quantity', 'Price', 'Amount']],
    body: order.lines.map((l) => [safe(l.serviceName + (l.notes ? `\n${l.notes}` : '')), formatQuantity(l.quantity, l), formatCurrency(l.unitPrice, { decimals: 0 }), formatCurrency(l.total)]),
    headStyles: { fillColor: NAVY, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 12, right: 12 },
  })
  y = doc.lastAutoTable.finalY
  if (order.items.length) autoTable(doc, {
    startY: y + 3,
    head: [['Garment', 'Pieces']],
    body: [
      ...order.items.map((it) => [safe(it.name + (it.instructions ? `\n${it.instructions}` : '') + (it.condition ? `\nCondition: ${it.condition}` : '')), String(it.quantity)]),
      ['Total garments', String(order.garmentCount)],
    ],
    headStyles: { fillColor: NAVY, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 12, right: 12 },
  })
  y = doc.lastAutoTable.finalY + 3
  if (order.payments?.length) {
    autoTable(doc, {
      startY: y,
      head: [['Paid on', 'Mode', 'Paid by / M-Pesa code', 'Amount']],
      body: order.payments.map((p) => [formatDate(p.paidAt), methodLabel(p.method), safe([p.payerName, p.reference, p.accountNumber && `Acc ${p.accountNumber}`].filter(Boolean).join(' | ') || '-'), formatCurrency(p.amount)]),
      headStyles: { fillColor: [100, 116, 139], fontSize: 7.5 },
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: 12, right: 12 },
    })
    y = doc.lastAutoTable.finalY + 3
  }
  const totals = [
    ['Services subtotal', formatCurrency(order.subtotal)],
    ...(order.surcharge > 0 ? [[`Priority surcharge (${order.surchargeRate}%)`, formatCurrency(order.surcharge)]] : []),
    ...(order.extraCharges > 0 ? [['Delivery / other charges', formatCurrency(order.extraCharges)]] : []),
    ...(order.discount > 0 ? [['Discount', `- ${formatCurrency(order.discount)}`]] : []),
    ...(order.tax > 0 ? [[`Tax (${order.taxRate}%)`, formatCurrency(order.tax)]] : []),
    ['GRAND TOTAL', formatCurrency(order.total)],
    ['Amount paid', formatCurrency(order.amountPaid)],
    ['Balance due', formatCurrency(order.balance)],
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
  const pay = order.balance > 0 && order.status !== 'cancelled'
    ? [business.paybillNumber && `Pay via M-Pesa Paybill ${business.paybillNumber}, Account: ${business.paybillAccount || order.id}`, business.mpesaNumber && `Or send money to M-Pesa ${business.mpesaNumber}`].filter(Boolean)
    : []
  if (pay.length) {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(4, 120, 87)
    pay.forEach((line, i) => doc.text(safe(line), w / 2, y + i * 4.5, { align: 'center' }))
    doc.setTextColor(23, 32, 51)
    y += pay.length * 4.5 + 4
  }
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
    ['Date of payment', formatDateTime(payment.paidAt)],
    ['Mode of payment', methodLabel(payment.method)],
    ...(isMpesaMethod(payment.method) ? [['Paid by (M-Pesa name)', payment.payerName || '-'], ['M-Pesa code', payment.reference || '-']] : []),
    ...(payment.accountNumber ? [['Paybill account', payment.accountNumber]] : []),
    ['Received by', payment.recordedByName],
    ...(payment.expectedAmount != null ? [['Estimated amount', formatCurrency(payment.expectedAmount)]] : []),
    ['Amount paid', formatCurrency(payment.amount)],
    ['Previous balance', formatCurrency(payment.previousBalance)],
    ['Balance after this payment', formatCurrency(payment.balanceAfter)],
  ])
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  if (isMpesaMethod(payment.method)) doc.text('M-Pesa payment recorded by staff from the M-Pesa message.', w / 2, y + 8, { align: 'center' })
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
