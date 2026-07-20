const definitions = [
  ["settings.workspace.read", "settings", "workspace", "read", "medium"],
  ["settings.workspace.manage", "settings", "workspace", "manage", "high"],
  ["settings.users.read", "settings", "users", "read", "medium"],
  ["settings.users.manage", "settings", "users", "manage", "high"],
  ["settings.roles.read", "settings", "roles", "read", "medium"],
  ["settings.roles.manage", "settings", "roles", "manage", "critical"],
  ["settings.roles.assign", "settings", "roles", "assign", "critical"],
  ["settings.numbering.read", "settings", "numbering", "read", "low"],
  ["settings.numbering.manage", "settings", "numbering", "manage", "high"],
  ["settings.review_policy.read", "settings", "review_policy", "read", "low"],
  ["settings.review_policy.manage", "settings", "review_policy", "manage", "high"],
  ["settings.modules.read", "settings", "modules", "read", "low"],
  ["settings.modules.manage", "settings", "modules", "manage", "high"],
  ["settings.import.manage", "settings", "import", "manage", "high"],
  ["settings.warehouse_import.manage", "settings", "warehouse_import", "manage", "critical"],
  ["settings.diagnostics.read", "settings", "diagnostics", "read", "high"],
  ["settings.export.read", "settings", "export", "read", "high"],
  ["audit.read", "audit", "audit_log", "read", "medium"],
  ["audit.read_sensitive", "audit", "audit_log", "read_sensitive", "high", ["audit_sensitive_metadata"]],
  ["returns.request.read", "returns", "request", "read", "low"],
  ["returns.request.create", "returns", "request", "create", "medium"],
  ["returns.request.revise", "returns", "request", "revise", "medium"],
  ["returns.request.submit", "returns", "request", "submit", "high"],
  ["returns.request.cancel", "returns", "request", "cancel", "high"],
  ["returns.customer_request.manage", "returns", "customer_request", "manage", "high"],
  ["returns.authorization.read", "returns", "authorization", "read", "low"],
  ["returns.authorization.approve", "returns", "authorization", "approve", "critical"],
  ["returns.authorization.reject", "returns", "authorization", "reject", "high"],
  ["returns.authorization.cancel", "returns", "authorization", "cancel", "high"],
  ["returns.authorization.expire", "returns", "authorization", "expire", "high"],
  ["returns.posting.read", "returns", "posting", "read", "low"],
  ["returns.posting.prepare", "returns", "posting", "prepare", "medium"],
  ["returns.posting.ready", "returns", "posting", "ready", "high"],
  ["returns.posting.post", "returns", "posting", "post", "critical"],
  ["returns.posting.cancel", "returns", "posting", "cancel", "high"],
  ["returns.posting.reverse", "returns", "posting", "reverse", "critical"],
  ["returns.quarantine.read", "returns", "quarantine", "read", "low"],
  ["returns.quarantine.release_prepare", "returns", "quarantine", "release_prepare", "medium"],
  ["returns.quarantine.release_post", "returns", "quarantine", "release_post", "critical"],
  ["returns.quarantine.release_reverse", "returns", "quarantine", "release_reverse", "critical"],
  ["receiving.read", "receiving", "receiving", "read", "low"],
  ["receiving.prepare", "receiving", "receiving", "prepare", "medium"],
  ["receiving.post", "receiving", "receiving", "post", "critical"],
  ["receiving.reverse", "receiving", "receiving", "reverse", "critical"],
  ["sales_order.read", "sales", "sales_order", "read", "low"],
  ["sales_order.create", "sales", "sales_order", "create", "medium"],
  ["sales_order.revise", "sales", "sales_order", "revise", "medium"],
  ["sales_order.submit", "sales", "sales_order", "submit", "high"],
  ["sales_order.cancel", "sales", "sales_order", "cancel", "high"],
  ["shipment.read", "sales", "shipment", "read", "low"],
  ["shipment.prepare", "sales", "shipment", "prepare", "medium"],
  ["shipment.post", "sales", "shipment", "post", "critical"],
  ["shipment.reverse", "sales", "shipment", "reverse", "critical"],
  ["inventory.balance.read", "inventory", "balance", "read", "low"],
  ["inventory.transfer.read", "inventory", "transfer", "read", "low"],
  ["inventory.transfer.create", "inventory", "transfer", "create", "medium"],
  ["inventory.transfer.post", "inventory", "transfer", "post", "critical"],
  ["inventory.transfer.reverse", "inventory", "transfer", "reverse", "critical"],
  ["inventory.count.read", "inventory", "count", "read", "low"],
  ["inventory.count.create", "inventory", "count", "create", "medium"],
  ["inventory.count.submit", "inventory", "count", "submit", "high"],
  ["inventory.count.review", "inventory", "count", "review", "high"],
  ["inventory.count.post", "inventory", "count", "post", "critical"],
  ["inventory.count.reverse", "inventory", "count", "reverse", "critical"],
  ["inventory.adjustment.read", "inventory", "adjustment", "read", "low"],
  ["inventory.adjustment.create", "inventory", "adjustment", "create", "medium"],
  ["inventory.adjustment.approve", "inventory", "adjustment", "approve", "critical"],
  ["inventory.adjustment.post", "inventory", "adjustment", "post", "critical"],
  ["inventory.adjustment.reverse", "inventory", "adjustment", "reverse", "critical"],
  ["finance.overview.read", "finance", "overview", "read", "low"],
  ["finance.amounts.read", "finance", "amounts", "read", "high", ["finance_amounts"]],
  ["finance.partner_snapshot.read", "finance", "partner_snapshot", "read", "high", ["finance_partner_snapshot"]],
  ["procurement.prices.read", "procurement", "prices", "read", "high", ["procurement_prices"]],
  ["finance.supplier_invoice.read", "finance", "supplier_invoice", "read", "low"],
  ["finance.supplier_invoice.create", "finance", "supplier_invoice", "create", "medium"],
  ["finance.supplier_invoice.revise", "finance", "supplier_invoice", "revise", "medium"],
  ["finance.supplier_invoice.submit", "finance", "supplier_invoice", "submit", "high"],
  ["finance.supplier_invoice.approve", "finance", "supplier_invoice", "approve", "critical"],
  ["finance.three_way_match.read", "finance", "three_way_match", "read", "low"],
  ["finance.three_way_match.execute", "finance", "three_way_match", "execute", "high"],
  ["finance.match_exception.review", "finance", "match_exception", "review", "high"],
  ["finance.payable.read", "finance", "payable", "read", "low"],
  ["finance.payable.hold", "finance", "payable", "hold", "high"],
  ["finance.payable.release", "finance", "payable", "release", "high"],
  ["finance.payable.mark_export_ready", "finance", "payable", "mark_export_ready", "critical"],
  ["finance.supplier_credit.read", "finance", "supplier_credit", "read", "low"],
  ["finance.supplier_credit.create", "finance", "supplier_credit", "create", "medium"],
  ["finance.supplier_credit.approve", "finance", "supplier_credit", "approve", "critical"],
  ["finance.customer_invoice.read", "finance", "customer_invoice", "read", "low"],
  ["finance.customer_invoice.create", "finance", "customer_invoice", "create", "medium"],
  ["finance.customer_invoice.submit", "finance", "customer_invoice", "submit", "high"],
  ["finance.customer_invoice.approve", "finance", "customer_invoice", "approve", "critical"],
  ["finance.customer_invoice.issue", "finance", "customer_invoice", "issue", "critical"],
  ["finance.receivable.read", "finance", "receivable", "read", "low"],
  ["finance.receivable.dispute", "finance", "receivable", "dispute", "high"],
  ["finance.receivable.resolve_dispute", "finance", "receivable", "resolve_dispute", "high"],
  ["finance.receivable.record_external_reference", "finance", "receivable", "record_external_reference", "high"],
  ["finance.customer_credit.read", "finance", "customer_credit", "read", "low"],
  ["finance.customer_credit.create", "finance", "customer_credit", "create", "medium"],
  ["finance.customer_credit.approve", "finance", "customer_credit", "approve", "critical"],
  ["finance.cashbook.read", "finance", "cashbook", "read", "low"],
  ["finance.cashbook.manage", "finance", "cashbook", "manage", "critical"],
  ["finance.settlement.read", "finance", "settlement", "read", "low"],
  ["finance.settlement.create", "finance", "settlement", "create", "high"],
  ["finance.settlement.post", "finance", "settlement", "post", "critical"],
  ["finance.settlement.reverse", "finance", "settlement", "reverse", "critical"],
  ["finance.settlement.reconciliation.read", "finance", "settlement_reconciliation", "read", "high"],
]

