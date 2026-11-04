import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, Building2, Calculator, Check, KeyRound, Palette, RotateCcw, Save, Server, ShieldCheck, Shirt, User, Users, X, ArrowRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import { catalogService, settingsService, staffService } from '../services'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useAsync } from '../hooks/useAsync'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Field, Input, Select, Switch, Textarea } from '../components/ui/Field'
import { ConfirmDialog } from '../components/ui/Modal'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { LogoMark } from '../components/layout/Logo'
import { RoleBadge } from '../components/shared/StatusBadges'
import { DATE_FORMAT_OPTIONS } from '../utils/formatDate'
import { formatCurrency } from '../utils/formatCurrency'
import { pricingUnit } from '../data/constants'
import { PERMISSIONS } from '../utils/permissions'

function useSectionForm(initial) {
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => {
    const v = e?.target ? e.target.value : e
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((x) => ({ ...x, [k]: undefined }))
  }
  return { form, setForm, errors, setErrors, saving, setSaving, set }
}

async function saveSection(section, values, s, label) {
  s.setSaving(true)
  try {
    await settingsService.updateSettings(section, values)
    toast.success(`${label} saved`)
  } catch (e) {
    s.setErrors(e.fields ?? {})
    toast.error(e.message)
  } finally {
    s.setSaving(false)
  }
}

