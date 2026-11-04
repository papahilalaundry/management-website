import { ArrowDown, ArrowDownUp, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react'
import Pagination from './Pagination'
import { TableSkeleton } from './Skeleton'
import EmptyState from './EmptyState'

/**
 * Generic table used by every list in the app.
 *
 * columns: [{ key, header, render?(row), sortable?, sortType?: 'text'|'number'|'date', align?: 'right'|'center', className?, hideBelow?: 'sm'|'md'|'lg' }]
 * table:   the object returned by useTable() (sorting, pagination, selection)
 *
 * mobileCard (optional): on phones the table is replaced by a tappable card list.
 *   { leading?, title, subtitle?, meta?, value?, badge? } — each a function(row) => node.
 *   A column with key 'actions' is shown on the card's right edge automatically.
 */
const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

const SORT_WORDS = {
  date: ['Oldest first', 'Newest first'],
  number: ['Lowest first', 'Highest first'],
  text: ['A to Z', 'Z to A'],
}
const sortTypeOf = (col) =>
  col.sortType ?? (/(At|date)$/i.test(col.key) ? 'date' : col.key === 'id' || col.align === 'right' || col.align === 'center' ? 'number' : 'text')

function MobileSortBar({ columns, table }) {
  const sortable = columns.filter((c) => c.sortable && typeof c.header === 'string')
  if (!sortable.length || !table.setSort) return null
  const value = table.sort ? `${table.sort.key}:${table.sort.dir}` : ''
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50/70 px-4 py-2 md:hidden">
      <span className="text-xs font-medium text-muted">
        {table.total.toLocaleString()} result{table.total === 1 ? '' : 's'}
      </span>
      <label className="relative flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
        <ArrowDownUp size={14} className="shrink-0 text-slate-400" aria-hidden />
        <span className="sr-only">Sort by</span>
        <select
          value={value}
          onChange={(e) => {
            const [key, dir] = e.target.value.split(':')
            table.setSort(key ? { key, dir } : null)
          }}
          className="max-w-[190px] cursor-pointer truncate appearance-none bg-transparent py-1 pr-1 text-right text-xs font-semibold text-ink outline-none"
        >
          {!table.sort && <option value="">Default order</option>}
          {sortable.flatMap((c) => {
            const [asc, desc] = SORT_WORDS[sortTypeOf(c)]
            return [
              <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.header}: {desc}</option>,
              <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.header}: {asc}</option>,
            ]
          })}
        </select>
      </label>
    </div>
  )
}

function MobileCards({ rows, card, actionsCol, onRowClick, getRowLabel, rowClassName }) {
  return (
    <ul className="divide-y divide-line md:hidden">
      {rows.map((row) => (
        <li key={row.id} className={`relative flex items-center gap-3 px-4 py-3.5 transition-colors ${onRowClick ? 'active:bg-slate-50' : ''} ${rowClassName?.(row) ?? ''}`}>
          {onRowClick && (
            <button type="button" onClick={() => onRowClick(row)} className="absolute inset-0 h-full w-full" aria-label={getRowLabel?.(row) ?? `Open ${row.id}`} />
          )}
          {card.leading && <div className="pointer-events-none relative shrink-0">{card.leading(row)}</div>}
          <div className="pointer-events-none relative min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold text-ink">{card.title(row)}</div>
            {card.subtitle && <div className="mt-0.5 truncate text-[12.5px] text-muted">{card.subtitle(row)}</div>}
            {card.meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">{card.meta(row)}</div>}
          </div>
          {(card.value || card.badge) && (
            <div className="pointer-events-none relative flex shrink-0 flex-col items-end gap-1.5 text-right">
              {card.value && <div className="text-[14px] font-bold tabular-nums text-ink">{card.value(row)}</div>}
              {card.badge && card.badge(row)}
            </div>
          )}
          {actionsCol ? (
            <div className="relative -mr-2 shrink-0 [&_button]:p-2.5">{actionsCol.render(row)}</div>
          ) : (
            onRowClick && <ChevronRight size={18} className="pointer-events-none relative -mr-1 shrink-0 text-slate-300" aria-hidden />
          )}
        </li>
      ))}
    </ul>
  )
}

export default function DataTable({ columns, table, loading, onRowClick, selectable = false, empty, rowClassName, getRowLabel, skeletonRows = 8, footer, mobileCard, mobileFooter }) {
  if (loading) return <TableSkeleton rows={skeletonRows} cols={Math.min(columns.length, 7)} />
  const rows = table.pageRows
  const actionsCol = columns.find((c) => c.key === 'actions')
  return (
    <>
      {mobileCard && rows.length > 0 && (
        <>
          <MobileSortBar columns={columns} table={table} />
          <MobileCards rows={rows} card={mobileCard} actionsCol={actionsCol} onRowClick={onRowClick} getRowLabel={getRowLabel} rowClassName={rowClassName} />
          {mobileFooter && <div className="border-t border-line bg-slate-50/80 px-4 py-3 md:hidden">{mobileFooter}</div>}
        </>
      )}
      <div className={`scroll-thin overflow-x-auto ${mobileCard ? 'hidden md:block' : ''}`}>
        <table className="table-base">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10">
                  <input type="checkbox" className="h-4 w-4 cursor-pointer accent-brand" checked={table.allOnPageSelected} onChange={table.togglePage} aria-label="Select all rows on this page" />
                </th>
              )}
              {columns.map((col) => {
                const sorted = table.sort?.key === col.key ? table.sort.dir : null
                const align = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                return (
                  <th key={col.key} className={`${align} ${col.hideBelow ? HIDE[col.hideBelow] : ''}`} aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {col.sortable ? (
                      <button type="button" onClick={() => table.toggleSort(col.key)} className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {col.header}
                        {sorted === 'asc' ? <ArrowUp size={12} /> : sorted === 'desc' ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-50" />}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && e.target === e.currentTarget && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && getRowLabel ? getRowLabel(row) : undefined}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${table.selected?.has(row.id) ? 'bg-sky-soft/50' : ''} ${rowClassName?.(row) ?? ''}`}
              >
                {selectable && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="h-4 w-4 cursor-pointer accent-brand" checked={table.selected.has(row.id)} onChange={() => table.toggleRow(row.id)} aria-label={`Select ${row.id}`} />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={`${col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : ''} ${col.hideBelow ? HIDE[col.hideBelow] : ''} ${col.className ?? ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer}
        </table>
      </div>
      {!rows.length && (empty ?? <EmptyState title="No records found" description="Try adjusting your search or filters." compact />)}
      <Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} />
    </>
  )
}
