import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, History, MoreHorizontal, Package, PackageX, Pencil, Plus, SlidersHorizontal, Trash2, TriangleAlert, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useTable } from '../hooks/useTable'
import { useDebounce } from '../hooks/useDebounce'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select, Textarea } from '../components/ui/Field'
import SearchInput from '../components/ui/SearchInput'
import DataTable from '../components/ui/DataTable'
import Dropdown from '../components/ui/Dropdown'
import Tabs from '../components/ui/Tabs'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { MiniStat } from '../components/shared/StatCard'
import { StockBadge } from '../components/shared/StatusBadges'
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../data/constants'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDateTime, timeAgo } from '../utils/formatDate'
import { validateInventoryItem } from '../utils/validators'

const EMPTY = { name: '', category: '', unit: '', stock: '0', minStock: '', unitCost: '', supplier: '' }
const MOVE_META = {
  received: { label: 'Record stock received', icon: ArrowDownToLine, verb: 'Quantity received', reason: 'Restock delivery', tone: 'text-emerald-600 bg-emerald-50' },
  used: { label: 'Record stock usage', icon: ArrowUpFromLine, verb: 'Quantity used', reason: 'Daily usage', tone: 'text-amber-600 bg-amber-50' },
  adjustment: { label: 'Stock adjustment', icon: SlidersHorizontal, verb: 'Change (+/−)', reason: '', tone: 'text-violet-600 bg-violet-50' },
}

function ItemFormModal({ open, onClose, item, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(item ? { ...item, stock: String(item.stock), minStock: String(item.minStock), unitCost: String(item.unitCost) } : EMPTY)
      setErrors({})
    }
  }
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })) }
  const submit = async (e) => {
    e.preventDefault()
    const v = validateInventoryItem(form)
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const saved = item ? await inventoryService.updateItem(item.id, form) : await inventoryService.createItem(form)
      toast.success(item ? `${saved.name} updated` : `${saved.name} added to inventory`)
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
    <Modal open={open} onClose={onClose} size="lg" icon={item ? Pencil : Plus} title={item ? `Edit ${item.name}` : 'Add inventory item'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="item-form" loading={saving}>{item ? 'Save changes' : 'Add item'}</Button></>}>
      <form id="item-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Item name" required error={errors.name} className="sm:col-span-2">{(p) => <Input {...p} value={form.name} onChange={set('name')} placeholder="e.g. Powder detergent (Ariel)" data-autofocus />}</Field>
        <Field label="Category" required error={errors.category}>{(p) => <Select {...p} value={form.category} onChange={set('category')} placeholder="Select category" options={INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c }))} />}</Field>
        <Field label="Unit of measurement" required error={errors.unit}>{(p) => <Select {...p} value={form.unit} onChange={set('unit')} placeholder="Select unit" options={INVENTORY_UNITS.map((c) => ({ value: c, label: c }))} />}</Field>
        <Field label={item ? 'Current stock' : 'Opening stock'} required error={errors.stock} hint={item ? 'Use “Record stock” actions to change stock levels.' : undefined}>{(p) => <Input {...p} type="number" min="0" value={form.stock} onChange={set('stock')} disabled={!!item} suffix={form.unit} />}</Field>
        <Field label="Minimum stock threshold" required error={errors.minStock} hint="Alert when stock falls to this level">{(p) => <Input {...p} type="number" min="0" value={form.minStock} onChange={set('minStock')} suffix={form.unit} />}</Field>
        <Field label="Unit cost" required error={errors.unitCost}>{(p) => <Input {...p} type="number" min="0" prefix="KES" value={form.unitCost} onChange={set('unitCost')} />}</Field>
        <Field label="Supplier" optional>{(p) => <Input {...p} value={form.supplier} onChange={set('supplier')} placeholder="e.g. Chandarana Wholesalers" />}</Field>
      </form>
    </Modal>
  )
}

