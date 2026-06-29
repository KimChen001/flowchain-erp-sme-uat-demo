# Backend Write Boundary And Audit Plan

## Goal

Move FlowChain toward API-first backend behavior while keeping procurement writes explicit, auditable, and separate from read-model generation.

## Write Boundary

Allowed write families:

- Authentication/session profile updates.
- Forecast plan creation.
- PR creation, approval, rejection, and conversion.
- RFQ creation, award, close, and conversion.
- PO creation and workflow status updates.
- GRN creation, inspection updates, and posted receiving application.
- AI event logging.

Read-model routes must not write:

- Inventory read APIs.
- Procurement read APIs.
- Search APIs.
- Master-data read APIs.
- Summary or dashboard APIs.

## Audit Requirements

- Every business write should record document type, document ID, action, actor, source, reason, timestamp, and metadata.
- Posted receiving and closed/cancelled procurement documents should reject unsafe edits and record blocked attempts.
- Derived read models should expose evidence links but should not create audit entries.
- AI actions that prepare drafts should distinguish draft preparation from committed business writes.

## Next Implementation Steps

1. Add a route-level test harness that asserts selected read endpoints do not call `writeDb`.
2. Normalize audit entries across PR, RFQ, PO, GRN, inventory movement, and AI draft preparation.
3. Add immutable document snapshots for posted GRNs and completed/cancelled POs.
4. Introduce service-layer write commands before replacing JSON persistence.
5. Map each command to database transactions and audit inserts.
