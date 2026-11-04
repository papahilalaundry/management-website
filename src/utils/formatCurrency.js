const CURRENCY = 'KES'

/** KES 1,500.00 */
export function formatCurrency(value, { decimals = 2, currency = CURRENCY } = {}) {
  const n = Number(value) || 0
  const sign = n < 0 ? '-' : ''
  return `${sign}${currency} ${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/** KES 12.5K — for chart axes and compact cards */
export function formatCompactCurrency(value, currency = CURRENCY) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000) return `${currency} ${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return `${currency} ${Math.round(n)}`
}

export function formatNumber(value, decimals = 0) {
  return (Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value, decimals = 1) {
  const n = Number(value) || 0
  return `${n.toFixed(decimals).replace(/\.0$/, '')}%`
}

/** Round to cents to avoid floating point drift in money math */
export const roundMoney = (n) => Math.round((Number(n) || 0) * 100) / 100
