import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, LayoutDashboard, Menu, Plus, Users } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

function Tab({ to, label, icon: Icon, end, activeMatch }) {
  const { pathname } = useLocation()
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const active = activeMatch ? activeMatch(pathname) : isActive
        return `group flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold transition-colors ${active ? 'text-brand' : 'text-slate-500 active:text-ink'}`
      }}
    >
      {({ isActive }) => {
        const active = activeMatch ? activeMatch(pathname) : isActive
        return (
          <>
            <span className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${active ? 'bg-sky-soft' : 'group-active:bg-slate-100'}`}>
              <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
            </span>
            <span>{label}</span>
          </>
        )
      }}
    </NavLink>
  )
}

/**
 * App-style tab bar for phones and tablets (hidden on desktop, where the
 * sidebar is used). "More" opens the full navigation drawer.
 */
export default function BottomNav({ onMore }) {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const moreActive = !['/dashboard', '/orders', '/customers'].some((p) => pathname.startsWith(p))
  const ordersActive = (p) => p.startsWith('/orders') && p !== '/orders/new'

  return (
    <nav
      aria-label="Quick navigation"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-safe shadow-[0_-4px_16px_-8px_rgb(16_24_40/0.12)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-stretch px-1">
        <Tab to="/dashboard" label="Home" icon={LayoutDashboard} />
        <Tab to="/orders" label="Orders" icon={ClipboardList} activeMatch={ordersActive} />
        {can('orders.create') && (
          <div className="flex flex-1 justify-center">
            <NavLink
              to="/orders/new"
              aria-label="New order"
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-blue-500 text-white shadow-[0_10px_24px_-6px_rgb(37_99_235/0.6)] ring-4 ring-white transition active:scale-95"
            >
              <Plus size={26} strokeWidth={2.4} aria-hidden />
            </NavLink>
          </div>
        )}
        <Tab to="/customers" label="Customers" icon={Users} />
        <button
          type="button"
          onClick={onMore}
          aria-label="More pages"
          className={`group flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold ${moreActive ? 'text-brand' : 'text-slate-500 active:text-ink'}`}
        >
          <span className={`flex h-7 w-14 items-center justify-center rounded-full ${moreActive ? 'bg-sky-soft' : 'group-active:bg-slate-100'}`}>
            <Menu size={21} strokeWidth={moreActive ? 2.3 : 1.9} aria-hidden />
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  )
}
