import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { NAV_SECTIONS } from '../../routes/navigation'
import Logo from './Logo'
import Avatar from '../ui/Avatar'
import Tooltip from '../ui/Tooltip'

function NavItem({ item, collapsed, badge, onNavigate }) {
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      data-tour={item.tour ? `nav-${item.tour}` : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-lg text-[13.5px] font-semibold transition-colors ${collapsed ? 'h-10 w-10 justify-center' : 'h-10 px-3'} ${
          isActive ? 'bg-white/[0.09] text-white' : 'text-navy-200 hover:bg-white/[0.05] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className={`absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-400 ${collapsed ? '-left-[14px]' : '-left-3'}`} aria-hidden />}
          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.9} className={isActive ? 'text-blue-300' : ''} aria-hidden />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {badge > 0 &&
            (collapsed ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-navy-900" aria-label={`${badge} unread`} />
            ) : (
              <span className="rounded-full bg-red-500 px-1.5 text-[10.5px] font-bold leading-[18px] text-white">{badge > 99 ? '99+' : badge}</span>
            ))}
        </>
      )}
    </NavLink>
  )
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  )
}

function SidebarContent({ collapsed, onToggle, onNavigate, mobile }) {
  const { user, can, logout } = useAuth()
  const { unread } = useNotifications()
  const roleLabel = user.role[0].toUpperCase() + user.role.slice(1)

  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        <Logo collapsed={collapsed} light subtitle="Laundry Management" />
        {mobile && (
          <button type="button" onClick={onNavigate} className="rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white" aria-label="Close menu">
            <X size={20} />
          </button>
        )}
      </div>

      <nav data-tour="menu" className={`scroll-thin flex-1 overflow-y-auto pb-4 pt-2 ${collapsed ? 'px-[18px]' : 'px-3'}`} aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => can(i.permission))
          if (!items.length) return null
          return (
            <div key={section.title} className="mb-5">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
              ) : (
                <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-navy-300/80">{section.title}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem key={item.to} item={item} collapsed={collapsed} badge={item.badge === 'notifications' ? unread : 0} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {!mobile && (
        <div className={`border-t border-white/[0.06] py-2 ${collapsed ? 'flex justify-center' : 'px-3'}`}>
          <Tooltip content={collapsed ? 'Expand sidebar' : ''} side="right" disabled={!collapsed}>
            <button
              type="button"
              onClick={onToggle}
              className={`flex h-9 items-center gap-3 rounded-lg text-[13px] font-medium text-navy-200 transition hover:bg-white/[0.05] hover:text-white ${collapsed ? 'w-10 justify-center' : 'w-full px-3'}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!collapsed && 'Collapse'}
            </button>
          </Tooltip>
        </div>
      )}

      <div className={`border-t border-white/[0.06] p-3 ${collapsed ? 'flex flex-col items-center gap-2' : ''}`}>
        {collapsed ? (
          <>
            <Tooltip content={`${user.name} · ${roleLabel}`} side="right">
              <NavLink to="/settings?tab=profile" aria-label="My profile">
                <Avatar name={user.name} size="sm" />
              </NavLink>
            </Tooltip>
            <Tooltip content="Log out" side="right">
              <button type="button" onClick={logout} className="rounded-lg p-2 text-navy-200 hover:bg-white/10 hover:text-white" aria-label="Log out">
                <LogOut size={17} />
              </button>
            </Tooltip>
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
            <NavLink to="/settings?tab=profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={user.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-white">{user.name}</p>
                <p className="truncate text-[11px] text-navy-200">{roleLabel}</p>
              </div>
            </NavLink>
            <Tooltip content="Log out" side="top">
              <button type="button" onClick={logout} className="rounded-lg p-2 text-navy-200 transition hover:bg-white/10 hover:text-white" aria-label="Log out">
                <LogOut size={17} />
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && onMobileClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      <aside className={`no-print fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block ${collapsed ? 'w-[76px]' : 'w-[260px]'}`}>
        <SidebarContent collapsed={collapsed} onToggle={onToggle} />
      </aside>

      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/50" onClick={onMobileClose} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] animate-slide-in-left bg-navy-900 pt-safe pb-safe shadow-pop">
            <SidebarContent collapsed={false} mobile onNavigate={onMobileClose} />
          </div>
        </div>
      )}
    </>
  )
}
