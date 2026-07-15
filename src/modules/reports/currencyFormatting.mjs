const ISO_CURRENCY_CODE = /^[A-Z]{3}$/

export function formatMetric(value, unit, currencyCode = null) {
  if (value === null) return '—'
  if (unit === 'currency') {
    if (!currencyCode || !ISO_CURRENCY_CODE.test(currencyCode)) return '请选择币种'
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
  }
  if (unit === 'percentage') return `${value.toFixed(1)}%`
  if (unit === 'days') return `${value.toFixed(1)} 天`
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value)
}
