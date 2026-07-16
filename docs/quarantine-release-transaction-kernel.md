# Phase 4B.4 Controlled Quarantine Disposition

Status: implemented; local and remote gates are required before Phase 4B.5.

## Scope

Phase 4B.4 enables only governed `quarantine_release`:

- source: an explicit existing `QuarantineInventoryBalance`;
- destination: an explicit existing `InventoryBalance`;
- route: `release_quarantine_to_available`;
- paired immutable movements under one posting batch;
- compensating reversal.

Scrap, repair, refurbishment, destruction, laboratory workflows, supplier claim
automation, and automatic disposition remain unavailable.

## Authorization

A release authorization is a second governed disposition stage for an executed
customer return request. The authorization policy proves, per request line:

```text
release authorization quantity
<= posted customer receipt quantity
 - posted quarantine release quantity
```

An active authorization still remains exclusive. A release authorization cannot
be created before the customer return receipt has executed.

## Mathematics

All decisions use four-decimal scaled integer units.

```text
quarantine.onHandAfter = quarantine.onHandBefore - Q

available.onHandAfter = available.onHandBefore + Q
available.reservedAfter = available.reservedBefore
available.availableAfter = available.availableBefore + Q

tenant net quantity change = 0
```

The destination balance must already exist. Source and destination must match
tenant, item, SKU, unit, warehouse, and location. The command never creates an
available balance.

Repeated lines are aggregated independently by source and destination balance.
All balances are locked in stable `(table, id)` order and updated once inside a
`SERIALIZABLE` transaction.

## Evidence and lineage

Every posting line creates:

- `quarantine_release_out`;
- `quarantine_release_available_in`.

Both movements share one `postingBatchId`. The quarantine out movement is also a
lineage consumer, so a customer receipt reversal fails while released inventory
still consumes that receipt layer.

The command records signed actor, tenant, request, authorization, posting line,
both balance identities, before/after balance evidence, audit, and zero-net
reconciliation.

## Reversal

Reversal creates:

- `quarantine_release_reversal_available_out`;
- `quarantine_release_reversal_in`.

The destination available balance must still equal the exact post-release
version and quantities recorded by the inbound movement. Any later consumption
or other balance change makes the reversal fail closed with
`RETURN_REVERSAL_NOT_SAFE`.

This conservative rule does not infer inventory layer ownership. It may require
manual review after unrelated destination balance activity, but it never claims
an unsafe reversal is valid.

## Acceptance

`npm run test:db:returns-quarantine` covers paired movements, tenant net zero,
reserved quantity preservation, destination-required behavior, repeated-balance
aggregation, partial execution, concurrency, idempotency, scope, movement
tampering, safe reversal, and post-release destination consumption blocking.

`npm run test:api:returns-quarantine` covers executed-receipt release
authorization, preview/command parity, posting, lineage blocking, reversal,
restart persistence, and disabled capability behavior against the real server
and PostgreSQL.