export const permissionCatalog = Object.freeze(definitions.map(([code, module, resource, action, riskLevel, fieldVisibility = []]) => Object.freeze({
  code,
  module,
  resource,
  action,
  labelKey: `permissions.${code}.label`,
  descriptionKey: `permissions.${code}.description`,
  riskLevel,
  fieldVisibility: Object.freeze(fieldVisibility),
  deprecated: false,
  replacementCode: null,
})))

export const permissionCodes = Object.freeze(permissionCatalog.map(({ code }) => code))
export const permissionCodeSet = new Set(permissionCodes)
export const permissionByCode = new Map(permissionCatalog.map((permission) => [permission.code, permission]))

export const FIELD_GROUP_PERMISSION = Object.freeze({
  finance_amounts: "finance.amounts.read",
  finance_partner_snapshot: "finance.partner_snapshot.read",
  procurement_prices: "procurement.prices.read",
  audit_sensitive_metadata: "audit.read_sensitive",
})

export function assertKnownPermissionCode(code) {
  if (!permissionCodeSet.has(String(code || ""))) {
    const error = new Error("Permission code is not defined by the system catalog.")
    error.code = "AUTHORIZATION_UNKNOWN_PERMISSION_CODE"
    error.status = 422
    throw error
  }
  return String(code)
}

