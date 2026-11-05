import { useCallback, useState } from 'react'
import { endOfDay, endOfMonth, format, startOfDay, startOfMonth, subMonths } from 'date-fns'
import { CalendarDays, Download, FileSpreadsheet, FileText, MoreHorizontal, Paperclip, Pencil, Plus, ReceiptText, Tags, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { expenseService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { usePagedQuery } from '../hooks/usePagedQuery'
import { useDebounce } from '../hooks/useDebounce'
import { useSettings } from '../context/SettingsContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import SearchInput from '../components/ui/SearchInput'
import DataTable from '../components/ui/DataTable'
import Dropdown from '../components/ui/Dropdown'
import Badge from '../components/ui/Badge'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { MiniStat } from '../components/shared/StatCard'
import { MethodBadge } from '../components/shared/StatusBadges'
import DateRangeFilter from '../components/shared/DateRangeFilter'
import { describeRange, rangeFromPreset } from '../utils/dateRanges'
import { BarList, VolumeBarChart } from '../components/charts/Charts'
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS, methodLabel } from '../data/constants'
import { formatCompactCurrency, formatCurrency } from '../utils/formatCurrency'
import { formatDate, toInputDate } from '../utils/formatDate'
import { percentChange } from '../utils/calculations'
import { validateExpense } from '../utils/validators'
import { exportCsv, exportExcel } from '../utils/exporters'

const EMPTY = { title: '', category: '', amount: '', date: toInputDate(new Date()), method: 'mpesa', vendor: '', reference: '', notes: '', attachmentName: '' }

function ExpenseFormModal({ open, onClose, expense, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(expense ? { ...EMPTY, ...expense, amount: String(expense.amount), date: toInputDate(expense.date) } : { ...EMPTY, date: toInputDate(new Date()) })
      setErrors({})
    }
  }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })) }
  const submit = async (e) => {
    e.preventDefault()
    const v = validateExpense(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const payload = { ...form, date: new Date(`${form.date}T12:00:00`).toISOString() }
      const saved = expense ? await expenseService.updateExpense(expense.id, payload) : await expenseService.createExpense(payload)
      toast.success(expense ? 'Expense updated' : `Expense ${saved.id} recorded`, { description: `${saved.title} · ${formatCurrency(saved.amount)}` })
      onSaved()
      onClose()
    } catch (err) {
      setErrors(err.fields ?? {})
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={expense ? Pencil : ReceiptText} title={expense ? `Edit expense ${expense.id}` : 'Record expense'} description="Track what the business spends money on."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="expense-form" loading={saving}>{expense ? 'Save changes' : 'Record expense'}</Button></>}>
      <form id="expense-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Expense title" required error={errors.title} className="sm:col-span-2">{(p) => <Input {...p} value={form.title} onChange={set('title')} placeholder="e.g. Detergent restock" data-autofocus />}</Field>
        <Field label="Category" required error={errors.category}>{(p) => <Select {...p} value={form.category} onChange={set('category')} placeholder="Select category" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} />}</Field>
        <Field label="Amount" required error={errors.amount}>{(p) => <Input {...p} type="number" min="0" step="1" prefix="KES" value={form.amount} onChange={set('amount')} placeholder="0" />}</Field>
        <Field label="Date" required error={errors.date}>{(p) => <Input {...p} type="date" value={form.date} max={toInputDate(new Date())} onChange={set('date')} />}</Field>
        <Field label="Payment method" required error={errors.method}>{(p) => <Select {...p} value={form.method} onChange={set('method')} options={EXPENSE_PAYMENT_METHODS} />}</Field>
        <Field label="Vendor / supplier" optional>{(p) => <Input {...p} value={form.vendor} onChange={set('vendor')} placeholder="e.g. Chandarana Wholesalers" />}</Field>
        <Field label="Reference number" optional>{(p) => <Input {...p} value={form.reference} onChange={set('reference')} placeholder="M-Pesa code / invoice no." />}</Field>
        <Field label="Notes" optional className="sm:col-span-2">{(p) => <Textarea {...p} rows={2} value={form.notes} onChange={set('notes')} />}</Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Receipt attachment <span className="font-normal text-slate-400">(optional)</span></p>
          {form.attachmentName ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-[13px]">
              <Paperclip size={15} className="text-slate-400" /> <span className="flex-1 truncate">{form.attachmentName}</span>
              <button type="button" onClick={() => setForm((f) => ({ ...f, attachmentName: '' }))} className="rounded p-1 text-slate-400 hover:bg-white hover:text-ink" aria-label="Remove attachment"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-[13px] text-muted transition hover:border-brand hover:text-brand">
              <Paperclip size={15} /> Attach receipt photo or PDF
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && setForm((f) => ({ ...f, attachmentName: e.target.files[0].name }))} />
            </label>
          )}
          <p className="mt-1 text-[11px] text-muted">Placeholder: only the file name is stored in this demo. File storage requires a backend.</p>
        </div>
      </form>
    </Modal>
  )
}

const WATCH = ['expenses']
const iso = (d) => d.toISOString()

