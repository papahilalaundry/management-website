import { createContext, useContext, useEffect, useState } from 'react'
import { CHANGE_EVENT, settingsService } from '../services'
import { setDateFormatPreference } from '../utils/formatDate'

const SettingsContext = createContext(null)

/** Business settings are needed synchronously across the app (receipts, dates). */
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const s = settingsService.peekSettings()
    setDateFormatPreference(s.preferences?.dateFormat)
    return s
  })

  useEffect(() => {
    const onChange = (e) => {
      if (!e.detail?.collections?.includes('settings')) return
      const s = settingsService.peekSettings()
      setDateFormatPreference(s.preferences?.dateFormat)
      setSettings(s)
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  return useContext(SettingsContext)
}
