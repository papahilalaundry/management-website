import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StartupScreen from './components/layout/StartupScreen.jsx'
import { initStorage } from './services/storage'

const root = createRoot(document.getElementById('root'))

root.render(<StartupScreen />)

initStorage()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((error) => {
    console.error('[startup] Could not connect to Firestore', error)
    root.render(<StartupScreen error={error} />)
  })

// Offline support / installable app. Only in production builds: in development
// a service worker would cache files and fight with hot reloading.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed', err))
  })
}
