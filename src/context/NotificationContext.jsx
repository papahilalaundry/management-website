import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CHANGE_EVENT, notificationService } from '../services'

const NotificationContext = createContext(null)
const RECENT = 8
const POLL_MS = 60_000

/**
 * Shares the unread count (a server-side count, not a full list) and the few
 * latest notifications between the sidebar, top bar and bell menu.
 * Refreshes on navigation, every minute, and when this app changes notifications.
 */
export function NotificationProvider({ children }) {
  const location = useLocation()
  const [recent, setRecent] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const busy = useRef(false)

  const reload = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const [rows, count] = await Promise.all([notificationService.getRecent(RECENT), notificationService.getUnreadCount()])
      setRecent(rows)
      setUnread(count)
    } catch (e) {
      console.warn('[notifications] refresh failed', e)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(reload, 0)
    return () => clearTimeout(t)
  }, [reload, location.pathname])

  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), POLL_MS)
    const onChange = (e) => e.detail?.collections?.includes('notifications') && reload()
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      clearInterval(timer)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [reload])

  const markRead = useCallback(async (id, read = true) => {
    let changed = false
    setRecent((list) => list.map((n) => {
      if (n.id !== id || n.read === read) return n
      changed = true
      return { ...n, read }
    }))
    if (changed) setUnread((u) => Math.max(0, u + (read ? -1 : 1)))
    await notificationService.markRead(id, read)
    reload()
  }, [reload])

  const markAllRead = useCallback(async () => {
    setRecent((list) => list.map((n) => ({ ...n, read: true })))
    setUnread(0)
    await notificationService.markAllRead()
    reload()
  }, [reload])

  const value = useMemo(
    () => ({ notifications: recent, unread, loading, reload, markRead, markAllRead }),
    [recent, unread, loading, reload, markRead, markAllRead],
  )
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  return useContext(NotificationContext)
}
