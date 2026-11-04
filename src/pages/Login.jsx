import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DEMO_ACCOUNTS } from '../services'
import { LogoMark } from '../components/layout/Logo'
import Button from '../components/ui/Button'
import { Checkbox, Field, Input } from '../components/ui/Field'
import { isValidEmail } from '../utils/validators'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-5 py-10 sm:px-6">
      <main className="w-full max-w-[380px] animate-slide-up">
        <div>
          {/* Brand mark heads the greeting as one centred group */}
          <div className="flex flex-col items-center text-center">
            <LogoMark size={56} className="rounded-2xl shadow-[0_10px_24px_-10px_rgb(37_99_235/0.6)]" />
            <h1 className="mt-6 text-[28px] font-extrabold leading-tight tracking-tight text-ink">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">
              Sign in to <span className="font-semibold text-ink">Papa Hila Laundry</span> to continue.
            </p>
          </div>

          {authError && (
            <div role="alert" className="mt-6 flex animate-fade-in items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
              <CircleAlert size={17} className="mt-px shrink-0" aria-hidden />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-8 space-y-4">
            <Field label="Email address" error={errors.email}>
              {(p) => (
                <div className="group relative">
                  <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand" aria-hidden />
                  <Input {...p} type="email" autoComplete="username" placeholder="you@papahila.com" value={form.email} onChange={set('email')} className="h-11 pl-10" />
                </div>
              )}
            </Field>
            <Field label="Password" error={errors.password}>
              {(p) => (
                <div className="group relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand" aria-hidden />
                  <Input {...p} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={form.password} onChange={set('password')} className="h-11 pl-10 pr-11" />
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
              className="w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {/* Demo credentials (development only) */}
          <div className="mt-10">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Demo accounts</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <ul className="mt-3 -mx-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const selected = form.email === acc.email
                return (
                  <li key={acc.email}>
                    <button
                      type="button"
                      onClick={() => fillDemo(acc)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors ${selected ? 'bg-sky-soft' : 'hover:bg-slate-50 active:bg-slate-100'}`}
                    >
                      <span className={`w-16 shrink-0 font-semibold ${selected ? 'text-brand' : 'text-ink'}`}>{acc.role}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-500">{acc.email}</span>
                      <span className="shrink-0 font-mono text-xs text-slate-500">{acc.password}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
              Click an account to fill the form. Simulated sign-in for development only — replace with secure backend authentication before production.
            </p>
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">© {new Date().getFullYear()} Papa Hila Laundry · Kilimani, Nairobi</p>
      </main>
    </div>
  )
}
