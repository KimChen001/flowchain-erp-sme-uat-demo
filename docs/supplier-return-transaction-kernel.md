# Phase 4B.2 Supplier Return Transaction Kernel

Status: implemented; local and remote gates are required before Phase 4B.3.

## Scope

Phase 4B.2 enables only `supplier_return_dispatch`:

- dispatch from existing available inventory;
- dispatch from existing quarantine inventory;
- partial execution across multiple posting documents;
- immutable movement evidence;
- compensating reversal.

Customer return receipt and quarantine release remain unavailable.

## Lifecycle

Focused command routes:

- `POST /api/returns/authorizations/:id/postings/preview`
- `POST /api/returns/authorizations/:id/postings`
- `PATCH /api/returns/postings/:id`
- `POST /api/returns/postings/:id/ready-preview`
- `POST /api/returns/postings/:id/ready`
- `POST /api/returns/postings/:id/cancel`
- `POST /api/returns/postings/:id/post-preview`
- `POST /api/returns/postings/:id/post`
- `POST /api/returns/postings/:id/reverse-preview`
- `POST /api/returns/postings/:id/reverse`
- `GET /api/returns/postings/:id/workbench`

Draft and ready documents are unposted. Only ready documents can post. Posted
documents are immutable and can only be compensated by reversal.

## Authoritative mathematics

All decisions use four-decimal integer units. JavaScript floating point is not
used.

Available source for quantity `Q`:

```text
onHandAfter   = onHandBefore - Q
reservedAfter = reservedBefore
availableAfter = availableBefore - Q
```

The policy requires:

```text
Q > 0
availableBefore >= Q
onHandAfter >= reservedBefore
availableAfter >= 0
```

Quarantine source:

```text
quarantineOnHandAfter = quarantineOnHandBefore - Q
```

The policy requires the selected quarantine balance to remain non-negative.
Repeated lines are grouped by `(balanceType, balanceId)`, locked once in stable
order, and updated once.

## Authorization consumption

The command reloads the approved or partially executed authorization inside the
same `SERIALIZABLE` transaction. Posted, non-reversed posting lines are summed
per authorization line.

```text
posting quantity <= authorized quantity - previously posted quantity
```

After posting, both authorization and request become:

- `partially_executed` while authorized quantity remains;
- `executed` when all authorized quantity has posted.

Reversal recomputes the same cumulative state from remaining posted documents.

## Movement identity and reversal

Posting creates one immutable `supplier_return_out` movement per posting line.
Each movement records:

- tenant;
- posting, authorization, and request identity;
- item, SKU, unit, warehouse, and location;
- quantity;
- `postingBatchId`;
- `balanceType`;
- exact available or quarantine balance ID.

Reversal verifies every original field and both reversal-link fields. Any
missing, altered, duplicated, or already reversed movement returns
`RETURN_REVERSAL_NOT_SAFE` with HTTP 409. Reversal creates
`supplier_return_reversal` movements and never edits original quantities.

## Transaction and security boundary

Every mutation requires:

- signed, provisioned tenant identity;
- permitted posting role;
- warehouse `operate` scope;
- explicit `FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE=true`;
- `expectedVersion` inputs;
- stable idempotency hash and `BusinessCommandExecution`;
- `SERIALIZABLE` PostgreSQL transaction;
- stable document and balance locking;
- `AuditLog` before/after evidence.

Disabled capability keeps the posting workbench readable but makes every action
false and blocks direct mutation routes.

## Migration

`20260718020000_supplier_return_posting_kernel` is additive. It adds ready and
cancellation timestamps/actors, a lifecycle constraint, and a lifecycle index.
Upgrade verification backfills legacy ready/posted timestamps before installing
the constraint.

## Acceptance

`npm run test:db:returns-quarantine` covers fresh migration, Phase 4A, Phase
4B.0, and Phase 4B.1 upgrades plus the real supplier return transaction kernel.
The transaction test covers available and quarantine dispatch, partial and full
execution, repeated-line aggregation, reserved-stock protection, concurrent
posting, idempotent replay, changed-payload conflict, tenant and warehouse
scope, rollback, movement tampering, and reversal.

`npm run test:api:returns-quarantine` covers the focused HTTP lifecycle against
the real server, signed sessions, PostgreSQL persistence, restart persistence,
evidence, reversal, and disabled-capability behavior.