function MovementModal({ open, onClose, item, type, onSaved }) {
  const meta = MOVE_META[type] ?? MOVE_META.received
  const [form, setForm] = useState({ quantity: '', reason: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm({ quantity: '', reason: meta.reason })
      setErrors({})
    }
  }
  if (!item) return null
  const qty = Number(form.quantity) || 0
  const delta = type === 'used' ? -Math.abs(qty) : type === 'received' ? Math.abs(qty) : qty
  const after = item.stock + delta
  const submit = async (e) => {
    e.preventDefault()
    const v = {}
    if (!qty) v.quantity = 'Enter a quantity'
    else if (type !== 'adjustment' && qty < 0) v.quantity = 'Quantity must be positive'
    else if (after < 0) v.quantity = `Only ${item.stock} ${item.unit} in stock`
    if (!form.reason.trim()) v.reason = 'A reason is required'
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const res = await inventoryService.recordMovement(item.id, { type, quantity: form.quantity, reason: form.reason })
      toast.success(`${item.name}: ${formatNumber(res.item.stock)} ${item.unit} in stock`)
      if (res.item.status !== 'in') toast.warning(`${item.name} is ${res.item.status === 'out' ? 'out of stock' : 'running low'}`, { description: 'A low-stock notification has been created.' })
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
    <Modal open={open} onClose={onClose} icon={meta.icon} title={meta.label} description={item.name}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="move-form" loading={saving}>Save</Button></>}>
      <form id="move-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
          <div><p className="text-[11px] text-muted">Current</p><p className="font-bold tabular-nums">{formatNumber(item.stock)} {item.unit}</p></div>
          <div><p className="text-[11px] text-muted">Change</p><p className={`font-bold tabular-nums ${delta < 0 ? 'text-red-600' : delta > 0 ? 'text-emerald-600' : ''}`}>{delta > 0 ? '+' : ''}{formatNumber(delta, 1).replace(/\.0$/, '')}</p></div>
          <div><p className="text-[11px] text-muted">After</p><p className={`font-bold tabular-nums ${after < 0 ? 'text-red-600' : after <= item.minStock ? 'text-amber-600' : ''}`}>{formatNumber(after, 1).replace(/\.0$/, '')} {item.unit}</p></div>
        </div>
        <Field label={meta.verb} required error={errors.quantity} hint={type === 'adjustment' ? 'Use a negative number to reduce stock (e.g. -2 after a stock count).' : undefined}>
          {(p) => <Input {...p} type="number" step="any" value={form.quantity} onChange={(e) => { setForm((f) => ({ ...f, quantity: e.target.value })); setErrors({}) }} suffix={item.unit} data-autofocus />}
        </Field>
        <Field label="Reason" required error={errors.reason}>
          {(p) => <Textarea {...p} rows={2} value={form.reason} onChange={(e) => { setForm((f) => ({ ...f, reason: e.target.value })); setErrors({}) }} placeholder="e.g. Delivery from supplier, weekly usage, stock count" />}
        </Field>
      </form>
    </Modal>
  )
}

