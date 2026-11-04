const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200/70',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200/70',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200/70',
  red: 'bg-red-50 text-red-700 ring-red-200/70',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200/70',
  navy: 'bg-navy-900 text-white ring-navy-900',
}
const DOTS = {
  slate: 'bg-slate-400', blue: 'bg-blue-500', sky: 'bg-sky-500', indigo: 'bg-indigo-500', violet: 'bg-violet-500', cyan: 'bg-cyan-500',
  green: 'bg-emerald-500', amber: 'bg-amber-500', orange: 'bg-orange-500', red: 'bg-red-500', pink: 'bg-pink-500', navy: 'bg-white',
}

export default function Badge({ tone = 'slate', dot = false, icon: Icon, children, className = '', size = 'md' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-0.5 text-[11.5px]'} ${TONES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[tone]}`} aria-hidden />}
      {Icon && <Icon size={12} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  )
}
