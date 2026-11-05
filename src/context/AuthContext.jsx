/**
 * Authentication state, backed by Firebase Authentication (see
 * services/authService.js). The signed-in staff profile is restored before
 * the app renders, so the first render already knows who is signed in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authService, CHANGE_EVENT } from '../services'
import { can as canDo } from '../utils/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.restoreSession())

  // Keep the signed-in user fresh: after editing your own profile, when an
  // admin deactivates the account, or when you sign out in another tab.
  useEffect(() => {
    const onChange = (e) => {
      const cols = e.detail?.collections ?? []
      if (!cols.includes('staff') && !cols.includes('session')) return
      setUser(authService.restoreSession())
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  /** credentials: { username, password, remember } */
  const login = useCallback(async (credentials) => {
    const u = await authService.login(credentials)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, login, logout, can: (perm) => canDo(user, perm) }), [user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