/** Totals for the cards and charts, from the daily summaries (no expense records are read). */
async function loadExpenseOverview(range) {
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i))
  const [inRange, today, ...monthly] = await Promise.all([
    expenseService.getExpenseStats({ from: range.from, to: range.to }),
    expenseService.getExpenseStats({ from: iso(startOfDay(now)), to: iso(endOfDay(now)) }),
    ...months.map((m) => expenseService.getExpenseStats({ from: iso(startOfMonth(m)), to: iso(endOfMonth(m)) })),
  ])
  const thisMonth = monthly[5].total
  const lastMonth = monthly[4].total
  const breakdown = Object.entries(inRange.byCategory ?? {}).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  return {
    total: inRange.total,
    breakdown,
    today: today.total,
    thisMonth,
    lastMonth,
    change: percentChange(thisMonth, lastMonth),
    monthly: months.map((m, i) => ({ short: format(m, 'MMM'), label: format(m, 'MMMM yyyy'), expenses: monthly[i].total })),
  }
}

export default function Expenses() {
  const { business } = useSettings()
  const [range, setRange] = useState(() => rangeFromPreset('month'))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const search = useDebounce(query.trim(), 300)
  const filters = { from: range.from, to: range.to, category }

  const overview = useAsync(() => loadExpenseOverview(range), [range.from, range.to], { live: true, watch: WATCH })
  const stats = overview.data
  const fetchPage = useCallback(
    ({ pageSize, cursor }) => expenseService.listExpenses({ from: range.from, to: range.to, category, search, pageSize, cursor }),
    [range.from, range.to, category, search],
  )
  const table = usePagedQuery(fetchPage, {
    key: JSON.stringify([range.from, range.to, category, search]),
    pageSize: 15,
    count: () => expenseService.countExpenses({ from: range.from, to: range.to, category }),
    watch: WATCH,
  })
  const pageTotal = table.pageRows.reduce((s, e) => s + e.amount, 0)

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await expenseService.deleteExpense(deleting.id)
      toast.success(`Expense ${deleting.id} deleted`)
      setDeleting(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const EXPORT_COLUMNS = [
    { header: 'Expense ID', value: (e) => e.id }, { header: 'Title', value: (e) => e.title }, { header: 'Category', value: (e) => e.category },
    { header: 'Date', value: (e) => formatDate(e.date) }, { header: 'Amount (KES)', value: (e) => e.amount }, { header: 'Method', value: (e) => methodLabel(e.method) },
    { header: 'Vendor', value: (e) => e.vendor }, { header: 'Reference', value: (e) => e.reference }, { header: 'Recorded by', value: (e) => e.recordedByName },
  ]
  const doExport = async (kind) => {
    try {
      const rows = search ? (await expenseService.listExpenses({ ...filters, search })).rows : await expenseService.exportExpenses(filters)
      if (!rows.length) return toast.error('No expenses to export.')
      if (kind === 'xlsx') await exportExcel([{ name: 'Expenses', rows, columns: EXPORT_COLUMNS }], 'papa-hila-expenses')
      else if (kind === 'csv') exportCsv(rows, EXPORT_COLUMNS, 'papa-hila-expenses')
      else {
        const { downloadReportPdf } = await import('../utils/pdf')
        const breakdown = stats?.breakdown ?? []
        await downloadReportPdf({
          title: 'Expense Report', subtitle: describeRange(range), business, fileName: `papa-hila-expenses-${toInputDate(new Date())}.pdf`,
          sections: [
            { title: 'Summary by category', table: { head: ['Category', 'Amount'], body: breakdown.map((b) => [b.label, formatCurrency(b.value)]), foot: ['Total', formatCurrency(stats?.total ?? 0)], align: ['left', 'right'] } },
            { title: 'Expense records', table: { head: ['ID', 'Date', 'Title', 'Category', 'Vendor', 'Amount'], body: rows.map((e) => [e.id, formatDate(e.date), e.title, e.category, e.vendor, formatCurrency(e.amount)]), foot: ['', '', '', '', 'Total', formatCurrency(rows.reduce((s, e) => s + e.amount, 0))], align: ['left', 'left', 'left', 'left', 'left', 'right'] } },
          ],
        })
      }
      toast.success(`Exported ${rows.length} expense${rows.length === 1 ? '' : 's'}`)
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Export failed.')
    }
  }

  const columns = [
    { key: 'id', header: 'ID', render: (e) => <span className="font-mono text-xs font-semibold text-slate-500">{e.id}</span> },
    { key: 'title', header: 'Description', render: (e) => <div className="max-w-[260px]"><p className="truncate font-semibold text-ink">{e.title}</p><p className="flex items-center gap-1 truncate text-xs text-muted">{e.vendor || '—'}{e.attachmentName && <Paperclip size={11} aria-label="Has attachment" />}</p></div> },
    { key: 'category', header: 'Category', hideBelow: 'md', render: (e) => <Badge tone="slate">{e.category}</Badge> },
    { key: 'date', header: 'Date', render: (e) => <span className="text-slate-600">{formatDate(e.date)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', render: (e) => <span className="font-bold text-ink">{formatCurrency(e.amount)}</span> },
    { key: 'method', header: 'Method', hideBelow: 'lg', render: (e) => <MethodBadge method={e.method} /> },
    { key: 'recordedByName', header: 'Recorded by', hideBelow: 'xl', render: (e) => <span className="text-slate-600">{e.recordedByName}</span> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (e) => (
        <Dropdown items={[{ label: 'Edit', icon: Pencil, onClick: () => setModal({ expense: e }) }, { divider: true }, { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDeleting(e) }]}
          trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${e.id}`}><MoreHorizontal size={18} /></button>} />
      ),
    },
  ]
  const top = stats?.breakdown[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record and review what it costs to run Papa Hila."
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Dropdown trigger={<Button variant="secondary" icon={Download}>Export</Button>} items={[{ label: 'Excel (.xlsx)', icon: FileSpreadsheet, onClick: () => doExport('xlsx') }, { label: 'CSV', icon: FileText, onClick: () => doExport('csv') }, { label: 'PDF report', icon: FileText, onClick: () => doExport('pdf') }]} />
            <Button icon={Plus} onClick={() => setModal({})}>Record expense</Button>
          </>
        }
      />

      <section className="stat-strip grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="This month" value={stats ? formatCurrency(stats.thisMonth, { decimals: 0 }) : '—'} icon={ReceiptText} tone="amber" sub={stats ? `Last month ${formatCompactCurrency(stats.lastMonth)}` : undefined} />
        <MiniStat label="Today" value={stats ? formatCurrency(stats.today, { decimals: 0 }) : '—'} icon={CalendarDays} tone="blue" />
        <MiniStat label="Largest category" value={top?.label ?? '—'} icon={Tags} tone="violet" sub={top ? `${formatCurrency(top.value, { decimals: 0 })} · ${describeRange(range).toLowerCase()}` : undefined} />
        <MiniStat label="Trend vs last month" value={stats ? `${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(1)}%` : '—'} icon={stats?.change > 0 ? TrendingUp : TrendingDown} tone={stats?.change > 0 ? 'red' : 'green'} sub="Month to date" />
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Monthly expenses" description="Last 6 months" icon={TrendingUp} />
          <CardBody>{!stats ? <Skeleton className="h-[240px] w-full" /> : <VolumeBarChart data={stats.monthly} dataKey="expenses" name="Expenses" money color="#d97706" height={240} />}</CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="By category" description={stats ? `${describeRange(range)} · ${formatCurrency(stats.total, { decimals: 0 })}` : describeRange(range)} icon={Tags} />
          <CardBody><BarList rows={(stats?.breakdown ?? []).slice(0, 7)} format={(v) => formatCurrency(v, { decimals: 0 })} color="#d97706" /></CardBody>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-4 sm:flex-row">
          <SearchInput value={query} onChange={setQuery} placeholder="Search title, vendor or expense ID…" className="flex-1" />
          <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))} className="sm:w-60" />
        </div>
        {table.error && !table.loaded ? <ErrorState error={table.error} onRetry={table.reload} /> : (
          <DataTable columns={columns} table={table} loading={table.loading && !table.pageRows.length} onRowClick={(e) => setModal({ expense: e })} getRowLabel={(e) => `Edit expense ${e.id}`}
            mobileCard={{
              title: (e) => e.title,
              subtitle: (e) => <>{e.category} · {formatDate(e.date)}</>,
              meta: (e) => (e.vendor ? <span className="inline-flex items-center gap-1">{e.vendor}{e.attachmentName && <Paperclip size={11} aria-label="Has attachment" />}</span> : null),
              value: (e) => formatCurrency(e.amount, { decimals: 0 }),
              badge: (e) => <MethodBadge method={e.method} />,
            }}
            mobileFooter={
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-muted">This page · {table.pageRows.length} expense{table.pageRows.length === 1 ? '' : 's'}</span>
                <span className="tabular-nums text-ink">{formatCurrency(pageTotal)}</span>
              </div>
            }
            empty={<EmptyState icon={ReceiptText} title="No expenses found" description="Try a wider date range or another category, or record a new expense." action={<Button icon={Plus} onClick={() => setModal({})}>Record expense</Button>} />}
            footer={table.pageRows.length > 0 && (
              <tfoot><tr className="bg-slate-50/80 text-[13px] font-bold"><td colSpan={4} className="px-4 py-3 text-muted">Total for this page ({table.pageRows.length})</td><td className="px-4 py-3 text-right tabular-nums text-ink">{formatCurrency(pageTotal)}</td><td colSpan={3} /></tr></tfoot>
            )}
          />
        )}
      </Card>

      <ExpenseFormModal open={!!modal} expense={modal?.expense} onClose={() => setModal(null)} onSaved={() => {}} />
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={confirmDelete} loading={busy} title={`Delete expense ${deleting?.id}?`} message={`“${deleting?.title}” (${formatCurrency(deleting?.amount)}) will be permanently removed and your reports will update.`} confirmLabel="Delete expense" />
    </div>
  )
}
