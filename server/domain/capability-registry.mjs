const capability = (id, maturity, readReady, writeReady, reason, options = {}) => ({
  id,
  enabled: options.requiresExplicitEnable ? false : maturity === 'stable' || maturity === 'beta',
  maturity,
  readReady,
  writeReady,
  reason,
  ...options,
})

export const capabilityRegistry = [
  capability('overview', 'stable', true, false, 'Authoritative runtime overview'),
  capability('master-data', 'stable', true, true, 'Runtime item, supplier, and customer masters'),
  capability('procurement', 'stable', true, true, 'Canonical PR and draft PO workflow'),
  capability('sales', 'stable', true, true, 'Durable sales order runtime'),
  capability('inventory', 'stable', true, true, 'Durable inventory balances and movements'),
  capability('inventory-balance-adjustment', 'stable', true, true, 'Existing authoritative inventory adjustment behavior'),
  capability('receiving-posting', 'beta', false, true, 'Database-only transactional receiving posting', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING' }),
  capability('receiving-reversal', 'beta', false, true, 'Database-only transactional receiving reversal', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING' }),
  capability('sales-order-lifecycle', 'beta', true, true, 'Database-only authoritative sales order lifecycle', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING' }),
  capability('sales-reservation', 'beta', true, true, 'Database-only sales inventory reservation', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING' }),
  capability('sales-shipment-draft', 'beta', true, true, 'Database-only sales shipment allocation', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING' }),
  capability('sales-shipment-posting', 'beta', true, true, 'Database-only sales shipment posting', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING' }),
  capability('sales-shipment-reversal', 'beta', true, true, 'Database-only sales shipment reversal', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING' }),
  capability('stock-transfer', 'beta', true, true, 'Database-only authoritative stock transfer operations', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS' }),
  capability('cycle-count', 'beta', true, true, 'Database-only authoritative cycle count operations', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS' }),
  capability('inventory-adjustment-document', 'beta', true, true, 'Database-only governed inventory adjustment documents', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS' }),
  capability('quarantine-inventory', 'beta', true, false, 'Database-only quarantine inventory read foundation', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE' }),
  capability('return-request', 'beta', true, true, 'Database-only governed return request lifecycle', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE' }),
  capability('return-authorization', 'beta', true, true, 'Database-only governed return authorization lifecycle', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE' }),
  capability('return-posting', 'beta', true, true, 'Database-only supplier return posting and reversal; later return transaction types remain gated', { databaseOnly: true, requiresExplicitEnable: true, environmentFlag: 'FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE' }),
  capability('finance', 'unavailable', false, false, 'Receipt, invoice, and settlement runtime is not fully connected'),
  capability('reports', 'stable', true, false, 'Authoritative runtime analytics'),
  capability('settings', 'beta', true, true, 'Local/UAT workspace settings'),
  capability('imports', 'beta', true, true, 'Supplier, item, customer, and inventory imports are connected'),
  capability('forecast', 'preview', true, false, 'Planning workflow remains experimental'),
  capability('exception-cases', 'preview', true, false, 'Internal exception workflow preview'),
  capability('collaboration-drafts', 'preview', true, false, 'Internal draft-only workflow'),
  capability('review-actions', 'preview', true, false, 'Human review workflow preview'),
  capability('audit-history', 'preview', true, false, 'Internal audit exploration'),
  capability('pilot-readiness', 'preview', true, false, 'Internal readiness assessment'),
]

export const capabilityFor = id => capabilityRegistry.find(entry => entry.id === id)

export function capabilityForEnvironment(id, env = process.env) {
  const entry = capabilityFor(id)
  if (!entry) return undefined
  if (!entry.requiresExplicitEnable) return { ...entry }
  const explicit = String(env[entry.environmentFlag] || '').trim().toLowerCase() === 'true'
  const databaseMode = String(env.FLOWCHAIN_PERSISTENCE_MODE || '').trim().toLowerCase() === 'database'
  return { ...entry, enabled: entry.maturity !== 'unavailable' && explicit && (!entry.databaseOnly || databaseMode) }
}

export function capabilityRegistryForEnvironment(env = process.env) {
  return capabilityRegistry.map((entry) => capabilityForEnvironment(entry.id, env))
}
