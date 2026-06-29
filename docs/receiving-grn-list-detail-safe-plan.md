# Receiving / GRN List-Detail Safe Plan

## Current Receiving Subflows

Receiving currently includes several connected subflows:

- Main GRN operations list.
- Scan receive modal for creating or receiving against eligible purchase orders.
- QC modal for accepting/rejecting received lines and choosing warehouse.
- ERP document modal for full GRN review.
- Sign-in flow that moves a waiting GRN into QC.
- QC completion flow that updates accepted/rejected quantities and status.
- Exception resolution prompt that avoids direct stock mutation.
- ASN, QC plan, exception work order, and supplier return/SRN views.
- Document history panel for GRN audit context.

## Why Full Refactor Is Risky

GRN is not a simple display record. It is tied to PO line remaining quantities, accepted/rejected stock, warehouse assignment, inventory movement IDs, invoice matching, exception handling, and document history. A broad refactor could accidentally create duplicate inventory posting, hide QC state, or let completed receiving be edited without an action trail.

## Safe Target Pattern

- GRN list remains a full-width workbench list.
- Clicking GRN ID or detail action opens a full-width GRN detail view.
- Detail view preserves scan, QC, ERP document, and exception actions.
- ScanReceiveModal remains unchanged.
- QCModal remains unchanged.
- ERP document modal remains unchanged.
- Completed GRNs are reviewed through detail/document views, not directly mutated.
- Exception handling continues to route through explicit exception/return/credit flows.
- Inventory posting is not duplicated.

## Recommended Staged Implementation

1. Add GRN list to detail navigation for the main ReceivingOps list.
2. Keep all existing modals and API calls in place.
3. Move the existing selected-GRN summary into the full-width detail view.
4. Add lines, status timeline, document history, linked-document evidence, and ERP document access in detail.
5. Later, split ReceivingOps into smaller components only after tests or manual smoke coverage confirms scan/QC/document flows are stable.
6. Later, consider detail mode for exception/SRN views after the GRN flow is stable.

## This Task

This task applies only the low-risk GRN list/detail shell for the main ReceivingOps list and preserves the scan receive, QC, ERP document, exception, and stock-posting behavior.
