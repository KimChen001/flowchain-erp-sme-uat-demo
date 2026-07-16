# Inventory Operations Foundation

## 1. Scope

Phase 4A establishes three authoritative PostgreSQL inventory operations: Stock Transfer, Cycle Count, and Inventory Adjustment. It does not change Receiving or Outbound inventory mathematics and does not use the Runtime JSON store.

## 2. Phase 3.6.1 prerequisite

Phase 4A started only after the independent Phase 3.6.1 data-safety gate passed and was committed. That prerequisite protects multi-line sales drafts, capability-disabled entry, inventory-link filtering, and warehouse-scoped outbound evidence.

## 3. Capabilities

`stock-transfer`, `cycle-count`, and `inventory-adjustment-document` are beta, database-only, explicitly enabled capabilities. Mutations require both `FLOWCHAIN_PERSISTENCE_MODE=database` and `FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS=true`. The historical `inventory-balance-adjustment` capability remains separate and unchanged. Disabled capabilities keep database reads available with all actions false; mutations return `INVENTORY_OPERATIONS_CAPABILITY_NOT_AVAILABLE`.

## 4. Data model

The additive migration introduces `StockTransferDocument`, `StockTransferLine`, `StockTransferLeg`, `CycleCountSession`, `CycleCountLine`, `InventoryAdjustmentDocument`, and `InventoryAdjustmentLine`. Documents and lines retain versions, workflow/posting state, immutable posting references, reversal facts, actor facts, and tenant ownership. Existing migrations were not edited.

## 5. Inventory mathematics

All authoritative quantities use `Decimal(18,4)` storage, fixed four-decimal API strings, and scaled-integer domain arithmetic. The invariant is `available = onHand - reserved`. JavaScript floating-point values are not used for transaction decisions.

## 6. Stock Transfer lifecycle

A transfer moves through Draft → Ready → Posted or Cancelled. Posted transfers may be Reversed once. Draft, Ready, and Cancel do not change balances.

## 7. Transfer posting

Every line explicitly identifies source and destination balances for the same tenant, item/SKU, and unit, with different natural balance keys. Posting locks all balances in stable order, verifies versions and source availability, decreases source on-hand, increases destination on-hand, and preserves reserved quantities. It creates paired source-out and destination-in movements under one posting batch. Total tenant inventory change is zero.

## 8. Transfer reversal

Reversal preserves original movements and creates linked compensating movements. It restores the source and decreases the destination only when destination on-hand and available remain sufficient and on-hand does not fall below reserved. A second or unsafe reversal is rejected.

## 9. Cycle Count lifecycle

A count session moves through Draft → Submitted → Reviewed → Posted, or may be Cancelled before posting. Selected balances are snapshotted at creation. Posting alone changes inventory.

## 10. Blind Count

Blind sessions hide recorded quantities from the count-entry projection used by Business Specialists. Reviewers receive recorded, counted, and variance facts after submission. Server authorization, not browser hiding, controls the projection and actions.

## 11. Count Snapshot

Each line records on-hand, reserved, available, and balance version. Variance is `countedOnHand - recordedOnHand`. Posting sets current on-hand to counted on-hand, keeps current reserved unchanged, recalculates available, and creates a count-adjustment movement only for non-zero variance.

## 12. Stale Count protection

Posting requires the current balance version, on-hand, and reserved values to match the snapshot. Any intervening movement returns `COUNT_BALANCE_CHANGED`; users must establish a new count snapshot. Counted on-hand below reserved is never accepted.

## 13. Inventory Adjustment lifecycle

An adjustment moves through Draft → Ready → Posted or Cancelled. Posted adjustments may be Reversed once. Each line has a non-zero signed delta, balance version, reason code, and reason-policy notes.

## 14. Adjustment reversal

Posting applies the signed delta to on-hand while reserved remains unchanged. Negative adjustments cannot consume reserved inventory or make on-hand, available, or inventory negative. Reversal applies the opposite delta after the same safety checks and creates linked immutable reversal movements.

## 15. Idempotency

Every command uses `BusinessCommandExecution` with a stable request hash. Reusing a key and identical payload returns the original result; reusing it with a changed payload returns a stable conflict. Posting and reversal replays never create duplicate movements.

## 16. Concurrency

Command transactions run at PostgreSQL `SERIALIZABLE` isolation, validate expected document and balance versions, and use row locks. Competing transfers, counts, adjustments, and duplicate posts either serialize safely or return a stable conflict.

## 17. Stable lock ordering

Multi-balance operations sort balance identifiers before `FOR UPDATE` acquisition. The same order is used across transfer, count, and adjustment posting to reduce deadlock risk and make contention behavior deterministic.

## 18. Warehouse Scope

Reads require signed-actor warehouse read scope. Mutations require operation scope for every affected warehouse; a transfer therefore requires both source and destination authorization. Unauthorized document reads are masked as 404, while authorized reads with insufficient mutation rights expose no executable action and mutations return 403.

## 19. Tenant isolation

