import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { LogoMark } from '../components/layout/Logo'
import Button from '../components/ui/Button'
import { Checkbox, Field, Input } from '../components/ui/Field'
import { LOGIN_EMAIL_DOMAIN, normalizeUsername } from '../data/constants'

/**
 * Staff sign in with their username only; the login email
 * (username@papahilalaundry.com) is filled in automatically.
 */
export default function Login() {
  const { login } = useAuth()
  const settings = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '', remember: true })
  const [errors, setErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const businessName = settings?.business?.name || 'Papa Hila Laundry'

  const set = (key) => (e) => {
    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    // If someone types the full address, keep only the username part.
    if (key === 'username') value = value.replace(/@.*$/, '').replace(/\s/g, '')
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((er) => ({ ...er, [key]: undefined }))
    setAuthError('')
  }

  const submit = async (e) => {
    e.preventDefault()
    const v = {}
    if (!normalizeUsername(form.username)) v.username = 'Username is required'
    if (!form.password) v.password = 'Password is required'
    setErrors(v)
    if (Object.keys(v).length) return
    setLoading(true)
    try {
      await login({ username: form.username, password: form.password, remember: form.remember })
      navigate(location.state?.from?.pathname ?? '/dashboard', { replace: true })
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setAuthError(err.message)
      setLoading(false)
    }
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
              Sign in to <span className="font-semibold text-ink">{businessName}</span> to continue.
            </p>
          </div>

          {authError && (
            <div role="alert" className="mt-6 flex animate-fade-in items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] text-red-700">
              <CircleAlert size={17} className="mt-px shrink-0" aria-hidden />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-8 space-y-4">
            <Field label="Username" error={errors.username}>
              {(p) => (
                <div className="group relative flex items-stretch">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand" aria-hidden />
                  <Input
                    {...p}
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="e.g. grace"
                    value={form.username}
                    onChange={set('username')}
                    className="h-11 min-w-0 flex-1 rounded-r-none pl-10"
                  />
                  <span className="flex shrink-0 select-none items-center rounded-r-lg border border-l-0 border-line bg-slate-50 px-2.5 text-[12.5px] font-medium text-slate-500" title="Added automatically">
                    @{LOGIN_EMAIL_DOMAIN}
                  </span>
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
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">© {new Date().getFullYear()} {businessName}</p>
      </main>
    </div>
  )
}
