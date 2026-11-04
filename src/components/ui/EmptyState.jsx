import { CircleAlert, Inbox } from 'lucide-react'
import Button from './Button'

export default function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-8' : 'px-6 py-14'} ${className}`}>
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-sky-soft/60" aria-hidden />
        <span className={`relative flex items-center justify-center rounded-2xl border border-line bg-white text-slate-400 shadow-card ${compact ? 'h-11 w-11' : 'h-14 w-14'}`}>
          <Icon size={compact ? 20 : 24} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <h3 className={`font-bold text-ink ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className = '' }) {
  return (
    <EmptyState
      className={className}
      icon={CircleAlert}
      title="We couldn’t load this data"
      description={error?.message ?? 'An unexpected error occurred.'}
      action={onRetry && <Button variant="secondary" onClick={() => onRetry()}>Try again</Button>}
    />
  )
}
