import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import Pagination from './Pagination'
import { TableSkeleton } from './Skeleton'
import EmptyState from './EmptyState'

/**
 * Generic table used by every list in the app.
 *
 * columns: [{ key, header, render?(row), sortable?, align?: 'right'|'center', className?, hideBelow?: 'sm'|'md'|'lg' }]
 * table:   the object returned by useTable() (sorting, pagination, selection)
 */
const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' }

export default function DataTable({ columns, table, loading, onRowClick, selectable = false, empty, rowClassName, getRowLabel, skeletonRows = 8, footer }) {
  if (loading) return <TableSkeleton rows={skeletonRows} cols={Math.min(columns.length, 7)} />
  const rows = table.pageRows
  return (
    <>
      <div className="scroll-thin overflow-x-auto">
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
