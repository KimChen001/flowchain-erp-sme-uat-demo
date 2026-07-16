# Return and Quarantine Workbench

Phase 4B.5 exposes the governed reverse-logistics transaction kernels through formal inventory routes:

- `/app/inventory/returns`
- `/app/inventory/returns/requests`
- `/app/inventory/returns/authorizations`
- `/app/inventory/returns/postings`
- `/app/inventory/quarantine`

All business records are authoritative PostgreSQL data. Runtime JSON is not used as a return, authorization, posting, movement, or quarantine balance store.

## Product contract

- Request creation requires an explicit posted source document and explicit source lines.
- Authorization requires explicit quantities and disposition routes.
- Posting creation requires explicit available or quarantine balance selection.
- Quarantine release also requires an existing explicit destination available balance.
- No selector implicitly chooses its first option.
- Mutation actions are preview-first and are rendered from server-computed `availableActions`.
- Disabled capabilities remain readable and fail closed for writes.
- Viewer and warehouse scope policies are enforced by the server; inaccessible records are existence-masked.
- Quarantine inventory is displayed separately and is never presented as available or reservable stock.

## Reconciliation

Posting reconciliation is calculated per posting line. Each line independently checks:

- request, authorization, and posting lineage;
- required movement type and identity;
- posting batch identity;
- recorded balance before/after evidence;
- reversal lineage;
- authorization consumed quantity.

Cross-line netting is not allowed. One mismatched line makes the posting reconciliation mismatched even if another line has an offsetting quantity.

## Current limits

- Supported disposition is limited to supplier return, customer receipt to quarantine, and governed quarantine release to available.
- Scrap, repair, refurbishment, destruction, automatic FX, inventory valuation, and financial posting are outside Phase 4B.5.
- A zero-quantity balance may be selected as an explicit receipt/release destination; transaction policy still rejects an insufficient source balance.
