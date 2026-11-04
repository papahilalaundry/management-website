import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CircleAlert, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEMO_ACCOUNTS } from '../services'
import Logo from '../components/layout/Logo'
import Button from '../components/ui/Button'
import { Checkbox, Field, Input } from '../components/ui/Field'
import { isValidEmail } from '../utils/validators'

const ROLE_STYLE = {
  Admin: { icon: ShieldCheck, chip: 'bg-blue-50 text-brand ring-blue-100' },
  Manager: { icon: BriefcaseBusiness, chip: 'bg-violet-50 text-violet-600 ring-violet-100' },
  Staff: { icon: UserRound, chip: 'bg-emerald-50 text-emerald-600 ring-emerald-100' },
}

const DOT_MASK = 'radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 75%)'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '', remember: true })
  const [errors, setErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
    setAuthError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = {}
    if (!form.email.trim()) v.email = 'Email is required'
    else if (!isValidEmail(form.email)) v.email = 'Enter a valid email address'
    if (!form.password) v.password = 'Password is required'
    setErrors(v)
    if (Object.keys(v).length) return
    setLoading(true)
    try {
      await login(form)
      navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setAuthError(err.message)
      setLoading(false)
    }
  }

  const fillDemo = (acc) => {
    setForm((f) => ({ ...f, email: acc.email, password: acc.password }))
    setErrors({})
    setAuthError('')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-10 sm:px-6">
      {/* Background decoration */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-48 -right-40 h-[560px] w-[560px] rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-300/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(37 99 235 / 0.16) 1px, transparent 0)',
            backgroundSize: '24px 24px',
            maskImage: DOT_MASK,
            WebkitMaskImage: DOT_MASK,
          }}
        />
      </div>

      <main className="relative w-full max-w-[440px] animate-slide-up">
        <div className="mb-7 flex justify-center">
          <Logo subtitle="Laundry Management System" />
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-7 shadow-[0_24px_60px_-20px_rgb(20_43_74/0.28),0_2px_6px_-2px_rgb(20_43_74/0.08)] backdrop-blur-xl sm:p-9">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-800 via-brand to-sky-400" />

          <div className="text-center">
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">Sign in to your Papa Hila staff account to continue.</p>
          </div>

          {authError && (
            <div role="alert" className="mt-6 flex animate-fade-in items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
              <CircleAlert size={17} className="mt-px shrink-0" aria-hidden />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-7 space-y-4">
            <Field label="Email address" error={errors.email}>
              {(p) => (
                <div className="group relative">
                  <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand" aria-hidden />
                  <Input {...p} type="email" autoComplete="username" placeholder="you@papahila.com" value={form.email} onChange={set('email')} className="h-11 bg-slate-50/60 pl-10 focus:bg-white" />
                </div>
              )}
            </Field>
            <Field label="Password" error={errors.password}>
              {(p) => (
                <div className="group relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand" aria-hidden />
                  <Input {...p} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={set('password')} className="h-11 bg-slate-50/60 pl-10 pr-11 focus:bg-white" />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              )}
            </Field>
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <Checkbox label="Remember me" className="shrink-0 whitespace-nowrap" checked={form.remember} onChange={set('remember')} />
              <span className="text-right text-xs text-muted">Forgot password? Ask an admin.</span>
            </div>
            <Button
              type="submit"
              size="lg"
              loading={loading}
              iconRight={ArrowRight}
              className="w-full bg-gradient-to-r from-brand to-blue-500 shadow-[0_8px_20px_-6px_rgb(37_99_235/0.55)] transition-all hover:-translate-y-px hover:shadow-[0_12px_24px_-6px_rgb(37_99_235/0.6)]"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Demo credentials (development only) */}
          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Demo accounts</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-4 grid gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const style = ROLE_STYLE[acc.role] ?? ROLE_STYLE.Staff
                const Icon = style.icon
                const selected = form.email === acc.email
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    aria-pressed={selected}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${selected ? 'border-brand/40 bg-sky-soft ring-2 ring-brand/15' : 'border-line bg-white hover:-translate-y-px hover:border-slate-300 hover:shadow-card'}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${style.chip}`}>
                      <Icon size={16} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">{acc.role}</span>
                      <span className="block truncate font-mono text-[11px] text-slate-500">{acc.email}</span>
                    </span>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">{acc.password}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
              Click an account to fill the form. Simulated sign-in for development only — replace with secure backend authentication before production.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} Papa Hila Laundry · Kilimani, Nairobi</p>
      </main>
    </div>
  )
}
