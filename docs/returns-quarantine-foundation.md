# Returns and Quarantine Data Foundation

## 1. Scope

Phase 4B.0 establishes the additive PostgreSQL data and read-capability
foundation for governed returns and quarantine inventory. It does not implement
request, authorization, posting, reversal, or quarantine-disposition commands.

## 2. Architecture boundary

Quarantine inventory is stored in `QuarantineInventoryBalance`, separate from
ordinary `InventoryBalance`. It is not represented by a special status,
location convention, reservation, adjustment, or metadata flag.

This separation preserves the existing available-inventory invariant:

```text
available = onHand - reserved
```

Quarantine inventory has an on-hand quantity but has no reserved or available
quantity and is never reservable.

## 3. Additive schema

Migration `20260717010000_returns_quarantine_foundation` adds:

- `QuarantineInventoryBalance`
- `ReturnRequest`
- `ReturnRequestLine`
- `ReturnAuthorization`
- `ReturnAuthorizationLine`
- `ReturnPostingDocument`
- `ReturnPostingLine`

No existing migration is modified. Existing Receiving, Outbound, and Inventory
Operations tables and quantities remain unchanged.

## 4. Quarantine balance contract

The quarantine natural key is:

```text
tenantId + sku + warehouseKey + locationKey
```

The database enforces non-negative `onHandQuantity`, non-negative versions,
valid status values, tenant relationships, item relationships, warehouse
relationships, and natural-key uniqueness.

## 5. Return document foundation

The request, authorization, and posting models preserve explicit document and
line identity. Quantities use PostgreSQL `DECIMAL(18,4)`. Database constraints
require positive request, authorization, and posting-line quantities and limit
workflow, posting, return-type, and disposition values to the planned contract.

`ReturnPostingLine` explicitly references its physical source or destination
balance. A posting line cannot be stored without at least one ordinary or
quarantine balance target. Phase 4B.0 stores this contract but does not expose a
posting command.

## 6. Capability contract

The following capabilities are registered as beta, database-only, and
explicitly enabled:

- `quarantine-inventory`
- `return-request`
- `return-authorization`
- `return-posting`

They require:

```text
FLOWCHAIN_PERSISTENCE_MODE=database
FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE=true
```

All return mutation capabilities remain unavailable because their transaction
kernels are not implemented. The environment flag does not activate a write
route.

## 7. Authoritative read APIs

Phase 4B.0 adds these authenticated PostgreSQL read surfaces:

```text
GET /api/inventory/balances/select
GET /api/inventory/quarantine-balances
GET /api/inventory/quarantine-balances/select
```

Available and quarantine selectors use different Prisma models and different
response contracts. Both are tenant-scoped and warehouse-read-scoped through
the provisioned signed actor.

## 8. Available selector

The available selector returns only ordinary balances with positive
`availableQuantity`. Each option includes:

```text
balanceType = available
reservable = true
availableQuantity = authoritative value
quarantineQuantity = null
```

Quarantine balances cannot enter this selector.

## 9. Quarantine selector

The quarantine selector returns only active quarantine balances with positive
on-hand quantity. Each option includes:

```text
balanceType = quarantine
reservable = false
availableQuantity = null
reservedQuantity = null
quarantineQuantity = authoritative onHandQuantity
```

The selector does not expose quarantine stock as available inventory.

## 10. Disabled capability behavior

Authenticated database reads remain available while the beta capability flag is
disabled. Responses expose disabled capability metadata so a future workbench
can render a governed read-only state. No JSON authoritative fallback is added.

## 11. PostgreSQL verification

Run:

```text
npm run test:db:returns-quarantine
```

The verifier starts isolated PostgreSQL databases and proves:

- fresh deployment applies every migration;
- an upgrade from the Phase 4A schema preserves existing inventory;
- all seven Phase 4B.0 tables exist;
- request, authorization, posting, and quarantine relationships persist;
- ordinary available inventory is not changed by foundation data;
- negative quarantine quantities are rejected;
- duplicate quarantine natural keys are rejected;
- posting lines without a physical balance target are rejected;
- real Prisma reads keep available and quarantine selectors separate;
- signed actor warehouse scope is applied to the authoritative selectors.

The acceptance threshold is zero failed and zero skipped checks.

## 12. CI

The PostgreSQL workflow runs `npm run test:db:returns-quarantine` after the
Inventory Operations database and API gates. Phase 4B.0 must also pass all
existing Receiving, Reports, Outbound, Inventory Operations, browser, and pilot
regression gates before it is considered complete.

## 13. Explicitly not implemented

Phase 4B.0 does not provide:

- return request or authorization mutations;
- supplier return dispatch;
- customer return receipt;
- quarantine release to available inventory;
- inventory movements for returns;
- posting, reversal, idempotency, evidence, reconciliation, or a return
  workbench;
- refunds, settlement, accounting, costing, lot/serial, barcode, mobile, or
  carrier behavior.

Those behaviors remain gated for later Phase 4B increments. They must not be
simulated through inventory adjustments, metadata-only inventory, Runtime JSON,
or automatic currency or accounting assumptions.
