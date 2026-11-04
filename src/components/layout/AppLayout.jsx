import { useCallback, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import BottomNav from './BottomNav'
import { NotificationProvider } from '../../context/NotificationContext'
import { SmsProvider } from '../../context/SmsContext'
import { hidesTabBar } from '../../routes/navigation'

const COLLAPSE_KEY = 'phl:ui:sidebar-collapsed'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  // Forms and order details have their own bottom action bar, so the tab bar steps aside.
  const showTabs = !hidesTabBar(pathname)

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }, [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <NotificationProvider>
      <SmsProvider>
        <a href="#main" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <Sidebar collapsed={collapsed} onToggle={toggle} mobileOpen={mobileOpen} onMobileClose={closeMobile} />
        <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[260px]'}`}>
          <Topbar />
          <main
            id="main"
            className={`mx-auto w-full max-w-[1600px] px-3.5 pt-4 sm:px-6 lg:py-8 ${showTabs ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]'}`}
          >
            <Outlet />
          </main>
        </div>
        {showTabs && <BottomNav onMore={() => setMobileOpen(true)} />}
      </SmsProvider>
    </NotificationProvider>
  )
}