The signed session supplies the tenant. Request `tenantId` values are ignored. Documents, balances, items, warehouses, movements, command executions, and audits are resolved and written within one tenant.

## 20. Error codes

Stable codes cover unavailable capabilities, invalid workflow transitions, stale versions, insufficient source inventory, invalid source/destination identity, count snapshot changes, count-below-reserved, invalid adjustment reason/delta, unsafe reversal, duplicate document numbers, authorization, not-found masking, and idempotency conflicts. SQL, Prisma codes, secrets, and stacks are not returned.

## 21. APIs

Formal route families exist under `/api/inventory/transfers`, `/api/inventory/counts`, and `/api/inventory/adjustments`. Each family exposes focused create/revise/transition, preview, post, cancel, reverse where supported, workbench, evidence, links where applicable, and reconciliation endpoints. There is no generic mutation endpoint.

## 22. Workbench routes

The existing React Router and route registry provide:

- `/app/inventory/operations`
- `/app/inventory/transfers`, `/new`, and `/:id`
- `/app/inventory/counts`, `/new`, and `/:id`
- `/app/inventory/adjustments`, `/new`, and `/:id`

The landing page shows the three capability cards and compact pending, ready, recently posted, and exception facts. Builders require explicit line, balance, warehouse, location, and quantity choices.

## 23. Evidence

Workbench evidence combines document lifecycle audit, command execution identity, original inventory movements, posting batches, actors, timestamps, and linked reversal facts. Original movements remain immutable after correction.

## 24. Smart Links

Transfer links target source/destination balances and movements; count links target counted balances and variance movements; adjustment links target balances and original/reversal movements. Links are generated only for supported server-side inventory filters and are hidden or disabled when scope prevents safe navigation.

## 25. Reconciliation

Transfer reconciliation verifies paired movements, zero net quantity, balance effects, and reversal restoration. Count reconciliation compares snapshot, counted quantity, variance movement, and posted balance. Adjustment reconciliation compares delta, movement, resulting balance, and reversal. Partial scope never claims a complete match.

## 26. PostgreSQL verification

`npm run test:db:inventory-operations` starts an isolated PostgreSQL instance, deploys every migration, exercises real transaction kernels, and cleans up automatically. The acceptance threshold is zero failed and zero skipped tests.

## 27. API Smoke

`npm run test:api:inventory-operations` starts isolated PostgreSQL and the formal Node server, provisions signed users and warehouse scopes, and exercises transfer, count, adjustment, permissions, capability-disabled behavior, tenant forgery resistance, restart persistence, movements, audit, command execution, replay, and reversal without mocking command services.

## 28. Playwright

`npm run test:browser:inventory-operations` uses the formal UI, signed sessions, real API, all migrations, and isolated PostgreSQL. It covers transfer posting/reversal, blind count entry and manager review/posting, adjustment posting/reversal, viewer restrictions, missing-scope masking, and capability-disabled read-only behavior.

## 29. Known limitations

- Transfers are atomic source-to-destination postings; there is no two-stage in-transit receipt.
- Lot/serial, barcode, mobile count, returns, quarantine, costing/COGS, and automatic AI posting are not supported.
- Cycle Count reversal is not supported.
- Posting does not create a missing destination balance automatically.
- Negative inventory is not supported.

## 30. Phase 4B boundary

After Phase 4A is frozen, Phase 4B may separately evaluate Lot/Serial, Returns, Quarantine, two-step in-transit transfers, and barcode/mobile counting. Those additions must preserve the Phase 4A movement immutability, mathematics, idempotency, authorization, reconciliation, PostgreSQL, API, and browser gates.

## 31. Phase 4A.1 inventory integrity hardening

Posting and reversal now use one shared balance-impact aggregation contract. Repeated transfer legs and adjustment lines accumulate fixed-scale deltas by `InventoryBalance.id`; each balance is locked and updated once. Transfer safety validates cumulative gross outbound demand as well as deterministic net impact. Adjustment lines that cancel to a zero balance delta are rejected with `ADJUSTMENT_NET_ZERO_NOT_ALLOWED`, and zero movements are never created.

Transfer and adjustment reversal fail closed unless every immutable original movement matches its document, line or leg, movement direction, item/SKU, warehouse/location, quantity fields, posting batch, balance metadata, and unreversed state. Corrections append linked movements under a new posting batch and leave original quantities unchanged.

Blind Count snapshot reveal is workflow-aware. Draft and in-progress entry hides recorded values from every recorder, including managers. Submitted counts reveal snapshots only to Admin/Manager reviewers; reviewed and posted counts reveal to authorized warehouse readers. Hidden values are serialized as `null`.

Reconciliation is evaluated per line rather than by document totals alone. Symmetric or offsetting errors cannot produce `matched`. Partial warehouse scope returns `unavailable` with `PARTIAL_WAREHOUSE_SCOPE`. Capability state requires all three explicit inventory-operation capabilities; an absent capability fails closed. Routes expose only formal domain and identity errors and sanitize Prisma/internal failures as `INVENTORY_OPERATION_FAILED`.
