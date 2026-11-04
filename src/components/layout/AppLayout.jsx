import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { NotificationProvider } from '../../context/NotificationContext'
import { SmsProvider } from '../../context/SmsContext'

const COLLAPSE_KEY = 'phl:ui:sidebar-collapsed'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)

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
          <Topbar onMenuClick={() => setMobileOpen(true)} />
          <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
            <Outlet />
          </main>
        </div>
      </SmsProvider>
    </NotificationProvider>
  )
}
