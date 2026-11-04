const PALETTE = [
  'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700', 'bg-indigo-100 text-indigo-700', 'bg-orange-100 text-orange-700',
]
const SIZES = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-[13px]', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-xl' }

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}

function hash(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function Avatar({ name, size = 'md', className = '', ring = false }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${SIZES[size]} ${PALETTE[hash(name) % PALETTE.length]} ${ring ? 'ring-2 ring-white' : ''} ${className}`}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
