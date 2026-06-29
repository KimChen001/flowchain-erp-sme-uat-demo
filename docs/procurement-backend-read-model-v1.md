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

The stable `documentType` values are:

- `pr`: PR status, requester, buyer, supplier, item, quantity, full numeric amount, required date, linked RFQ, linked PO.
- `rfq`: RFQ status, supplier response counts, due date, awarded supplier, source PR, linked PO.
- `po`: PO status, supplier, source PR/RFQ, expected date, amount, ordered and received quantity, receiving status, linked GRNs.
- `grn`: GRN status, PO, supplier, accepted and rejected quantity, warehouse, linked invoices.
- `invoice`: invoice status, related PO/GRN, invoice amount, match status, variance amount.
- `threeWayMatch`: derived PO/GRN/invoice view for variance follow-up.

The model accepts safe route aliases such as `purchase-request`, `purchase-order`, `receiving`, `supplier-invoice`, and `3wm`. Unknown detail types return a clean `400`.

## Response Shape

Document rows expose stable fields where available:

- `type`: legacy family label for compatibility.
- `documentType`: canonical type for route lookup and future reuse.
- `id`, `label`, `title`, `status`.
- `supplierId`, `supplierName`, `itemId`, `sku`, `amount`, `currency` where present or safely derived.
- `createdAt`, `updatedAt`, `dueDate` when present in source data.
- `relatedDocuments`: compact canonical document references.
- `evidence`: compact evidence items with type, id, label, status, supplier, amount, currency, and API route.

Missing optional data remains empty, `null`, or omitted. The read model does not fabricate unsupported accounting values.

## API Semantics

- All endpoints are read-only. They do not call `writeDb`, create audit events, or mutate runtime JSON data.
- IDs are stable and derived from existing business document numbers.
- Amount fields remain numbers. UI surfaces should format them with full currency display.
- Missing optional source arrays produce empty read-model sections rather than errors.
- Query filtering supports `q`, `type`, `status`, `supplier`, and `limit` where relevant.
- Route responses use stable top-level wrappers: `documents`, `document`, `links`, `followups`, and `summary`.

## Three-Way Match

Three-way match rows expose:

- related IDs: `prId`, `rfqId`, `poId`, `grnId`, `invoiceId`, `supplierId`.
- amount fields: `poAmount`, `invoiceAmount`, `varianceAmount`, `varianceRate`, and `currency`.
- `receivedQuantity` when receiving data is available.
- `receivedAmount: null` unless a real receiving amount exists in source data.
- `matchStatus`, `blockingReason`, and `exceptionReason` for read-only review context.

No GL, posting, payment, tax, or accounting behavior is introduced.

## Links, Followups, And Summary

- Links use canonical `sourceType`, `sourceId`, `targetType`, `targetId`, and `relationship`; `relation` is retained as a compatibility alias.
- Followups use stable deterministic IDs, canonical document references, severity from `high`, `medium`, or `low`, `status`, `dueDate`, and evidence.
- Summary counts align with the mixed document list and include open PR, active RFQ, open PO, pending receiving, invoice exception, three-way match exception, total open amount, currency, and urgent followup counts.

## Reuse Notes

Global Search and deterministic AI already have procurement-specific mapping logic. This pass documents the boundary but does not swap their ranking, card shape, or intent internals. The procurement read model is now the canonical future evidence source once those consumers have contract tests for ordering and presentation.
