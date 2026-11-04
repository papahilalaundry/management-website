import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TriangleAlert, X } from 'lucide-react'
import Button from './Button'
import { Field, Textarea } from './Field'

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openCount = 0

export default function Modal({ open, onClose, title, description, icon: Icon, size = 'md', children, footer, closeOnOverlay = true, className = '' }) {
  const panelRef = useRef(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    openCount += 1
    document.body.style.overflow = 'hidden'
    const focusFirst = setTimeout(() => {
      const el = panelRef.current?.querySelector('[data-autofocus]') ?? panelRef.current?.querySelector(FOCUSABLE)
      el?.focus()
    }, 30)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
      if (e.key === 'Tab' && panelRef.current) {
        const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)]
        if (!nodes.length) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const panel = panelRef.current
    panel?.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focusFirst)
      panel?.removeEventListener('keydown', onKey)
      openCount -= 1
      if (openCount === 0) document.body.style.overflow = ''
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/40 backdrop-blur-[2px]" onClick={closeOnOverlay ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative flex max-h-[92dvh] w-full animate-sheet-up flex-col rounded-t-3xl bg-white shadow-pop sm:max-h-[92vh] sm:animate-slide-up sm:rounded-2xl ${SIZES[size]} ${className}`}
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-slate-200" />
        </div>
        {title && (
          <div className="flex items-start gap-3 border-b border-line px-5 pb-4 pt-2.5 sm:px-6 sm:pt-4">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-brand">
                <Icon size={18} aria-hidden />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-1 rounded-full p-2 text-slate-400 sm:rounded-lg sm:p-1.5 transition hover:bg-slate-100 hover:text-ink" aria-label="Close dialog">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={`scroll-thin flex-1 overscroll-contain overflow-y-auto px-5 py-5 sm:px-6 ${footer ? '' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5'}`}>{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-line bg-slate-50/60 px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-3.5 [&>*]:w-full sm:[&>*]:w-auto">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Confirmation for destructive actions.
 * Pass `requireReason` to collect a reason (e.g. cancelling an order).
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', tone = 'danger', loading = false, requireReason = false, reasonLabel = 'Reason' }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setReason('')
      setError('')
    }
  }
  const submit = () => {
    if (requireReason && !reason.trim()) {
      setError(`${reasonLabel} is required`)
      return
    }
    onConfirm(reason.trim())
  }
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={submit} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
          <TriangleAlert size={20} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <div className="mt-1 text-sm text-muted">{message}</div>
          {requireReason && (
            <Field label={reasonLabel} error={error} required className="mt-4">
              {(p) => <Textarea {...p} data-autofocus rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly explain why…" />}
            </Field>
          )}
        </div>
      </div>
    </Modal>
  )
}
