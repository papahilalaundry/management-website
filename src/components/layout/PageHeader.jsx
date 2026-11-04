import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2 hidden sm:block">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-slate-300" aria-hidden />}
            {item.to ? (
              <Link to={item.to} className="font-medium hover:text-brand">{item.label}</Link>
            ) : (
              <span className="font-semibold text-slate-600" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * On phones the top bar already shows the page name, so by default the big
 * title and description are hidden there (still read by screen readers).
 * Pass `mobileTitle` when the title says something the top bar doesn't
 * (an order number, a customer's name, the dashboard greeting).
 */
export default function PageHeader({ title, description, actions, breadcrumbs, children, mobileTitle = false }) {
  return (
    <div className={`mb-4 sm:mb-6 ${!actions && !mobileTitle && !children ? 'max-sm:mb-0' : ''}`}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className={`min-w-0 ${mobileTitle || children ? '' : 'max-sm:sr-only'}`}>
          <h1 className={`text-[22px] font-extrabold leading-tight tracking-tight text-ink sm:text-[26px] ${mobileTitle ? '' : 'max-sm:sr-only'}`}>{title}</h1>
          {description && <p className={`mt-1 text-[13px] text-muted sm:text-sm ${mobileTitle ? '' : 'max-sm:hidden'}`}>{description}</p>}
          {children}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
