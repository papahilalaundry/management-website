import { createContext, useCallback, useContext, useMemo } from 'react'
import { notificationService } from '../services'
import { useAsync } from '../hooks/useAsync'

const NotificationContext = createContext(null)
const WATCH = ['notifications']

/** Shares one live notification list between the sidebar, top bar and page. */
export function NotificationProvider({ children }) {
  const { data, loading, reload, setData } = useAsync(() => notificationService.getNotifications(), [], { live: true, watch: WATCH })
  const notifications = useMemo(() => data ?? [], [data])
  const unread = notifications.filter((n) => !n.read).length

  const markRead = useCallback(
    async (id, read = true) => {
      setData((list) => list?.map((n) => (n.id === id ? { ...n, read } : n)))
      await notificationService.markRead(id, read)
    },
    [setData],
  )

  const markAllRead = useCallback(async () => {
    setData((list) => list?.map((n) => ({ ...n, read: true })))
    await notificationService.markAllRead()
  }, [setData])

  const value = useMemo(() => ({ notifications, unread, loading, reload, markRead, markAllRead }), [notifications, unread, loading, reload, markRead, markAllRead])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  return useContext(NotificationContext)
}
