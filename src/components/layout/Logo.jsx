import { useId } from 'react'

/** Papa Hila Laundry brand mark: a washing machine with water in the drum. Keep in sync with public/icons/icon.svg. */
export function LogoMark({ size = 36, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <clipPath id={`${id}glass`}>
          <circle cx="20" cy="23.5" r="5.4" />
        </clipPath>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}bg)`} />
      <rect x="8.5" y="6" width="23" height="28" rx="5.5" fill="#fff" />
      <rect x="8.5" y="14.2" width="23" height="0.6" fill="#DBEAFE" />
      <circle cx="13.2" cy="10.2" r="1.5" fill="#2563EB" />
      <circle cx="17.6" cy="10.2" r="1.5" fill="#93C5FD" />
      <rect x="22.2" y="9.3" width="5.6" height="1.8" rx="0.9" fill="#BFDBFE" />
      <circle cx="20" cy="23.5" r="7.4" fill="#2563EB" />
      <circle cx="20" cy="23.5" r="5.4" fill="#DBEAFE" />
      <path clipPath={`url(#${id}glass)`} fill="#60A5FA" d="M13 24.2q1.75-1.8 3.5 0t3.5 0 3.5 0 3.5 0V31H13z" />
      <path d="M16.6 21.6a4 4 0 0 1 2.4-2" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ collapsed = false, light = false, subtitle = 'Management System' }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <div className="leading-tight">
          <p className={`text-[15px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Papa Hila</p>
          <p className={`text-[11px] font-medium ${light ? 'text-navy-200' : 'text-muted'}`}>{subtitle}</p>
        </div>
      )}
    </div>
  )
}
