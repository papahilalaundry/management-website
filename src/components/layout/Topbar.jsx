import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, ChevronDown, ChevronLeft, LogOut, Plus, Search, Settings, User } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { PAGE_TITLES, parentPath } from '../../routes/navigation'
import { LogoMark } from './Logo'
import GlobalSearch from './GlobalSearch'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Dropdown from '../ui/Dropdown'
import { NotificationIcon } from '../shared/NotificationIcon'
import { timeAgo } from '../../utils/formatDate'

function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const latest = notifications.slice(0, 6)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink lg:rounded-lg"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 animate-fade-in overflow-hidden rounded-xl border border-line bg-white shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">Notifications</p>
              <p className="text-xs text-muted">{unread} unread</p>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] divide-y sm:max-h-[380px] divide-line overflow-y-auto">
            {latest.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">You’re all caught up.</li>}
            {latest.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read) markRead(n.id)
                    setOpen(false)
                    if (n.link) navigate(n.link)
                  }}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${n.read ? '' : 'bg-sky-soft/40'}`}
                >
                  <NotificationIcon category={n.category} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line bg-slate-50/60 py-2.5 text-center text-[13px] font-semibold text-brand hover:bg-slate-100">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

/** Full-screen search for phones: opens over the app, closes after picking a result. */
function MobileSearch({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  // Portal to <body>: the header's backdrop blur would otherwise trap this
  // fixed overlay inside the header's box.
  return createPortal(
    <div className="fixed inset-0 z-50 animate-fade-in overflow-y-auto overscroll-contain bg-canvas pt-safe lg:hidden" role="dialog" aria-modal="true" aria-label="Search">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <GlobalSearch autoFocus inline onNavigate={onClose} className="min-w-0 flex-1" />
        <button type="button" onClick={onClose} className="h-11 shrink-0 rounded-lg px-2.5 text-sm font-semibold text-brand active:bg-sky-soft">
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  )
}

export default function Topbar() {
  const { user, logout, can } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const path = location.pathname
  const parent = parentPath(path)
  const title = /^\/orders\/[^/]+\/edit$/.test(path) ? 'Edit Order' : PAGE_TITLES.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'Papa Hila'
  // Go back through history when we came from inside the app, otherwise to the parent list.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(parent))

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-white/90 pt-safe backdrop-blur-md">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-6 lg:h-16 lg:gap-3">
        <div className="shrink-0 lg:hidden">
          {parent ? (
            <button type="button" onClick={goBack} className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-slate-100" aria-label="Go back">
              <ChevronLeft size={24} strokeWidth={2.2} />
            </button>
          ) : (
            <Link to="/dashboard" aria-label="Papa Hila home" className="block">
              <LogoMark size={32} />
            </Link>
          )}
        </div>
        <div className="min-w-0 flex-1 lg:w-48 lg:flex-none xl:w-56">
          <p className="truncate text-base font-bold text-ink lg:text-[15px]">{title}</p>
          <p className="hidden items-center gap-1 text-[11.5px] text-muted lg:flex">
            <CalendarDays size={12} aria-hidden /> {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>

        <GlobalSearch className="mx-auto hidden w-full max-w-md lg:block" />

        <div className="ml-auto flex items-center gap-0.5 sm:gap-2">
          <button type="button" onClick={() => setSearchOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 active:bg-slate-100 lg:hidden" aria-label="Search orders and customers">
            <Search size={20} />
          </button>
          {can('orders.create') && (
            <span className="hidden lg:block">
              <Button to="/orders/new" icon={Plus} size="sm" className="h-9">New Order</Button>
            </span>
          )}
          <NotificationBell />
          <Dropdown
            width={230}
            trigger={
              <button type="button" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-slate-100 lg:rounded-lg lg:pr-1.5" aria-label="Account menu">
                <Avatar name={user.name} size="sm" />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-[13px] font-semibold text-ink">{user.name}</span>
                  <span className="block text-[11px] capitalize text-muted">{user.role}</span>
                </span>
                <ChevronDown size={15} className="hidden text-slate-400 lg:block" />
              </button>
            }
            items={[
              { heading: user.email },
              { label: 'My profile', icon: User, onClick: () => navigate('/settings?tab=profile') },
              { label: 'Settings', icon: Settings, onClick: () => navigate('/settings') },
              { divider: true },
              { label: 'Log out', icon: LogOut, danger: true, onClick: logout },
            ]}
          />
        </div>
      </div>
      {searchOpen && <MobileSearch onClose={closeSearch} />}
    </header>
  )
}
