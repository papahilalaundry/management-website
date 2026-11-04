/** Papa Hila Laundry brand mark: a stylised washer door with a water swirl. */
export function LogoMark({ size = 36, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#2563EB" />
      <rect x="9" y="7.5" width="22" height="25" rx="5" stroke="#fff" strokeWidth="2.2" />
      <circle cx="14" cy="12.5" r="1.4" fill="#fff" />
      <circle cx="18.5" cy="12.5" r="1.4" fill="#BFDBFE" />
      <circle cx="20" cy="22" r="6.2" stroke="#fff" strokeWidth="2.2" />
      <path d="M16.2 22.6c1.3-1.6 2.6-1.6 3.8 0s2.5 1.6 3.8 0" stroke="#93C5FD" strokeWidth="1.9" strokeLinecap="round" />
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
