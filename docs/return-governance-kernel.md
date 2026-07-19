# Return Request and Authorization Governance Kernel

## 1. Scope

Phase 4B.1 implements authoritative PostgreSQL Return Request and Return
Authorization governance. It does not create Return Posting documents, change
ordinary or quarantine inventory, create inventory movements, or alter
Receiving, Shipment, or Reservation facts.

## 2. Additive migration

Migration `20260718010000_return_governance_kernel` adds explicit request source
snapshots, business-context references, rejection facts, authorization
cancellation and expiration facts, and a partial unique index that permits at
most one active authorization per request.

Existing Phase 4B.0 data remains compatible. Fresh migration, Phase 4A upgrade,
and direct Phase 4B.0-to-4B.1 upgrade paths are verified.

## 3. Source authority

Customer Return lines resolve to a posted, unreversed `ShipmentDocument` and
`ShipmentLine`. A Sales Order may be supplied as the business context, but the
stored physical source remains the Shipment.

Supplier Return lines resolve to a posted, unreversed `ReceivingDocument` and
`ReceivingLine`. A Purchase Order may be supplied as the business context, but
the stored physical source remains the Receiving Document.

The server re-reads and snapshots partner, item, SKU, item name, unit, source
quantity, source document, and source warehouses. Client-provided values for
those fields are ignored.

## 4. Quantity governance

All quantities use fixed four-decimal strings and scaled-integer decisions.
Requested quantity cannot exceed:

```text
posted source quantity
- posted return execution quantity
- quantity occupied by other active return requests
```

Duplicate source lines and mixed physical source documents are rejected.
Customer Returns cannot use receiving lines, and Supplier Returns cannot use
shipment lines.

## 5. Request lifecycle

The implemented commands are:

- Create Draft
- Revise Draft
- Submit
- Cancel
- Reject through authorization governance

Only drafts are editable. Submission revalidates the authoritative physical
source and freezes the source identity and quantity snapshots. Every command
requires an idempotency key; revision and state transitions require the
expected version.

## 6. Authorization lifecycle

Only a submitted request can be authorized. Authorization quantities must be
positive and cannot exceed the corresponding requested quantity.

Phase 4B.1 permits:

- Customer Return: `receive_to_quarantine`
- Supplier Return: `return_from_available`
- Supplier Return: `return_from_quarantine`

Quarantine release and retain-in-quarantine are not executable authorization
routes in this phase.

Approved authorization facts are frozen. Rejected, cancelled, and expired
authorizations remain as history. Cancellation and expiration are permitted
only before posting history exists.

## 7. Roles and scope

- Admin and Manager may authorize, reject, cancel, and expire authorizations.
- Business Specialist may create, revise, submit, and cancel requests.
- Buyer may manage Supplier Return requests only.
- Viewer is read-only.

Signed tenant identity is authoritative. Request reads and governance commands
require read access to every physical source warehouse. Cross-tenant sources
fail closed.

## 8. Transaction properties

Commands use:

- PostgreSQL authoritative persistence
- `SERIALIZABLE` transactions
- `BusinessCommandExecution`
- stable request hashes
- durable idempotent replay
- optimistic expected versions
- `AuditLog`
- actor, before, after, timestamp, and command evidence

No Runtime JSON return transaction is introduced.

## 9. APIs

Formal request APIs:

```text
POST  /api/returns/requests/preview
POST  /api/returns/requests
GET   /api/returns/requests
GET   /api/returns/requests/:id/workbench
PATCH /api/returns/requests/:id
POST  /api/returns/requests/:id/submit-preview
POST  /api/returns/requests/:id/submit
POST  /api/returns/requests/:id/cancel-preview
POST  /api/returns/requests/:id/cancel
```

Formal authorization APIs:

```text
POST /api/returns/requests/:id/authorization-preview
POST /api/returns/requests/:id/authorize
POST /api/returns/requests/:id/reject
GET  /api/returns/authorizations/:id/workbench
POST /api/returns/authorizations/:id/cancel
POST /api/returns/authorizations/:id/expire
```

Reads remain available while the explicit capability is disabled. Server
computed actions are false, and preview or mutation calls return a stable 409.

## 10. Verification

Run:

```text
npm run test:db:returns-quarantine
npm run test:api:returns-quarantine
```

The API smoke uses a real server, signed sessions, isolated PostgreSQL, all
migrations, restart persistence, role checks, warehouse scope, cumulative
quantity checks, idempotency, version conflicts, authorization governance, and
capability-disabled behavior.

It snapshots and compares `InventoryBalance`, `QuarantineInventoryBalance`,
`InventoryMovement`, `InventoryReservation`, `ShipmentDocument`, and
`ReceivingDocument` before and after every governance flow to prove zero
physical inventory mutation.