function SectionCard({ title, description, icon, children, onSave, saving, readOnly }) {
  return (
    <Card>
      <CardHeader title={title} description={description} icon={icon} />
      <CardBody className="space-y-4">
        {children}
        {onSave && !readOnly && (
          <div className="flex justify-end border-t border-line pt-4">
            <Button icon={Save} loading={saving} onClick={onSave}>Save changes</Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function ProfileTab() {
  const { user } = useAuth()
  const s = useSectionForm({ name: user.name, phone: user.phone ?? '' })
  const pw = useSectionForm({ current: '', next: '', confirm: '' })
  const saveProfile = async () => {
    s.setSaving(true)
    try {
      await staffService.updateOwnProfile(s.form)
      toast.success('Profile updated')
    } catch (e) {
      s.setErrors(e.fields ?? {})
      toast.error(e.message)
    } finally {
      s.setSaving(false)
    }
  }
  const savePassword = async () => {
    if (pw.form.next !== pw.form.confirm) return pw.setErrors({ confirm: 'Passwords do not match' })
    pw.setSaving(true)
    try {
      await staffService.changeOwnPassword(pw.form)
      toast.success('Password changed (demo)')
      pw.setForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      pw.setErrors(e.fields ?? {})
      toast.error(e.message)
    } finally {
      pw.setSaving(false)
    }
  }
  return (
    <div className="space-y-6">
      <SectionCard title="My profile" description="How you appear across the system." icon={User} onSave={saveProfile} saving={s.saving}>
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="xl" />
          <div>
            <p className="text-base font-bold text-ink">{user.name}</p>
            <p className="text-[13px] text-muted">{user.email}</p>
            <div className="mt-1.5"><RoleBadge role={user.role} /></div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={s.errors.name}>{(p) => <Input {...p} value={s.form.name} onChange={s.set('name')} />}</Field>
          <Field label="Phone" error={s.errors.phone}>{(p) => <Input {...p} value={s.form.phone} onChange={s.set('phone')} />}</Field>
          <Field label="Email" hint="Contact an administrator to change your sign-in email.">{(p) => <Input {...p} value={user.email} disabled />}</Field>
          <Field label="Role" hint="Roles can only be changed by an administrator — never by yourself.">{(p) => <Input {...p} value={user.role[0].toUpperCase() + user.role.slice(1)} disabled />}</Field>
        </div>
      </SectionCard>
      <SectionCard title="Change password" description="Demo only — passwords are stored locally in this prototype." icon={KeyRound} onSave={savePassword} saving={pw.saving}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" error={pw.errors.current}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={pw.form.current} onChange={pw.set('current')} />}</Field>
          <Field label="New password" error={pw.errors.next} hint={!pw.errors.next ? '8+ characters, a capital letter and a number' : undefined}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.form.next} onChange={pw.set('next')} />}</Field>
          <Field label="Confirm new password" error={pw.errors.confirm}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={pw.form.confirm} onChange={pw.set('confirm')} />}</Field>
        </div>
      </SectionCard>
    </div>
  )
}

function BusinessTab() {
  const settings = useSettings()
  const b = useSectionForm(settings.business)
  const p = useSectionForm(settings.pricing)
  return (
    <div className="space-y-6">
      <SectionCard title="Business profile" description="Shown on receipts and reports." icon={Building2} onSave={() => saveSection('business', b.form, b, 'Business profile')} saving={b.saving}>
        <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
          <LogoMark size={56} />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-ink">Logo</p>
            <p className="text-xs text-muted">The Papa Hila mark is used on receipts. Custom logo upload needs file storage (backend).</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" required error={b.errors.name}>{(x) => <Input {...x} value={b.form.name} onChange={b.set('name')} />}</Field>
          <Field label="Tagline">{(x) => <Input {...x} value={b.form.tagline} onChange={b.set('tagline')} />}</Field>
          <Field label="Phone number" required error={b.errors.phone}>{(x) => <Input {...x} value={b.form.phone} onChange={b.set('phone')} />}</Field>
          <Field label="Email" error={b.errors.email}>{(x) => <Input {...x} type="email" value={b.form.email} onChange={b.set('email')} />}</Field>
          <Field label="Physical address" className="sm:col-span-2">{(x) => <Input {...x} value={b.form.address} onChange={b.set('address')} />}</Field>
          <Field label="Business hours">{(x) => <Input {...x} value={b.form.hours} onChange={b.set('hours')} />}</Field>
          <Field label="KRA PIN">{(x) => <Input {...x} value={b.form.kraPin} onChange={b.set('kraPin')} />}</Field>
          <Field label="Currency" hint="All amounts are in Kenyan Shillings.">{(x) => <Select {...x} value={b.form.currency} onChange={b.set('currency')} options={[{ value: 'KES', label: 'KES — Kenyan Shilling' }]} />}</Field>
          <Field label="Receipt footer" className="sm:col-span-2">{(x) => <Textarea {...x} rows={2} value={b.form.receiptFooter} onChange={b.set('receiptFooter')} />}</Field>
        </div>
      </SectionCard>
      <SectionCard title="Tax & surcharges" description="Applied to new orders. Existing orders keep their original values." icon={Calculator} onSave={() => saveSection('pricing', p.form, p, 'Pricing settings')} saving={p.saving}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Tax label">{(x) => <Input {...x} value={p.form.taxLabel} onChange={p.set('taxLabel')} />}</Field>
          <Field label="Tax rate" error={p.errors.taxRate} hint="Default 0%">{(x) => <Input {...x} type="number" min="0" max="100" suffix="%" value={p.form.taxRate} onChange={p.set('taxRate')} />}</Field>
          <Field label="Express surcharge" error={p.errors.expressSurcharge}>{(x) => <Input {...x} type="number" min="0" max="100" suffix="%" value={p.form.expressSurcharge} onChange={p.set('expressSurcharge')} />}</Field>
          <Field label="Urgent surcharge" error={p.errors.urgentSurcharge}>{(x) => <Input {...x} type="number" min="0" max="100" suffix="%" value={p.form.urgentSurcharge} onChange={p.set('urgentSurcharge')} />}</Field>
          <Field label="Delivery fee" error={p.errors.deliveryFee}>{(x) => <Input {...x} type="number" min="0" prefix="KES" value={p.form.deliveryFee} onChange={p.set('deliveryFee')} />}</Field>
        </div>
      </SectionCard>
    </div>
  )
}

function ServicesTab() {
  const { data, loading, reload } = useAsync(() => catalogService.getServices(), [])
  const [prices, setPrices] = useState({})
  const [saving, setSaving] = useState(null)
  const save = async (s) => {
    setSaving(s.id)
    try {
      await catalogService.updateService(s.id, { ...s, price: prices[s.id] ?? s.price })
      toast.success(`${s.name} price updated`)
      setPrices((p) => ({ ...p, [s.id]: undefined }))
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(null)
    }
  }
  const toggle = async (s) => {
    try {
      await catalogService.setServiceActive(s.id, !s.active)
      reload({ silent: true })
    } catch (e) {
      toast.error(e.message)
    }
  }
  return (
    <SectionCard title="Default prices & availability" description="Quick-edit the catalogue. New prices apply to new orders only." icon={Shirt}>
      {loading && !data ? <Skeleton className="h-64 w-full" /> : (
        <div className="divide-y divide-line rounded-xl border border-line">
          {data.map((s) => {
            const dirty = prices[s.id] !== undefined && Number(prices[s.id]) !== s.price
            return (
              <div key={s.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-muted">per {pricingUnit(s.pricingModel)} · currently {formatCurrency(s.price, { decimals: 0 })}</p>
                </div>
                <Input aria-label={`${s.name} price`} type="number" min="0" prefix="KES" className="sm:w-36" value={prices[s.id] ?? s.price} onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))} />
                <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || prices[s.id] === '' || Number(prices[s.id]) < 0} loading={saving === s.id} onClick={() => save(s)}>Save</Button>
                <div className="sm:w-32"><Switch checked={s.active} onChange={() => toggle(s)} label={s.active ? 'Active' : 'Inactive'} /></div>
              </div>
            )
          })}
        </div>
      )}
      <Button variant="ghost" size="sm" to="/services" iconRight={ArrowRight}>Open full service catalogue</Button>
    </SectionCard>
  )
}

