/**
 * Guided tour state. The full walkthrough starts automatically once for each
 * new user (staff.tourDoneAt not set) and can be replayed from the account
 * menu, Settings → My profile, or Help & guides. Guides start shorter tours.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { staffService } from '../../services'
import { mainTourSteps } from './tourSteps'
import TourOverlay from './TourOverlay'

const TourContext = createContext(null)
const doneKey = (userId) => `phl:tour-done:${userId}`

export function TourProvider({ children }) {
  const { user, can } = useAuth()
  const [tour, setTour] = useState(null) // { steps, main, key }

  const start = useCallback((steps, { main = false } = {}) => {
    const visible = steps.filter((s) => !s.permission || can(s.permission))
    if (visible.length) setTour({ steps: visible, main, key: Date.now() })
  }, [can])

  const startMainTour = useCallback(() => start(mainTourSteps(user), { main: true }), [start, user])

  const close = useCallback(() => {
    if (tour?.main && user) {
      localStorage.setItem(doneKey(user.id), new Date().toISOString())
      staffService.markTourDone().catch((e) => console.warn('[tour] could not save progress', e))
    }
    setTour(null)
  }, [tour, user])

  // First sign-in: start the tour once, shortly after the dashboard appears.
  const startRef = useRef(startMainTour)
  useEffect(() => {
    startRef.current = startMainTour
  }, [startMainTour])
  const userId = user?.id
  const alreadyDone = Boolean(user?.tourDoneAt)
  useEffect(() => {
    if (!userId || alreadyDone || localStorage.getItem(doneKey(userId))) return undefined
    const timer = setTimeout(() => startRef.current(), 900)
    return () => clearTimeout(timer)
  }, [userId, alreadyDone])

  const value = useMemo(() => ({ start, startMainTour, active: Boolean(tour) }), [start, startMainTour, tour])
  return (
    <TourContext.Provider value={value}>
      {children}
      {tour && user && <TourOverlay key={tour.key} steps={tour.steps} onClose={close} />}
    </TourContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}