const reads = permissionCatalog.filter(({ action }) => action === "read" || action === "read_sensitive").map(({ code }) => code)
const byPrefix = (...prefixes) => permissionCodes.filter((code) => prefixes.some((prefix) => code.startsWith(prefix)))
const without = (items, denied) => items.filter((code) => !denied.includes(code))

export const defaultRoleTemplates = Object.freeze([
  { roleKey: "workspace-administrator", name: "Workspace Administrator", permissions: [...permissionCodes] },
  { roleKey: "operations-manager", name: "Operations Manager", permissions: without([...byPrefix("returns.", "receiving.", "sales_order.", "shipment.", "inventory.", "finance."), "settings.workspace.read", "settings.users.read", "settings.roles.read", "settings.numbering.read", "settings.review_policy.read", "settings.modules.read", "settings.import.manage", "settings.export.read", "audit.read"], ["procurement.prices.read", "finance.partner_snapshot.read", "finance.amounts.read", "audit.read_sensitive"]) },
  { roleKey: "operations-specialist", name: "Operations Specialist", permissions: without([...byPrefix("returns.", "receiving.", "sales_order.", "shipment.", "inventory."), "finance.overview.read", "finance.supplier_invoice.read", "finance.supplier_invoice.create", "finance.supplier_invoice.revise", "finance.supplier_invoice.submit", "finance.three_way_match.read", "finance.three_way_match.execute", "finance.payable.read", "finance.supplier_credit.read", "finance.supplier_credit.create", "finance.customer_invoice.read", "finance.customer_invoice.create", "finance.customer_invoice.submit", "finance.receivable.read", "finance.receivable.dispute", "finance.receivable.resolve_dispute", "finance.receivable.record_external_reference", "finance.customer_credit.read", "finance.customer_credit.create"], ["returns.authorization.approve", "returns.authorization.reject", "returns.authorization.cancel", "returns.authorization.expire", "returns.posting.reverse", "returns.quarantine.release_reverse", "receiving.reverse", "shipment.reverse", "inventory.transfer.reverse", "inventory.count.review", "inventory.count.post", "inventory.count.reverse", "inventory.adjustment.post", "inventory.adjustment.reverse"]) },
  { roleKey: "procurement-specialist", name: "Procurement Specialist", permissions: ["returns.request.read", "returns.request.create", "returns.request.revise", "returns.request.submit", "returns.request.cancel", "returns.authorization.read", "returns.posting.read", "returns.quarantine.read", "receiving.read", "inventory.balance.read", "procurement.prices.read"] },
  { roleKey: "finance-specialist", name: "Finance Specialist", permissions: [...byPrefix("finance."), "audit.read"] },
  { roleKey: "read-only-viewer", name: "Read-only Viewer", permissions: reads.filter((code) => !["audit.read_sensitive", "finance.amounts.read", "finance.partner_snapshot.read", "procurement.prices.read", "settings.diagnostics.read", "settings.export.read"].includes(code)) },
])

export const legacyRoleTemplateMap = Object.freeze({
  admin: "workspace-administrator",
  manager: "operations-manager",
  "business-specialist": "operations-specialist",
  business_specialist: "operations-specialist",
  buyer: "procurement-specialist",
  "finance-specialist": "finance-specialist",
  finance_specialist: "finance-specialist",
  viewer: "read-only-viewer",
})

export const moduleReadPermissions = Object.freeze({
  settings: permissionCodes.filter((code) => code.startsWith("settings.") && (code.endsWith(".read") || code.endsWith(".manage"))),
  procurement: ["receiving.read", "returns.request.read", "procurement.prices.read"],
  "returns-quarantine": ["returns.request.read", "returns.authorization.read", "returns.posting.read", "returns.quarantine.read"],
  receiving: ["receiving.read"],
  sales: ["sales_order.read", "shipment.read"],
  inventory: ["inventory.balance.read", "inventory.transfer.read", "inventory.count.read", "inventory.adjustment.read"],
  finance: permissionCodes.filter((code) => code.startsWith("finance.") && code.endsWith(".read")),
  "audit-history": ["audit.read"],
})
