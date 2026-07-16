# ADR: Receiving workflow and fulfillment status separation

Status: accepted as transitional technical debt for Phase 2.5.

`PurchaseOrder.status` currently contains both workflow values (`draft`, `approved`, `issued`, `cancelled`) and receiving fulfillment values (`partially_received`, `fully_received`). Changing that persisted model is too risky for the workbench release.

The database-backed Receiving Read Model therefore exposes two independent concepts:

- `workflowStatus`: `receivingBaseStatus` when present, otherwise the non-fulfillment legacy status. A legacy fulfillment status without a base falls back to `approved`.
- `fulfillmentStatus`: derived only from all PO line `orderedQuantity` and `receivedQuantity` values as `not_received`, `partially_received`, or `fully_received`.

The UI must display Workflow and Fulfillment separately and must not infer business workflow from fulfillment. A future, separately reviewed schema migration should persist fulfillment as its own field, backfill it from PO lines, migrate consumers, and then remove the mixed semantics from `PurchaseOrder.status`.
