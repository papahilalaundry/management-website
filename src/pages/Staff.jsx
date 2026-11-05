import { useMemo, useState } from 'react'
import { Activity, AtSign, ClipboardList, Eye, KeyRound, MoreHorizontal, Pencil, Phone, Power, PowerOff, ShieldCheck, UserCog, UserPlus, Users, Wallet, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { staffService } from '../services'
import { useAsync } from '../hooks/useAsync'
import { useTable } from '../hooks/useTable'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import Modal, { ConfirmDialog } from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import SearchInput from '../components/ui/SearchInput'
import DataTable from '../components/ui/DataTable'
import Dropdown from '../components/ui/Dropdown'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Tabs from '../components/ui/Tabs'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/EmptyState'
import { MiniStat } from '../components/shared/StatCard'
import { RoleBadge } from '../components/shared/StatusBadges'
import ActivityFeed from '../components/shared/ActivityFeed'
import OrderTable from '../components/orders/OrderTable'
import { normalizeUsername, ROLE_OPTIONS } from '../data/constants'
import { formatNumber } from '../utils/formatCurrency'
import { formatDate, timeAgo } from '../utils/formatDate'
import { validateStaff } from '../utils/validators'

const EMPTY = { name: '', username: '', password: '', phone: '', role: 'staff', title: '', status: 'active' }

/** Username input. The login email behind it is created automatically. */
function UsernameInput({ value, onChange, ...p }) {
  return <Input {...p} value={value} onChange={onChange} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" placeholder="e.g. grace" />
}

function StaffFormModal({ open, onClose, member, onSaved }) {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setForm(member ? { name: member.name, username: member.username ?? '', password: '', phone: member.phone, role: member.role, title: member.title ?? '', status: member.status } : EMPTY)
      setErrors({})
    }
  }
  const isSelf = member?.id === user.id
  const set = (k) => (e) => {
    const value = k === 'username' ? e.target.value.replace(/@.*$/, '').replace(/s/g, '').toLowerCase() : e.target.value
    setForm((f) => ({ ...f, [k]: value }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  const submit = async (e) => {
    e.preventDefault()
    const v = validateStaff(form, { creating: !member })
    setErrors(v)
    if (Object.keys(v).length) return
    setSaving(true)
    try {
      const { username, password, ...profile } = form
      const saved = member ? await staffService.updateStaff(member.id, profile) : await staffService.createStaff({ ...profile, username, password })
      toast.success(member ? `${saved.name} updated` : `${saved.name} added`, {
        description: member ? undefined : `They sign in with username “${normalizeUsername(username)}” and the password you set. Ask them to change it in Settings.`,
        duration: member ? undefined : 10000,
      })
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
    <Modal open={open} onClose={onClose} size="lg" icon={member ? Pencil : UserPlus} title={member ? `Edit ${member.name}` : 'Add staff member'} description={member ? member.id : 'Create an account for a new team member.'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="staff-form" loading={saving}>{member ? 'Save changes' : 'Add staff member'}</Button></>}>
      <form id="staff-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-3">
          <Avatar name={form.name || 'New Staff'} size="lg" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-ink">Profile photo</p>
            <p className="text-xs text-muted">Initials are used until photo uploads are connected to a backend.</p>
          </div>
          <Button size="sm" variant="secondary" icon={Camera} disabled>Upload</Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>{(p) => <Input {...p} value={form.name} onChange={set('name')} data-autofocus />}</Field>
          <Field label="Job title" optional>{(p) => <Input {...p} value={form.title} onChange={set('title')} placeholder="e.g. Laundry Technician" />}</Field>
          {member ? (
            <Field label="Username" hint="Usernames cannot be changed.">{(p) => <UsernameInput {...p} value={form.username || '—'} disabled onChange={() => {}} />}</Field>
          ) : (
            <Field label="Username" required error={errors.username} hint={errors.username ? undefined : 'Used to sign in. Letters, numbers, dot, dash or underscore.'}>{(p) => <UsernameInput {...p} value={form.username} onChange={set('username')} />}</Field>
          )}
          <Field label="Phone" required error={errors.phone}>{(p) => <Input {...p} type="tel" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" />}</Field>
          <Field label="Role" required error={errors.role} hint={isSelf ? 'You cannot change your own role.' : undefined}>{(p) => <Select {...p} value={form.role} onChange={set('role')} options={ROLE_OPTIONS} disabled={isSelf} />}</Field>
          <Field label="Account status" hint={isSelf ? 'You cannot deactivate your own account.' : undefined}>{(p) => <Select {...p} value={form.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} disabled={isSelf} />}</Field>
          {!member && (
            <Field label="Temporary password" required error={errors.password} hint={errors.password ? undefined : 'At least 8 characters with an uppercase letter and a number. Share it with them privately.'} className="sm:col-span-2">
              {(p) => <Input {...p} type="text" autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="e.g. Laundry2026" />}
            </Field>
          )}
        </div>
        <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <KeyRound size={15} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            Admins can’t reset someone else’s password from the app (that needs Firebase Cloud Functions on the paid Blaze plan).
            Each person changes their own password in <strong>Settings</strong>. To lock someone out, set their account to <strong>Inactive</strong>.
          </p>
        </div>
        <div className="rounded-xl border border-line p-3 text-xs text-muted">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink"><ShieldCheck size={14} className="text-brand" /> Role permissions</p>
          {form.role === 'admin' && 'Full access, including staff accounts, pricing and system settings.'}
          {form.role === 'manager' && 'Operations and finance: orders, customers, payments, expenses, inventory and reports. Cannot manage staff or system settings.'}
          {form.role === 'staff' && 'Front-line work: register customers, create orders, update laundry progress and record order payments. No access to business financials.'}
        </div>
      </form>
    </Modal>
  )
}

function StaffProfileModal({ open, onClose, memberId }) {
  const { data: s, loading } = useAsync(() => (open && memberId ? staffService.getStaffById(memberId) : Promise.resolve(null)), [open, memberId])
  const [tab, setTab] = useState('orders')
  return (
    <Modal open={open} onClose={onClose} size="xl" icon={UserCog} title={s?.name ?? 'Staff profile'} description={s ? `${s.id} · ${s.title || s.role}` : undefined} footer={<Button onClick={onClose}>Close</Button>}>
      {loading || !s ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={s.name} size="xl" />
            <div className="flex-1 space-y-1 text-[13px]">
              <div className="flex flex-wrap gap-2"><RoleBadge role={s.role} />{s.status === 'active' ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>}</div>
              <p className="flex items-center gap-2 text-slate-600"><AtSign size={14} /> {s.username ?? '—'}</p>
              <p className="flex items-center gap-2 text-slate-600"><Phone size={14} /> {s.phone}</p>
              <p className="text-xs text-muted">Joined {formatDate(s.joinedAt)} · Last active {s.lastActiveAt ? timeAgo(s.lastActiveAt) : 'never'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Orders handled" value={formatNumber(s.ordersHandled)} icon={ClipboardList} tone="blue" />
            <MiniStat label="Open assigned" value={formatNumber(s.openAssigned)} icon={Activity} tone="violet" />
            <MiniStat label="Payments recorded" value={formatNumber(s.paymentsRecorded)} icon={Wallet} tone="green" />
          </div>
          <Tabs tabs={[{ value: 'orders', label: 'Assigned orders', count: s.assignedOrders.length }, { value: 'activity', label: 'Activity history' }]} value={tab} onChange={setTab} />
          {tab === 'orders' ? <div className="-mx-5 sm:-mx-6"><OrderTable rows={s.assignedOrders} variant="compact" pageSize={6} /></div> : <ActivityFeed items={s.activities.map((a) => ({ ...a, byName: s.name }))} emptyText="No recent activity." />}
        </div>
      )}
    </Modal>
  )
}

export default function Staff() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useAsync(() => staffService.getStaff(), [], { live: true, watch: ['staff'] })
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const q = useDebounce(query.trim().toLowerCase(), 200)
  const staff = useMemo(() => data ?? [], [data])
  const filtered = useMemo(() => staff.filter((s) => (role === 'all' || s.role === role) && (!q || s.name.toLowerCase().includes(q) || (s.username ?? '').includes(q) || s.id.toLowerCase().includes(q))), [staff, role, q])
  const table = useTable(filtered, { pageSize: 10, initialSort: { key: 'id', dir: 'asc' }, resetKey: `${q}|${role}` })

  const toggleStatus = async () => {
    const s = modal.member
    setBusy(true)
    try {
      await staffService.setStaffStatus(s.id, s.status === 'active' ? 'inactive' : 'active')
      toast.success(`${s.name} ${s.status === 'active' ? 'deactivated' : 'activated'}`)
      setModal(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = [
    { key: 'id', header: 'ID', sortable: true, render: (s) => <span className="font-mono text-xs font-semibold text-slate-500">{s.id}</span> },
    {
      key: 'name', header: 'Staff member', sortable: true,
      render: (s) => (
        <div className="flex items-center gap-3">
          <Avatar name={s.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{s.name}{s.id === user.id && <span className="ml-1.5 text-xs font-medium text-brand">(you)</span>}</p>
            <p className="truncate text-xs text-muted">{s.title}</p>
          </div>
        </div>
      ),
    },
    { key: 'username', header: 'Username', hideBelow: 'lg', render: (s) => <span className="font-mono text-xs text-slate-600">{s.username ?? '—'}</span> },
    { key: 'phone', header: 'Phone', hideBelow: 'xl', render: (s) => <span className="tabular-nums text-slate-600">{s.phone}</span> },
    { key: 'role', header: 'Role', sortable: true, render: (s) => <RoleBadge role={s.role} /> },
    { key: 'status', header: 'Status', sortable: true, render: (s) => (s.status === 'active' ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>) },
    { key: 'joinedAt', header: 'Joined', sortable: true, hideBelow: 'md', render: (s) => <span className="text-slate-600">{formatDate(s.joinedAt)}</span> },
    { key: 'ordersHandled', header: 'Orders handled', sortable: true, align: 'right', hideBelow: 'md', render: (s) => <span className="font-semibold">{formatNumber(s.ordersHandled)}</span> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, align: 'right',
      render: (s) => (
        <Dropdown
          items={[
            { label: 'View profile', icon: Eye, onClick: () => setModal({ kind: 'profile', member: s }) },
            { label: 'Edit details', icon: Pencil, onClick: () => setModal({ kind: 'edit', member: s }) },
            { label: s.status === 'active' ? 'Deactivate' : 'Activate', icon: s.status === 'active' ? PowerOff : Power, danger: s.status === 'active', onClick: () => setModal({ kind: 'status', member: s }), hidden: s.id === user.id },
          ]}
          trigger={<button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Actions for ${s.name}`}><MoreHorizontal size={18} /></button>}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Staff Management" description="Team logins, roles and access." actions={<Button icon={UserPlus} onClick={() => setModal({ kind: 'edit' })}>Add staff member</Button>} />
      <section className="stat-strip grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MiniStat label="Team members" value={formatNumber(staff.length)} icon={Users} tone="blue" />
        <MiniStat label="Active accounts" value={formatNumber(staff.filter((s) => s.status === 'active').length)} icon={Power} tone="green" />
        <MiniStat label="Managers & admins" value={formatNumber(staff.filter((s) => s.role !== 'staff').length)} icon={ShieldCheck} tone="navy" />
        <MiniStat label="Orders handled" value={formatNumber(staff.reduce((a, s) => a + s.ordersHandled, 0))} icon={ClipboardList} tone="violet" sub="Created or assigned" />
      </section>
      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <Tabs variant="pills" className="w-fit" value={role} onChange={setRole} tabs={[{ value: 'all', label: 'All' }, ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label, count: staff.filter((s) => s.role === r.value).length }))]} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name, username or ID…" className="flex-1" />
        </div>
        {error && !data ? <ErrorState error={error} onRetry={reload} /> : (
          <DataTable columns={columns} table={table} loading={loading && !data} onRowClick={(s) => setModal({ kind: 'profile', member: s })} getRowLabel={(s) => `View ${s.name}`}
            mobileCard={{
              leading: (s) => <Avatar name={s.name} size="md" />,
              title: (s) => <>{s.name}{s.id === user.id && <span className="ml-1.5 text-xs font-medium text-brand">(you)</span>}</>,
              subtitle: (s) => s.title,
              meta: (s) => <span>{formatNumber(s.ordersHandled)} orders handled{s.status !== 'active' ? ' · Inactive' : ''}</span>,
              badge: (s) => <RoleBadge role={s.role} />,
            }} rowClassName={(s) => (s.status === 'inactive' ? 'opacity-60' : '')} />
        )}
      </Card>

      <StaffFormModal open={modal?.kind === 'edit'} member={modal?.member} onClose={() => setModal(null)} onSaved={() => reload({ silent: true })} />
      <StaffProfileModal open={modal?.kind === 'profile'} memberId={modal?.member?.id} onClose={() => setModal(null)} />
      <ConfirmDialog open={modal?.kind === 'status'} onClose={() => setModal(null)} onConfirm={toggleStatus} loading={busy} tone={modal?.member?.status === 'active' ? 'danger' : 'warning'}
        title={modal?.member?.status === 'active' ? `Deactivate ${modal?.member?.name}?` : `Activate ${modal?.member?.name}?`}
        message={modal?.member?.status === 'active' ? 'They lose access straight away and cannot sign in until reactivated. Their order history is kept.' : 'They will be able to sign in again with their existing username and password.'}
        confirmLabel={modal?.member?.status === 'active' ? 'Deactivate' : 'Activate'} />
    </div>
  )
}