const ROLE_MATRIX = [
  ['Dashboard (operations)', 'dashboard.view'], ['Financial figures', 'finance.view'], ['Create & update orders', 'orders.create'], ['Apply discounts', 'orders.discount'], ['Cancel orders', 'orders.cancel'],
  ['Customers', 'customers.view'], ['Record payments', 'payments.record'], ['Payments page', 'payments.view'], ['Expenses', 'expenses.manage'], ['Inventory', 'inventory.manage'],
  ['Reports', 'reports.view'], ['Edit services & prices', 'services.manage'], ['Staff accounts & roles', 'staff.manage'], ['System settings', 'settings.system'],
]

function UsersTab() {
  const { data, loading } = useAsync(() => staffService.getStaff(), [])
  return (
    <div className="space-y-6">
      <SectionCard title="Users" description="Accounts that can sign in to the system." icon={Users}>
        {loading && !data ? <Skeleton className="h-40 w-full" /> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Avatar name={s.name} size="sm" />
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-ink">{s.name}</p><p className="truncate text-xs text-muted">{s.email}</p></div>
                <RoleBadge role={s.role} />
                {s.status === 'active' ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>}
              </li>
            ))}
          </ul>
        )}
        <Button variant="secondary" size="sm" to="/staff" iconRight={ArrowRight}>Manage staff & roles</Button>
      </SectionCard>
      <SectionCard title="Role permissions" description="What each role can access. Enforced in the UI and the (mock) API." icon={ShieldCheck}>
        <div className="scroll-thin overflow-x-auto rounded-xl border border-line">
          <table className="table-base">
            <thead><tr><th>Capability</th><th className="text-center">Admin</th><th className="text-center">Manager</th><th className="text-center">Staff</th></tr></thead>
            <tbody>
              {ROLE_MATRIX.map(([label, perm]) => (
                <tr key={perm}>
                  <td className="font-medium">{label}</td>
                  {['admin', 'manager', 'staff'].map((r) => (
                    <td key={r} className="text-center">{PERMISSIONS[perm].includes(r) ? <Check size={16} className="mx-auto text-emerald-600" aria-label="Allowed" /> : <X size={16} className="mx-auto text-slate-300" aria-label="Not allowed" />}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

function NotificationsTab() {
  const settings = useSettings()
  const { can } = useAuth()
  const n = useSectionForm(settings.notifications)
  const readOnly = !can('settings.notifications')
  const rows = [
    ['orders', 'Order notifications', 'New orders and orders ready for collection'],
    ['payments', 'Payment notifications', 'Payments received and outstanding balances'],
    ['lowStock', 'Low-stock alerts', 'When supplies fall to their minimum level'],
    ['overdue', 'Overdue order reminders', 'Orders past their expected completion'],
    ['sms', 'Simulated customer SMS', 'Generate demo SMS messages for order events (nothing is actually sent)'],
    ['smsPreview', 'Auto-open SMS preview', 'Show the phone preview each time a simulated SMS is generated'],
  ]
  return (
    <SectionCard title="Notification preferences" description="Choose which events create alerts." icon={Bell} onSave={() => saveSection('notifications', n.form, n, 'Notification preferences')} saving={n.saving} readOnly={readOnly}>
      {readOnly && <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted"><Info size={14} /> Only managers and administrators can change these settings.</p>}
      <div className="divide-y divide-line">
        {rows.map(([k, label, desc]) => <div key={k} className="py-3"><Switch checked={!!n.form[k]} onChange={(v) => n.setForm((f) => ({ ...f, [k]: v }))} label={label} description={desc} disabled={readOnly} /></div>)}
      </div>
    </SectionCard>
  )
}

function PreferencesTab() {
  const settings = useSettings()
  const p = useSectionForm(settings.preferences)
  return (
    <SectionCard title="General preferences" description="Display options for dates and currency." icon={Palette} onSave={() => saveSection('preferences', p.form, p, 'Preferences')} saving={p.saving}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date format">{(x) => <Select {...x} value={p.form.dateFormat} onChange={p.set('dateFormat')} options={DATE_FORMAT_OPTIONS} />}</Field>
        <Field label="Currency format" hint="Kenyan Shillings with two decimals">{(x) => <Input {...x} value={formatCurrency(1500)} disabled />}</Field>
        <Field label="Theme" hint="Dark mode is planned for a future release">{(x) => <Select {...x} value="light" disabled options={[{ value: 'light', label: 'Light' }]} />}</Field>
      </div>
    </SectionCard>
  )
}

function SystemTab() {
  const settings = useSettings()
  const [confirm, setConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const update = async (patch) => {
    try {
      await settingsService.updateSettings('system', { ...settings.system, ...patch })
      toast.success('System setting updated')
    } catch (e) {
      toast.error(e.message)
    }
  }
  const reset = async () => {
    setResetting(true)
    try {
      await settingsService.resetDemoData()
      toast.success('Demo data has been reset')
      setConfirm(false)
      setTimeout(() => window.location.assign('/dashboard'), 400)
    } catch (e) {
      toast.error(e.message)
      setResetting(false)
    }
  }
  return (
    <div className="space-y-6">
      <SectionCard title="Mock API behaviour" description="Development options for the simulated backend." icon={Server}>
        <div className="divide-y divide-line">
          <div className="pb-3"><Switch checked={settings.system.latency !== false} onChange={(v) => update({ latency: v })} label="Simulate network latency" description="Adds a short realistic delay to every request so loading states are visible." /></div>
          <div className="pt-3"><Switch checked={!!settings.system.simulateErrors} onChange={(v) => update({ simulateErrors: v })} label="Simulate random server errors" description="About 1 in 8 requests will fail — useful for testing error handling." /></div>
        </div>
      </SectionCard>
      <Card className="border-red-200">
        <CardHeader title="Reset demo data" description="Restore all orders, customers, payments and settings to the original sample data." icon={RotateCcw} />
        <CardBody>
          <p className="mb-4 text-[13px] text-muted">All changes made in this browser will be permanently lost. You will stay signed in if your account exists in the demo data.</p>
          <Button variant="danger" icon={RotateCcw} onClick={() => setConfirm(true)}>Reset demo data</Button>
        </CardBody>
      </Card>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={reset} loading={resetting} title="Reset all demo data?" message="Every order, customer, payment, expense, inventory change and setting will be restored to the original sample data. This cannot be undone." confirmLabel="Reset everything" />
    </div>
  )
}

export default function Settings() {
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const tabs = [
    { value: 'profile', label: 'My profile', icon: User, show: true },
    { value: 'business', label: 'Business profile', icon: Building2, show: can('settings.business') },
    { value: 'services', label: 'Services & prices', icon: Shirt, show: can('services.manage') },
    { value: 'users', label: 'Users & access', icon: ShieldCheck, show: can('settings.users') },
    { value: 'notifications', label: 'Notifications', icon: Bell, show: can('settings.notifications') },
    { value: 'preferences', label: 'Preferences', icon: Palette, show: true },
    { value: 'system', label: 'System', icon: Server, show: can('settings.system') },
  ].filter((t) => t.show)
  const requested = params.get('tab')
  const active = tabs.some((t) => t.value === requested) ? requested : tabs.length > 1 && can('settings.business') ? 'business' : 'profile'
  const setTab = (v) => setParams({ tab: v }, { replace: true })

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Business profile, pricing, users and preferences." />
      <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="card scroll-thin flex gap-1 overflow-x-auto p-2 lg:flex-col">
          {tabs.map((t) => (
            <button key={t.value} type="button" onClick={() => setTab(t.value)} aria-current={active === t.value ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition ${active === t.value ? 'bg-sky-soft text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-ink'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {active === 'profile' && <ProfileTab />}
          {active === 'business' && <BusinessTab />}
          {active === 'services' && <ServicesTab />}
          {active === 'users' && <UsersTab />}
          {active === 'notifications' && <NotificationsTab />}
          {active === 'preferences' && <PreferencesTab />}
          {active === 'system' && <SystemTab />}
        </div>
      </div>
    </div>
  )
}
