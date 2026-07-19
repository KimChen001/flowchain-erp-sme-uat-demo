# Phase 4B.3 Customer Return Receipt Transaction Kernel

Status: implemented; local and remote gates are required before Phase 4B.4.

## Scope

Phase 4B.3 enables `customer_return_receipt` only:

- receipt against an approved or partially executed customer return authorization;
- partial receipt across multiple posting documents;
- receipt into a selected, existing quarantine balance;
- immutable movement evidence;
- downstream-consumption-aware compensating reversal.

Customer return receipt never creates or updates ordinary available inventory.
Quarantine release remains unavailable until Phase 4B.4 passes.

## Authoritative mathematics

All quantity decisions use four-decimal scaled integer units.

```text
quarantineOnHandAfter = quarantineOnHandBefore + Q

available.onHand change   = 0
available.reserved change = 0
available.available change = 0
```

The posting policy requires:

- `Q > 0`;
- a customer return authorization in `approved` or `partially_executed`;
- an unexpired authorization;
- `dispositionRoute = receive_to_quarantine`;
- one explicit existing quarantine balance per line;
- exact tenant, item, SKU, unit, warehouse, and location identity;
- cumulative receipt quantity not exceeding the remaining authorization.

Repeated lines are aggregated by quarantine balance, locked in stable order,
and each balance is updated once inside the posting transaction.

## Lifecycle and evidence

The existing focused return posting routes dispatch by authorization and posting
type. Customer receipts support draft, revise, ready, cancel, preview, post,
reverse preview, reverse, and workbench reads.

Posting creates `customer_return_quarantine_in` movements. Each movement records
the posting, authorization, request, posting line, item, warehouse, location,
quantity, quarantine balance, and `postingBatchId`.

Posting and reversal require signed provisioned identity, permitted role,
warehouse `operate` scope, expected versions, stable idempotency,
`BusinessCommandExecution`, `SERIALIZABLE` PostgreSQL transactions, and
`AuditLog` evidence.

## Disposition lineage and reversal

`QuarantineDispositionAllocation` is an additive lineage table. When a supplier
return consumes quarantine inventory, the command allocates consumption against
customer receipt movements using:

```text
untracked pre-existing quarantine first
then tracked customer receipt layers FIFO
```

This does not infer ownership or cost. It exists only to prove whether a receipt
quantity remains physically reversible.

Customer receipt reversal verifies every original movement field and requires:

- the current quarantine balance identity still matches;
- the current quarantine quantity is sufficient;
- no active downstream allocation consumes the receipt movement.

Unsafe reversal returns `RETURN_REVERSAL_NOT_SAFE` with HTTP 409. A successful
reversal creates `customer_return_receipt_reversal` movements, preserves original
movement quantities, and links both directions. Reversing the downstream
supplier return marks its lineage allocations reversed, after which the customer
receipt can be reversed if all other checks pass.

## Migration and acceptance

`20260718030000_customer_return_receipt_kernel` adds only
`QuarantineDispositionAllocation`, its checks, indexes, and foreign keys.

`npm run test:db:returns-quarantine` covers fresh migration and upgrades from
Phase 4A, 4B.0, 4B.1, and 4B.2. The real PostgreSQL customer receipt test covers
quarantine-only posting, unchanged available inventory, partial and cumulative
execution, concurrency, idempotency, tenant and warehouse scope, movement
integrity, safe reversal, and downstream-consumption blocking with zero failed
and zero skipped tests.

`npm run test:api:returns-quarantine` covers the HTTP lifecycle, preview/command
parity, restart persistence, evidence, reversal, and disabled-capability reads.
