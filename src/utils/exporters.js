/**
 * Excel / CSV exports. SheetJS is loaded lazily on first export.
 * columns: [{ header, value: (row) => any }]
 */
import { format } from 'date-fns'

const stamp = () => format(new Date(), 'yyyy-MM-dd')

function toMatrix(rows, columns) {
  return [columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => c.value(r) ?? ''))]
}

/** sheets: [{ name, rows, columns }] */
export async function exportExcel(sheets, baseName) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(toMatrix(s.rows, s.columns))
    ws['!cols'] = s.columns.map((c) => ({ wch: Math.max(10, Math.min(40, c.header.length + 6)) }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, `${baseName}-${stamp()}.xlsx`)
}

export function exportCsv(rows, columns, baseName) {
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = toMatrix(rows, columns).map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}-${stamp()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
