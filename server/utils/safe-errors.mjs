export const GENERIC_INTERNAL_ERROR = 'Internal server error'
export const SAFE_OPERATIONAL_ERROR_CODES = new Set([
  'FLOWCHAIN_DATABASE_CONFIG_MISSING',
])

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sk-[A-Za-z0-9._-]+/gi,
  /(OPENAI_API_KEY|ARK_API_KEY|DOUBAO_API_KEY|DATABASE_URL)\s*[:=]\s*[^,\s;]+/gi,
  /postgres(?:ql)?:\/\/[^,\s;]+/gi,
  /mysql:\/\/[^,\s;]+/gi,
]

export function sanitizeErrorSummary(error) {
  const code = String(error?.code || error?.name || 'Error')
  const message = String(error?.message || error || '')
  const sanitized = SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '[redacted]'),
    message
  )
  return `${code}: ${sanitized}`.slice(0, 240)
}

export function sendInternalServerError(res, send, error, options = {}) {
  const logger = options.logger || console
  if (typeof logger.warn === 'function') {
    logger.warn(`[server-error] ${sanitizeErrorSummary(error)}`)
  }
  if (SAFE_OPERATIONAL_ERROR_CODES.has(error?.code)) {
    return send(res, error.status || 500, {
      error: error.message,
      code: error.code,
    })
  }
  return send(res, 500, { error: GENERIC_INTERNAL_ERROR })
}
