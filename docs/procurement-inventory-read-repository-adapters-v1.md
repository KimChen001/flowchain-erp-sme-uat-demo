# Procurement and Inventory Read Repository Adapters v1

Round 20 prepares Procurement and Inventory read domains for future database-backed adapters while keeping JSON/demo data as the default runtime.

## ProcurementReadRepository

Current implementation: `server/repositories/json-procurement-read-repository.mjs`.

Methods:

- `listDocuments(filters)`
- `getDocument(type, id)`
- `listLinks(filters)`
- `listFollowups(filters)`
- `getSummary()`
- `normalizeDocumentType(type)`
- `isDocumentType(type)`

The adapter delegates to the existing procurement read model and preserves canonical document types for PR, RFQ, PO, GRN, invoice, and three-way match records.

## InventoryReadRepository

Current implementation: `server/repositories/json-inventory-read-repository.mjs`.

Methods:

- `listItems(filters)`
- `getItem(idOrSku)`
- `listLots(filters)`
- `listSerials(filters)`
- `listMovements(filters)`
- `listExceptions(filters)`
- `getSummary()`

Compatibility aliases `listInventoryItems` and `getInventoryItem` are included for future route migration.

## Adapter registry

The default JSON registry now uses the concrete Procurement and Inventory read repository wrappers. Database mode remains a placeholder and is not selected by default.

## Route wiring

The read routes now prefer injected repositories and fall back to JSON repositories:

- `server/routes/procurement-read.routes.mjs`
- `server/routes/inventory.routes.mjs`

Public response shapes and error payloads are preserved.

## Today Cockpit and AI compatibility

Today Cockpit and deterministic AI evidence reuse still use the existing read models directly. This round keeps those paths stable and tests compatibility so future wiring can be incremental.

## Non-goals

- No database connection.
- No ORM package.
- No procurement write APIs.
- No inventory mutation or posting behavior.
- No receiving posting changes.
- No PR/RFQ/PO creation.
- No public API response shape change.
- No external AI enablement.
