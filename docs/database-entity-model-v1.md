# Database Entity Model v1

## Core Entities

- `supplier`: supplier profile, status, risk, category, ownership.
- `item`: SKU, item name, category, unit, preferred supplier, stocking policy.
- `warehouse`: warehouse, zone, location, receiving dock.
- `purchase_request`: PR header, requester, buyer, item, quantity, amount, priority, status.
- `rfq`: RFQ header, source PR, due date, status, awarded supplier.
- `rfq_supplier`: invited supplier, response status, quoted price, lead time, currency.
- `purchase_order`: PO header, supplier, source PR/RFQ, amount, expected date, status.
- `purchase_order_line`: SKU, ordered quantity, received quantity, accepted quantity, rejected quantity, unit price.
- `receiving_doc`: GRN header, PO, supplier, receiver, warehouse, status, posted metadata.
- `receiving_line`: PO line, received quantity, accepted quantity, rejected quantity, quality result.
- `supplier_invoice`: invoice header, supplier, related PO/GRN, amount, status, due date.
- `three_way_match`: invoice, PO, GRN, match status, variance amount.
- `inventory_movement`: movement type, SKU, warehouse, source document, quantity in/out, adjustment.
- `audit_log`: entity type, entity ID, action, actor, source, reason, timestamp, metadata.
- `ai_event`: AI question category, module, intent, card count, elapsed time, created timestamp.

## Relationship Notes

- PR can create RFQ and PO links.
- RFQ can award into PO.
- PO has one or more PO lines and zero or more receiving documents.
- GRN can create inventory movements after posting.
- Supplier invoice links to PO and optionally GRN.
- Three-way match is a derived entity that can be persisted later for workflow ownership.

## Migration Priorities

1. Preserve existing document IDs as external business keys.
2. Add internal UUID primary keys only when needed for joins and multi-tenant isolation.
3. Store amounts as decimal numeric fields plus currency.
4. Store immutable audit records append-only.
5. Keep read models rebuildable from normalized entities.
