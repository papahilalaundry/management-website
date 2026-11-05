import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import Button from '../ui/Button'

const PAD = 6 // space around the highlighted element
const GAP = 14 // space between the element and the card
const EDGE = 12 // minimum distance from the screen edge
const CARD_W = 360

/** First element matching any selector that is actually visible on screen. */
function findTarget(selectors = []) {
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect()
      if (r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden') return el
    }
  }
  return null
}

function measure(el) {
  const r = el.getBoundingClientRect()
  const top = Math.max(r.top - PAD, 4)
  const left = Math.max(r.left - PAD, 4)
  const bottom = Math.min(r.bottom + PAD, window.innerHeight - 4)
  const right = Math.min(r.right + PAD, window.innerWidth - 4)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max))

/** Where the card goes: next to the highlight on wide screens, docked on phones. */
function cardPlacement(rect, card, vw, vh) {
  if (vw < 640) {
    const targetLow = rect && rect.top + rect.height / 2 > vh * 0.55
    return targetLow
      ? { style: { left: EDGE, right: EDGE, top: `calc(${EDGE}px + env(safe-area-inset-top))` } }
      : { style: { left: EDGE, right: EDGE, bottom: `calc(${EDGE}px + env(safe-area-inset-bottom))` } }
  }
  const w = Math.min(CARD_W, vw - EDGE * 2)
  if (!rect) return { style: { width: w, left: (vw - w) / 2, top: Math.max(EDGE, (vh - card.h) / 2) } }
  const centerX = clamp(rect.left + rect.width / 2 - w / 2, EDGE, vw - w - EDGE)
  const centerY = clamp(rect.top + rect.height / 2 - card.h / 2, EDGE, vh - card.h - EDGE)
  if (vh - (rect.top + rect.height) >= card.h + GAP + EDGE) return { style: { width: w, left: centerX, top: rect.top + rect.height + GAP } }
  if (rect.top >= card.h + GAP + EDGE) return { style: { width: w, left: centerX, top: rect.top - GAP - card.h } }
  if (vw - (rect.left + rect.width) >= w + GAP + EDGE) return { style: { width: w, left: rect.left + rect.width + GAP, top: centerY } }
  if (rect.left >= w + GAP + EDGE) return { style: { width: w, left: rect.left - GAP - w, top: centerY } }
  return { style: { width: w, left: (vw - w) / 2, top: vh - card.h - EDGE } }
}

/**
 * Full-screen walkthrough: dims the page, highlights one element per step
 * and explains it in a card. Esc closes, ← / → move between steps.
 * onClose('finish' | 'skip')
 */
export default function TourOverlay({ steps, onClose }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [searching, setSearching] = useState(Boolean(steps[0]?.target))
  const [card, setCard] = useState({ h: 220 })
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const elRef = useRef(null)
  const cardRef = useRef(null)
  const titleId = useId()
  const navigate = useNavigate()
  const location = useLocation()
  const step = steps[index]
  const isLast = index === steps.length - 1

  const goTo = useCallback((n) => {
    if (n < 0 || n >= steps.length) return
    elRef.current = null
    setRect(null)
    setSearching(Boolean(steps[n].target))
    setIndex(n)
  }, [steps])
  const next = useCallback(() => (isLast ? onClose('finish') : goTo(index + 1)), [isLast, onClose, goTo, index])
  const back = useCallback(() => goTo(index - 1), [goTo, index])

  // Open the step's page if we're not on it.
  const here = `${location.pathname}${location.search}`
  useEffect(() => {
    if (!step.route) return
    const onPage = step.route.includes('?') ? here === step.route : location.pathname === step.route
    if (!onPage) navigate(step.route)
  }, [step, here, location.pathname, navigate])

  // Find the step's element (pages load data first, so keep looking briefly).
  useEffect(() => {
    if (!step.target) return undefined
    let cancelled = false
    const started = Date.now()
    let timer
    const tick = () => {
      if (cancelled) return
      const el = findTarget(step.target)
      if (el) {
        elRef.current = el
        const r = el.getBoundingClientRect()
        if (r.top < 72 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: 'center' })
        requestAnimationFrame(() => {
          if (cancelled) return
          setRect(measure(el))
          setSearching(false)
        })
        return
      }
      if (Date.now() - started > 3500) {
        setSearching(false) // not on screen (e.g. hidden on phones) — show a centred card
        return
      }
      timer = setTimeout(tick, 120)
    }
    timer = setTimeout(tick, step.route ? 200 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [index, step])

  // Follow the element when the page scrolls or the window resizes.
  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight })
        if (elRef.current?.isConnected) setRect(measure(elRef.current))
      })
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [])

  // Keep track of the card's height so it can be placed on screen.
  useEffect(() => {
    const node = cardRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(([entry]) => setCard({ h: entry.contentRect.height + 2 }))
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Keyboard: Esc skips, arrows move.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose('skip')
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, next, back])

  // Move focus to the card for screen readers and keyboards.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true })
  }, [index])

  const showSpot = rect && !searching
  const placement = cardPlacement(showSpot ? rect : null, card, viewport.w, viewport.h)

  return createPortal(
    <div className="no-print fixed inset-0 z-[80]">
      {/* Blocks clicks on the page while the tour is open. */}
      <div className={`absolute inset-0 transition-colors duration-300 ${showSpot ? 'bg-transparent' : 'bg-navy-950/55'}`} aria-hidden />
      {showSpot && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/80 transition-all duration-300 ease-out"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: '0 0 0 9999px rgb(10 22 48 / 0.55)' }}
          aria-hidden
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="absolute animate-fade-in rounded-2xl bg-white p-5 shadow-pop outline-none"
        style={placement.style}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-brand">Step {index + 1} of {steps.length}</p>
          <button type="button" onClick={() => onClose('skip')} className="-mr-2 -mt-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Close tour">
            <X size={17} />
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-[17px] font-extrabold leading-snug text-ink">{step.title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">{step.body}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {!isLast ? (
            <button type="button" onClick={() => onClose('skip')} className="text-[13px] font-semibold text-slate-500 hover:text-ink">
              Skip tour
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            {index > 0 && <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={back}>Back</Button>}
            <Button size="sm" iconRight={isLast ? Check : ArrowRight} onClick={next}>{isLast ? 'Finish' : 'Next'}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
