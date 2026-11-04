/**
 * Authentication state. NOTE: backed by the SIMULATED authService — see
 * services/authService.js for what must change before production.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authService, CHANGE_EVENT } from '../services'
import { can as canDo } from '../utils/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.restoreSession())

  // Keep the signed-in user fresh (e.g. after editing your own profile) and
  // sign out if the account is deactivated or demo data is reset.
  useEffect(() => {
    const onChange = (e) => {
      if (!e.detail?.collections?.includes('staff')) return
      setUser(authService.restoreSession())
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

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
