# Phase 5.2C Mobile Authority & Evidence Hardening Plan

## Baseline and Scope

Phase 5.2C starts from `04f53c6be319c768e29b5802cee011ebf296b501` and preserves the
published Phase 5.2 and Phase 5.2B migrations, APIs, browser contracts, and tags.
The new migration is additive: `20260722010000_mobile_authority_evidence_hardening`.

The database is authoritative for formal procurement, receiving, finance, audit,
idempotency, and synchronization facts. JSON runtimes remain available only for
legacy compatibility, explicit import, and development fixtures.

## Audit Findings

### Procurement authority

- `server/repositories/adapter-registry.mjs` currently wires
  `createDatabaseRepositoryRegistry().procurementRuntime` to
  `createDurableProcurementRepository`, backed by
  `data/procurement-transactions.json` (or `FLOWCHAIN_PROCUREMENT_RUNTIME_FILE`).
- `server/domain/mobile-operations-service.mjs` reads mobile PO tasks and detail
  through that repository and calls `procurement.transitionPurchaseOrder()` for
  approve, reject, and return-for-revision. The subsequent PostgreSQL transaction
  writes `BusinessCommandExecution`, `AuditLog`, and `DomainChangeFeed` only after
  the JSON mutation has already committed.
- PostgreSQL already contains `PurchaseOrder` and `PurchaseOrderLine`, and
  `db-procurement-read-repository.mjs` maps them for formal reads, but there is no
  PostgreSQL PO command service. Receiving already reads the PostgreSQL PO by
  `PurchaseOrder.id`, so the current mobile PO path creates a real dual-authority
  split.

### Sync authorization and snapshots

- `mobile-sync-service.mjs` currently returns raw `DomainChangeFeed` metadata after
  checking only `sensitivityGroups`; it does not load the entity or apply module,
  warehouse, entity-type, or capability authorization.
- No code-owned entity policy registry exists. Unknown entity types therefore have
  no explicit fail-closed behavior.
- Initial sync scans the feed from sequence zero. It can omit current objects that
  predate the feed and has no snapshot session, high-watermark, pagination, or
  expiry boundary.
- Cursor claims contain only version, tenant/user/client/device, sequence, and
  authorization fingerprint. There is no expiry, key id, previous-key validation,
  server-sequence ceiling, or monotonic acknowledgement check.

### Evidence storage

- `attachment-service.mjs` resolves storage to `FLOWCHAIN_UPLOAD_STORAGE_DIR` or a
  `tmpdir()` fallback. It writes the final path directly before creating the DB row,
  with no provider interface, atomic rename, post-write hash verification, startup
  health check, or orphan diagnostics.
- Attachment metadata correctly avoids business JSON and protects tenant access,
  but production configuration is not fail-closed and restart durability is not
  explicitly tested.

### Advance and receiving integrity

- `advance-application-command-service.mjs` accepts obligations based mainly on
  currency, partner, and positive outstanding amount; Held, Disputed, Cancelled,
  and Closed eligibility is not centralized.
- Advance reversal projects any non-zero restored payable to `approved` and any
  non-zero restored receivable to `open`, which loses `partially_settled` state.
- `mobile-operations-service.mjs` converts receiving quantities with `Number()`
  and computes remaining quantities using floating-point subtraction. This differs
  from the formal receiving decimal policy and is unsafe for `0.1 + 0.2` and four
  decimal boundary cases.

## Implementation Boundaries

1. Add the snapshot, change-feed authorization metadata, and attachment storage
   metadata additively in the new migration.
2. Add a PostgreSQL PO command service that performs actor resolution, permission,
   tenant, row lock, version/state validation, PO update, execution, audit, and
   feed writes in one Serializable transaction. Mobile PO reads and tasks use the
   same PostgreSQL authority.
3. Add a code-owned sync entity registry with formal projection loaders and
   fail-closed handling for unknown, disabled, unauthorized, and warehouse-scoped
   entities. Projections redact amount, partner, and price fields independently.
4. Implement snapshot sessions at a fixed feed high-watermark, with entity-type
   pagination and authorization invalidation. Incremental cursors begin after the
   watermark.
5. Introduce versioned cursor keys, expiry, bounded previous-key verification,
   sequence ceilings, and monotonic acknowledgements. Production configuration
   fails closed when current key material is absent or weak.
6. Introduce `AttachmentStorageProvider` and a durable local implementation using
   atomic writes, verification, health checks, and diagnostic-only orphan scans.
7. Share obligation status derivation and eligibility validation between advance
   create/post/reverse paths.
8. Replace mobile receiving numeric conversions with the existing receiving decimal
   units/string policy and test preview/post parity.

## Verification Plan

- Add fresh and v0.5.2B upgrade PostgreSQL coverage for PO authority, atomic fault
  rollback, sync authorization/snapshot/cursor security, attachment durability,
  advance status, and receiving decimal behavior.
- Add API gates for each boundary and a browser gate that disables/removes the JSON
  procurement runtime while exercising Mobile PO -> PostgreSQL Receiving -> GRN ->
  Inventory Impact -> second-device sync.
- Preserve all Phase 5.2B regression and browser gates before feature CI, release
  CI, PR CI, and post-merge main CI.

## Explicit Non-goals

No bank statement import, bank payment execution, S3 implementation, QuickBooks,
FX, general ledger, native mobile applications, or AI-initiated approvals/posting
are introduced in this phase.
