# Phase 5.2C.1 Mobile Sync Controls & Verification Debt Closure

## Baseline and scope

Phase 5.2C.1 starts from merge commit
`7556c5f44b31d8f26b11c5de3b9ddd1676ca029e`. It is a control correction and
verification patch for Phase 5.2C. It does not introduce Phase 5.3, a new
business module, bank integration, payment execution, QuickBooks, general
ledger, tax, native mobile applications, or object-storage providers.

No database migration is required. The existing Phase 5.2C schema already
contains the required `DomainChangeFeed` authorization metadata,
`SyncSnapshotSession.entityTypeCursor`, and
`SyncClient.lastAcknowledgedSequence`. The corrections can be implemented with
existing additive fields and transaction semantics. The published migration
`20260722010000_mobile_authority_evidence_hardening` and all earlier migrations
remain unchanged.

## Confirmed implementation defects

1. `CustomerInvoice` uses `finance.customer_invoice.create` as its sync read
   boundary instead of `finance.customer_invoice.read`.
2. Tombstones return immediately after registry/module/capability/permission
   checks. Warehouse-scoped tombstones do not enforce trusted feed tenant and
   warehouse metadata.
3. Sync acknowledgement compares a previously read client value and then
   performs an unconditional update. Concurrent acknowledgements can therefore
   overwrite a higher sequence with a lower sequence.
4. Initial synchronization stores `rowOffset` and uses Prisma `skip`. Concurrent
   inserts or deletes can shift offsets and permanently omit an authorized row.
5. Database repository construction always creates the durable JSON procurement
   legacy runtime, even though PostgreSQL is the formal mobile PO authority.

## Verification debt, not previously proven capability

The Phase 5.2C green gates did not prove the following scenarios and this plan
does not describe them as already working:

- real PostgreSQL rollback at every PO command fault-injection point;
- issuance and verification of a cursor genuinely signed by a previous key;
- keyset snapshot pagination, expiry, authorization invalidation, cursor scope,
  sequence ceilings, and convergence under concurrent changes;
- an exact `20260720020000_settlement_workflow_mobile_foundation` to
  `20260722010000_mobile_authority_evidence_hardening` upgrade;
- attachment survival across two Node process lifecycles;
- health and orphan diagnostic CLI behavior for controlled integrity failures;
- mobile receiving decimal preview/post parity against PostgreSQL;
- the formal O2C dispute command followed by advance-application rejection.

## Control corrections

### Sync authorization and tombstones

- Change `CustomerInvoice.requiredReadPermission` to
  `finance.customer_invoice.read` and statically reject non-read actions in read
  boundaries unless an explicit, documented exception is registered.
- Pass a trusted feed context from each `DomainChangeFeed` row into the
  projection loader. Tombstones must validate entity registration, resource
  tenant, module, capability, read permission, and warehouse intersection in
  that order.
- A warehouse-scoped tombstone with missing scope fails closed for a limited
  warehouse actor. An all-warehouse actor may receive it only when
  `resourceTenantId` explicitly matches. The returned projection is limited to
  `{ id, entityType, tombstone: true }`.
- Receiving attachment deletion records the receiving document warehouse before
  the attachment becomes unavailable and writes it to `scopeWarehouseIds`.

### Atomic acknowledgement

Use a Serializable PostgreSQL transaction and `SELECT ... FOR UPDATE` on the
tenant-owned sync client. Re-read status and sequence while holding the lock,
allow equal idempotently, reject a lower sequence, and update only after cursor
scope, expiry, ceiling, and authorization checks. No process-local mutex is used.

### Convergent keyset initialization

`SyncSnapshotSession.entityTypeCursor` stores
`{ "typeIndex": number, "lastId": string|null }`. Each entity type is read by
`id > lastId`, ordered by `id ASC`, with `pageSize + 1`; advancing to the next
type resets `lastId`.

This is **Convergent Keyset Initial Synchronization**, not a long-lived MVCC
snapshot. The session records a feed high-watermark, enumerates current
authorized projections, permits at-least-once overlap, and begins incremental
replay after the high-watermark. Clients must idempotently upsert by entity type,
entity id, and entity version. Concurrent writes may be visible in the current
projection and are still replayed by the incremental feed. Expired sessions
restart; authorization changes invalidate the session.

### Database legacy procurement isolation

`FLOWCHAIN_ENABLE_LEGACY_PROCUREMENT_RUNTIME` defaults to false in database
mode. Only explicit opt-in constructs `procurementLegacyRuntime`; it is never a
formal mobile PO authority. Database-mode mobile PO reads and commands fail with
`PROCUREMENT_DATABASE_AUTHORITY_REQUIRED` if PostgreSQL authority is absent,
even when a legacy repository is supplied. JSON persistence mode keeps its
existing behavior.

### Receivable dispute defense-in-depth

Formal receivable advance eligibility uses an allowlist: obligation status must
be `open` or `partially_settled`, and dispute status must be `none` or
`resolved`. Unknown states fail closed. This is defense-in-depth; the current O2C
command already sets disputed receivables to `status=disputed` and
`disputeStatus=open`.

## Verification architecture

Tests are separated by responsibility rather than aliases to one small file:

- permission registry and CustomerInvoice read/create isolation;
- warehouse tombstone tenant/scope isolation;
- previous-key cursor rotation;
- real PostgreSQL keyset convergence and acknowledgement concurrency;
- real PostgreSQL PO fault rollback;
- exact v0.5.2B to v0.5.2C migration preservation;
- formal dispute-to-advance rejection and resolved continuation;
- attachment process restart and diagnostics fixtures;
- real PostgreSQL receiving decimal preview/post parity;
- browser/API PostgreSQL authority with an unusable JSON sentinel path.

The existing Phase 5.2C gates remain in CI. New gates must report zero failures
and zero skips. CI evidence is limited to local durable storage and a single
PostgreSQL instance; it does not claim S3, cross-pod object storage, or a shared
multi-node filesystem.
