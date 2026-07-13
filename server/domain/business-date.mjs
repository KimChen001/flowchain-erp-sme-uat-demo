const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseIsoBusinessDate(value) {
  const match = String(value ?? '').trim().match(ISO_DATE)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const milliseconds = Date.UTC(year, month - 1, day)
  const date = new Date(milliseconds)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export function overdueDays(value, asOf = new Date()) {
  const due = parseIsoBusinessDate(value)
  if (!due || Number.isNaN(asOf?.getTime?.())) return null
  const today = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate())
  return Math.max(0, Math.floor((today - due.getTime()) / 86_400_000))
}

export function dueDateLabel(value, asOf = new Date()) {
  const days = overdueDays(value, asOf)
  if (days === null) return '待确认'
  return days > 0 ? `逾期 ${days} 天` : String(value)
}
