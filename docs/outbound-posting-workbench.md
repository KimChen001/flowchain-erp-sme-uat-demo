# Outbound Posting Workbench

## 1. Scope

Phase 3.6 freezes the PostgreSQL flow Sales Order Draft → Confirm → Hold/Resume → Reserve/Release → Shipment Draft/Cancel → Post → Reverse. It closes capability, warehouse projection, navigation, explicit-selection, lifecycle idempotency, and order-list acceptance gaps without changing inventory mathematics.

## 2. Phase 3 stabilization changes

All six previews enforce signed-actor warehouse read scope and tenant warehouse ownership. Policies revalidate tenant Item/SKU/status and InventoryBalance item/SKU identity. Reversal fails closed unless the original posting movement matches shipment allocation facts. Duplicate shipment numbers map to `SHIPMENT_NUMBER_CONFLICT`. New reservation events link to `BusinessCommandExecution`; movements use the Sales Order Line item name. CI and package engines use Node 24.

## 3. Sales Order lifecycle

The lifecycle service supports idempotent draft create, whole-draft revision, confirm, hold, and resume in SERIALIZABLE transactions. Item snapshots come from active tenant Items. Confirmed lines are immutable in this phase. Every command writes a command execution and audit record. An order on hold rejects new reservation, shipment draft, and shipment posting with `SALES_ORDER_ON_HOLD`; resume restores posting eligibility. Cancelling an unposted shipment and reversing a posted shipment remain correction paths while held.

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

Users explicitly select an order line, an operable warehouse/location balance, and quantity, request the authoritative preview, review before/after facts, then confirm. A client idempotency key is created once per intent and retained through retry. The page refreshes the workbench after success.

## 8. Release UX

Users explicitly select a reservation. Only allocatable quantity is offered. A reason, reservation version, preview, confirmation, and idempotency key are mandatory. Allocated quantity is never presented as releasable.

## 9. Shipment Draft UX

The order workbench explicitly selects one order line and one existing reservation allocation after a duplicate-number-aware preview. Drafting changes allocation only: it does not change InventoryBalance and creates no InventoryMovement.

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

Every link has an ID, route/type/target ID, filters, enabled state, and unavailable reason. A single visible shipment targets its shipment ID; multiple shipments target the order `shipments` section. Reservation links target `reservations`. Balance links use `sku`, `warehouseId`, and `locationKey` only for one unambiguous target. Movement links preserve `relatedSalesOrderId` and available source/batch keys. Ambiguous or unsupported targets are disabled.

## 16. Reconciliation

Full-scope read models verify `available = onHand - reserved`, line non-negativity and ordered ceiling, reservation consumption/release/allocation ceilings, and shipment posted quantity against effective posting minus reversal movements. When warehouse facts are hidden, `scopeCoverage.status` is `partial`, `PARTIAL_WAREHOUSE_SCOPE` is returned, and reconciliation is `unavailable` rather than claiming a full-order match.

## 17. AI Explain

AI Explain is a deterministic, read-only evidence explanation with conclusion, evidence, business impact, suggested action, links, limitations, and uncertainty. It cannot Reserve, Post, Reverse, bypass Preview, or invent causes.

## 18. Idempotency UX

One key represents one visible create, revise, confirm, hold, resume, reserve, release, shipment, post, cancel, or reverse intent. Loading disables the action. A replay is treated as the original success; changed payload creates a new client intent, while server reuse with a different payload is rejected.

## 19. Error handling

Routes return only stable `code`, `message`, and optional `details`. 404 masks unauthorized objects, 403 explains mutation authorization, 409 triggers authoritative refresh while retaining a business conflict message, and 422 requests input correction. Prisma codes, SQLSTATE, SQL, and stacks are never returned.

## 20. Warehouse Scope

Admin can access tenant warehouses only. A shipment is visible only when every allocation warehouse is readable. Reservation events, shipment audits, movements, reconciliation facts, and Smart Link counts use the same projection; direct access to an out-of-scope shipment returns 404. Viewer with read scope can inspect availability and preview but cannot mutate.

## 21. API contracts

Lifecycle APIs are `GET/POST /api/sales/orders`, `PATCH /api/sales/orders/:id`, and transition POSTs. Workbench/evidence/links/reconciliation reads exist under orders and shipments. Existing Phase 3 reserve/release/draft/cancel/post/reverse preview and command APIs remain authoritative.

## 22. Browser verification

`npm run test:browser:outbound` starts an isolated PostgreSQL database, applies all migrations, starts the real Node server with signed sessions, and runs the formal UI without mocking authoritative APIs. It covers the full transaction loop, double submit, persistence refresh, permissions, and stale state.

## 23. Local setup

Use Node 24, run `npm ci`, set database mode and a PostgreSQL `DATABASE_URL`, deploy migrations, provision tenant/user/warehouse scope, configure a 32+ character session secret, and enable outbound posting. Run `npm run db:generate`, `npm run test:db:outbound`, `npm run test:api:outbound`, and `npm run test:browser:outbound`.

## 24. Capability flags

`FLOWCHAIN_PERSISTENCE_MODE=database` and `FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING=true` enable the beta `sales-order-lifecycle` capability together with reservation, shipment draft, posting, and reversal. Database reads remain available when disabled, but every action is false and mutations return `OUTBOUND_CAPABILITY_NOT_AVAILABLE`. File mode never falls back to JSON for authoritative workbenches.

## 25. Known limitations

New Sales Order UI currently creates one line. Shipment Draft UI currently creates one explicitly selected line and one explicitly selected Reservation Allocation per action; the API supports multiple lines and allocations. The workbench no longer silently uses the first eligible record. There is no FX conversion, costing/COGS, picking, lot/serial allocation, negative inventory, sales-order cancel, customer master overhaul, or automated AI transaction execution.

## 26. Order list

The authoritative list supports URL-persisted search, workflow/reservation/fulfillment status, currency, pagination, and stable sorting by updated time, promised date, or order number. Previous/next navigation retains query state, and an empty filtered result is not reported as a system error.

## 27. Phase 4 boundary

Phase 4 may introduce controlled picking and richer multi-line entry only after preserving the transaction kernel, warehouse authorization, evidence, reconciliation, idempotency, and browser gates documented here.
