import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', ariaLabel, ...props }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className="field-input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
