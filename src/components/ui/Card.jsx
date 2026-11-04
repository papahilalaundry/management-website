export function Card({ className = '', children, as: Tag = 'div', ...props }) {
  return (
    <Tag className={`card ${className}`} {...props}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, icon: Icon, action, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5 ${className}`}>
      <div className="flex min-w-0 flex-1 basis-40 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-soft text-brand">
            <Icon size={16} strokeWidth={2} aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className = '', children }) {
  return <div className={`px-4 pb-4 sm:px-5 sm:pb-5 ${className}`}>{children}</div>
}
