import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/20 disabled:bg-brand/50',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-900/50',
  secondary: 'bg-white text-ink border border-line hover:bg-slate-50 hover:border-slate-300 shadow-card disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink disabled:text-slate-300',
  soft: 'bg-sky-soft text-brand hover:bg-blue-100 disabled:opacity-60',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/20 disabled:bg-red-300',
  'danger-soft': 'bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
}
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 sm:h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg justify-center',
  'icon-lg': 'h-11 w-11 rounded-xl justify-center',
  'icon-sm': 'h-8 w-8 rounded-lg justify-center',
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false, className = '', children, to, type = 'button', disabled, ...props },
  ref,
) {
  const classes = `inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 select-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
  const iconSize = size === 'xs' || size === 'sm' || size === 'icon-sm' ? 15 : 17
  const content = (
    <>
      {loading ? <LoaderCircle size={iconSize} className="animate-spin" aria-hidden /> : Icon && <Icon size={iconSize} strokeWidth={2} aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} strokeWidth={2} aria-hidden />}
    </>
  )
  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...props}>
        {content}
      </Link>
    )
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  )
})

export default Button
