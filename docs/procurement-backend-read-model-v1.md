# Procurement Backend Read Model v1

## Purpose

This note defines the first read-only procurement model for FlowChain backend APIs. It gives the workbench, search, and AI surfaces a stable document graph without changing procurement write behavior.

## Scope

The model is implemented in `server/domain/procurement-read-model.mjs` and exposed through `server/routes/procurement-read.routes.mjs`.

Read endpoints:

- `GET /api/procurement/documents`
- `GET /api/procurement/documents/:type/:id`
- `GET /api/procurement/links`
- `GET /api/procurement/followups`
- `GET /api/procurement/summary`

## Document Families

- `purchase_request`: PR status, requester, buyer, supplier, item, quantity, full numeric amount, required date, linked RFQ, linked PO.
- `rfq`: RFQ status, supplier response counts, due date, awarded supplier, source PR, linked PO.
- `purchase_order`: PO status, supplier, source PR/RFQ, expected date, amount, ordered and received quantity, receiving status, linked GRNs.
- `receiving_doc`: GRN status, PO, supplier, accepted and rejected quantity, warehouse, linked invoices.
- `supplier_invoice`: invoice status, related PO/GRN, invoice amount, match status, variance amount.
- `three_way_match`: derived PO/GRN/invoice view for variance follow-up.

## API Semantics

- All endpoints are read-only. They do not call `writeDb`, create audit events, or mutate runtime JSON data.
- IDs are stable and derived from existing business document numbers.
- Amount fields remain numbers. UI surfaces should format them with full currency display.
- Missing optional source arrays produce empty read-model sections rather than errors.
- Query filtering supports `q`, `type`, `status`, `supplier`, and `limit` where relevant.

## Reuse Notes

Global search and deterministic AI already have procurement-specific logic. This pass did not swap their ranking or intent internals to avoid changing user-visible behavior. The read model is now available for a later low-risk consolidation once route coverage and ranking expectations are pinned down.
