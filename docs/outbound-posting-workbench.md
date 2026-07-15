# Outbound Posting Workbench

## 1. Scope

Phase 3.5 productizes the PostgreSQL flow Sales Order Draft → Confirm → Reserve/Release → Shipment Draft/Cancel → Post → Reverse. It excludes picking, lots/serials, carriers, invoicing, costing, returns, negative inventory, and automatic warehouse optimization.

## 2. Phase 3 stabilization changes

All six previews enforce signed-actor warehouse read scope and tenant warehouse ownership. Policies revalidate tenant Item/SKU/status and InventoryBalance item/SKU identity. Reversal fails closed unless the original posting movement matches shipment allocation facts. Duplicate shipment numbers map to `SHIPMENT_NUMBER_CONFLICT`. New reservation events link to `BusinessCommandExecution`; movements use the Sales Order Line item name. CI and package engines use Node 24.

## 3. Sales Order lifecycle

The lifecycle service supports idempotent draft create, whole-draft revision, confirm, hold, and resume in SERIALIZABLE transactions. Item snapshots come from active tenant Items. Confirmed lines are immutable in this phase. Every command writes a command execution and audit record.

## 4. Workbench routes

- `/app/sales/orders`
- `/app/sales/orders/new`
- `/app/sales/orders/:id`
- `/app/sales/shipments/:id`

All surfaces display `Authoritative PostgreSQL`; the legacy JSON Sales Demand model is not used by these routes.

## 5. Available Actions

The server returns order `canEditDraft`, `canConfirm`, `canHold`, `canResume`, `canReserve`, `canRelease`, `canCreateShipment`, `blockingReasonCodes`, and `primaryAction`. Shipment reads return `canCancel`, `canPost`, and `canReverse`. Role, workflow, quantities, capability, and read/operate warehouse scope determine the result; the browser does not recreate the state machine.

## 6. Availability model

Availability is grouped by order line, then warehouse/location. Totals and rows are fixed four-decimal strings. Read scope controls visibility; operate scope controls selection. Unauthorized warehouses and balance IDs are not returned.

## 7. Reservation UX

Users select an operable balance and quantity, request the authoritative preview, review before/after facts, then confirm. A client idempotency key is created once per intent and retained through retry. The page refreshes the workbench after success.

## 8. Release UX

Only allocatable quantity is offered. A reason, reservation version, preview, confirmation, and idempotency key are mandatory. Allocated quantity is never presented as releasable.

## 9. Shipment Draft UX

The order workbench allocates an existing reservation after a duplicate-number-aware preview. Drafting changes allocation only: it does not change InventoryBalance and creates no InventoryMovement.

## 10. Cancellation UX

Unposted draft/ready shipments can be cancelled with reason and preview. Deallocation restores allocatable reservation quantity; balance and movements remain unchanged.

## 11. Posting Preview

The server preview shows InventoryBalance, reservation, order line, shipment status, and facts to create. Available does not fall again at posting because on-hand and reserved decrease together.

## 12. Posting UX

Posting requires a confirmation dialog, expected shipment version, stable intent key, disabled loading state, and authoritative refresh. Double submission reuses one key and creates one posting movement.

## 13. Reversal UX

Only posted, in-scope shipments can be reversed. Reason and preview are required. Movement-integrity mismatches return `SHIPMENT_REVERSAL_NOT_SAFE`; no force-bypass action exists. Original and reversal movements remain visible.

## 14. Evidence

The timeline combines lifecycle/shipment audit records, reservation events, and authorized inventory movements. Events expose actor, entity, command type, command execution, idempotency key, links, time, and limitations where available.

## 15. Smart Links

Order links use supported filters: reservation/shipment `salesOrderId`, balance natural keys (`sku`, `warehouseId`, `locationKey`), movement `relatedSalesOrderId`, and audit entity identity. Disabled links state an availability reason.

## 16. Reconciliation

Read models verify `available = onHand - reserved`, line non-negativity and ordered ceiling, reservation consumption/release/allocation ceilings, and shipment posted quantity against effective posting minus reversal movements. Results are `matched`, `mismatch`, or `unavailable`, with calculated, recorded, difference, entity, and evidence links.

## 17. AI Explain

AI Explain is a deterministic, read-only evidence explanation with conclusion, evidence, business impact, suggested action, links, limitations, and uncertainty. It cannot Reserve, Post, Reverse, bypass Preview, or invent causes.

## 18. Idempotency UX

One key represents one visible confirmation intent. Loading disables the action. A replay is treated as the original success; changed payload with the same key is rejected. A new key is created only when the user begins a new intent.

## 19. Error handling

Routes return only stable `code`, `message`, and optional `details`. 404 masks unauthorized objects, 403 explains mutation authorization, 409 triggers authoritative refresh while retaining a business conflict message, and 422 requests input correction. Prisma codes, SQLSTATE, SQL, and stacks are never returned.

## 20. Warehouse Scope

Admin can access tenant warehouses only. Viewer with read scope can inspect availability and preview but cannot mutate. Manager with read-only or missing scope cannot mutate; missing preview scope returns 404. Body, query, and headers cannot forge scope.

## 21. API contracts

Lifecycle APIs are `GET/POST /api/sales/orders`, `PATCH /api/sales/orders/:id`, and transition POSTs. Workbench/evidence/links/reconciliation reads exist under orders and shipments. Existing Phase 3 reserve/release/draft/cancel/post/reverse preview and command APIs remain authoritative.

## 22. Browser verification

`npm run test:browser:outbound` starts an isolated PostgreSQL database, applies all migrations, starts the real Node server with signed sessions, and runs the formal UI without mocking authoritative APIs. It covers the full transaction loop, double submit, persistence refresh, permissions, and stale state.

## 23. Local setup

Use Node 24, run `npm ci`, set database mode and a PostgreSQL `DATABASE_URL`, deploy migrations, provision tenant/user/warehouse scope, configure a 32+ character session secret, and enable outbound posting. Run `npm run db:generate`, `npm run test:db:outbound`, `npm run test:api:outbound`, and `npm run test:browser:outbound`.

## 24. Capability flags

`FLOWCHAIN_PERSISTENCE_MODE=database` and `FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING=true` enable the kernel. Capability registry entries continue to distinguish reservation, shipment draft, posting, and reversal. Disabled capability states remain read-only and explicit.

## 25. Known limitations

There is no FX conversion, costing/COGS, picking, lot/serial allocation, negative inventory, sales-order cancel, customer master overhaul, or automated AI transaction execution. Workbench entry currently supports a narrow single-line form while the API supports multiple lines.

## 26. Phase 4 boundary

Phase 4 may introduce controlled picking and richer multi-line entry only after preserving the transaction kernel, warehouse authorization, evidence, reconciliation, idempotency, and browser gates documented here.
