const capability = (id, maturity, readReady, writeReady, reason) => ({
  id, enabled: maturity === 'stable' || maturity === 'beta', maturity, readReady, writeReady, reason,
})

export const capabilityRegistry = [
  capability('overview', 'stable', true, false, 'Authoritative runtime overview'),
  capability('master-data', 'stable', true, true, 'Runtime item, supplier, and customer masters'),
  capability('procurement', 'stable', true, true, 'Canonical PR and draft PO workflow'),
  capability('sales', 'stable', true, true, 'Durable sales order runtime'),
  capability('inventory', 'stable', true, true, 'Durable inventory balances and movements'),
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