function HistoryModal({ open, onClose, item }) {
  const { data, loading } = useAsync(() => (open && item ? inventoryService.getStockMovements(item.id) : Promise.resolve([])), [open, item?.id])
  return (
    <Modal open={open} onClose={onClose} size="lg" icon={History} title="Stock movement history" description={item?.name} footer={<Button onClick={onClose}>Close</Button>}>
      {loading ? <Skeleton className="h-48 w-full" /> : !data?.length ? <EmptyState compact title="No stock movements yet" /> : (
        <ul className="divide-y divide-line">
          {data.map((m) => {
            const meta = MOVE_META[m.type]
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}><meta.icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{m.reason}</p>
                  <p className="text-xs text-muted">{formatDateTime(m.at)} · {m.byName}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[13px] font-bold tabular-nums ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity, 1).replace(/\.0$/, '')} {m.unit}</p>
                  <p className="text-[11px] text-muted">Balance {formatNumber(m.balanceAfter, 1).replace(/\.0$/, '')}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

export default function Inventory() {
  const [params, setParams] = useSearchParams()
  const { data, loading, error, reload } = useAsync(() => inventoryService.getInventory(), [], { live: true, watch: ['inventory'] })
  const moves = useAsync(() => inventoryService.getStockMovements(), [], { live: true, watch: ['stockMovements'] })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('all')
  const [modal, setModal] = useState(null) // { kind, item, type }
  const [busy, setBusy] = useState(false)
  const q = useDebounce(query.trim().toLowerCase(), 200)
  const items = useMemo(() => data ?? [], [data])

  // Deep link from notifications/dashboard: /inventory?item=INV-003 opens its history
  const linkedItem = items.find((i) => i.id === params.get('item'))
  const closeModal = () => {
    setModal(null)
    if (params.get('item')) setParams({}, { replace: true })
  }

  const stats = useMemo(() => ({
    total: items.length,
    low: items.filter((i) => i.status === 'low').length,
    out: items.filter((i) => i.status === 'out').length,
    value: items.reduce((s, i) => s + i.stockValue, 0),
  }), [items])
  const filtered = useMemo(() => items.filter((i) => (status === 'all' || i.status === status) && (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))), [items, status, category, q])
  const table = useTable(filtered, { pageSize: 15, initialSort: { key: 'name', dir: 'asc' }, resetKey: `${q}|${category}|${status}` })
  const alerts = items.filter((i) => i.status !== 'in').sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock))

  const confirmDelete = async () => {
    setBusy(true)
    try {
      await inventoryService.deleteItem(modal.item.id)
      toast.success(`${modal.item.name} deleted`)
      setModal(null)
    } catch (e) {
      toast.error(e.message)
      setModal(null)
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'name', header: 'Item', sortable: true, render: (i) => <div className="max-w-[240px]"><p className="truncate font-semibold text-ink">{i.name}</p><p className="font-mono text-[11px] text-muted">{i.id}</p></div> },
    { key: 'category', header: 'Category', sortable: true, hideBelow: 'md', render: (i) => <span className="text-slate-600">{i.category}</span> },
    {
      key: 'stock', header: 'Current stock', sortable: true,
      render: (i) => (
        <div className="w-32">
          <p className="font-bold tabular-nums text-ink">{formatNumber(i.stock)} <span className="text-xs font-medium text-muted">{i.unit}</span></p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div className={`h-full rounded-full ${i.status === 'out' ? 'bg-red-500' : i.status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (i.stock / Math.max(1, i.minStock * 3)) * 100)}%` }} />
          </div>
        </div>
      ),
    },
    { key: 'minStock', header: 'Min. level', sortable: true, align: 'right', hideBelow: 'lg', render: (i) => <span className="tabular-nums text-slate-600">{formatNumber(i.minStock)} {i.unit}</span> },
    { key: 'unitCost', header: 'Unit cost', sortable: true, align: 'right', hideBelow: 'lg', render: (i) => <span className="tabular-nums">{formatCurrency(i.unitCost, { decimals: 0 })}</span> },
    { key: 'supplier', header: 'Supplier', hideBelow: 'xl', render: (i) => <span className="text-slate-600">{i.supplier || '—'}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (i) => <StockBadge status={i.status} /> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (i) => (
        <Dropdown width={220}
          items={[
            { label: 'Record stock received', icon: ArrowDownToLine, onClick: () => setModal({ kind: 'move', type: 'received', item: i }) },
            { label: 'Record stock usage', icon: ArrowUpFromLine, onClick: () => setModal({ kind: 'move', type: 'used', item: i }), disabled: i.stock <= 0 },
            { label: 'Adjust stock', icon: SlidersHorizontal, onClick: () => setModal({ kind: 'move', type: 'adjustment', item: i }) },
            { label: 'Movement history', icon: History, onClick: () => setModal({ kind: 'history', item: i }) },
            { divider: true },
            { label: 'Edit item', icon: Pencil, onClick: () => setModal({ kind: 'item', item: i }) },
            { label: 'Delete item', icon: Trash2, danger: true, onClick: () => setModal({ kind: 'delete', item: i }), disabled: i.stock > 0 },
          ]}
          trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${i.name}`}><MoreHorizontal size={18} /></button>}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Detergents, chemicals, packaging and supplies." actions={<Button icon={Plus} onClick={() => setModal({ kind: 'item' })}>Add item</Button>} />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Items tracked" value={formatNumber(stats.total)} icon={Boxes} tone="blue" />
        <MiniStat label="Low stock" value={formatNumber(stats.low)} icon={TriangleAlert} tone="amber" sub="At or below minimum" />
        <MiniStat label="Out of stock" value={formatNumber(stats.out)} icon={PackageX} tone="red" />
        <MiniStat label="Stock value" value={formatCurrency(stats.value, { decimals: 0 })} icon={Coins} tone="green" sub="At unit cost" />
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="space-y-3 border-b border-line p-4">
            <Tabs variant="pills" className="w-fit" value={status} onChange={setStatus} tabs={[{ value: 'all', label: 'All', count: stats.total }, { value: 'in', label: 'In stock', count: stats.total - stats.low - stats.out }, { value: 'low', label: 'Low', count: stats.low }, { value: 'out', label: 'Out', count: stats.out }]} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchInput value={query} onChange={setQuery} placeholder="Search item, supplier or ID…" className="flex-1" />
              <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" options={INVENTORY_CATEGORIES.map((c) => ({ value: c, label: c }))} className="sm:w-52" />
            </div>
          </div>
          {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
            <DataTable columns={columns} table={table} loading={loading && !data} onRowClick={(i) => setModal({ kind: 'history', item: i })} getRowLabel={(i) => `View history for ${i.name}`}
              rowClassName={(i) => (i.status === 'out' ? 'bg-red-50/40' : '')}
              empty={<EmptyState icon={Package} title="No items found" description="Try a different filter or add a new item." />} />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Stock alerts" description="Items needing reorder" icon={TriangleAlert} />
            <CardBody>
              {alerts.length === 0 ? <EmptyState compact icon={Boxes} title="All supplies are well stocked" /> : (
                <ul className="space-y-2">
                  {alerts.map((i) => (
                    <li key={i.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${i.status === 'out' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{i.name}</p>
                        <p className="text-xs text-muted">{formatNumber(i.stock)} / min {i.minStock} {i.unit}</p>
                      </div>
                      <Button size="xs" variant="secondary" icon={ArrowDownToLine} onClick={() => setModal({ kind: 'move', type: 'received', item: i })}>Restock</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent stock movements" icon={History} />
            <CardBody>
              {moves.loading && !moves.data ? <Skeleton className="h-40 w-full" /> : (
                <ul className="divide-y divide-line">
                  {(moves.data ?? []).slice(0, 8).map((m) => {
                    const meta = MOVE_META[m.type]
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}><meta.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink">{m.itemName}</p>
                          <p className="truncate text-[11px] text-muted">{m.reason} · {timeAgo(m.at)}</p>
                        </div>
                        <span className={`text-[13px] font-bold tabular-nums ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{m.quantity > 0 ? '+' : ''}{formatNumber(m.quantity, 1).replace(/\.0$/, '')}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </section>

      <ItemFormModal open={modal?.kind === 'item'} item={modal?.item} onClose={() => setModal(null)} onSaved={() => reload({ silent: true })} />
      <MovementModal open={modal?.kind === 'move'} item={modal?.item} type={modal?.type} onClose={() => setModal(null)} onSaved={() => reload({ silent: true })} />
      <HistoryModal open={modal?.kind === 'history' || (!modal && !!linkedItem)} item={modal?.item ?? linkedItem} onClose={closeModal} />
      <ConfirmDialog open={modal?.kind === 'delete'} onClose={() => setModal(null)} onConfirm={confirmDelete} loading={busy} title={`Delete ${modal?.item?.name}?`} message="This item and its place in your inventory list will be removed." confirmLabel="Delete item" />
    </div>
  )
}
