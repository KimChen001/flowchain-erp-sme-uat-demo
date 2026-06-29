# Supplier Operational Search v1

Supplier Operational Search v1 lets AI Chat resolve supplier names or codes and return read-only operational summaries across procurement, finance-facing settlement evidence, contracts, inventory, and RFQs.

## Resolver Rules

- Explicit supplier names or codes in the message win over active context.
- Multiple explicit suppliers produce a comparison, limited to the first three resolved suppliers.
- If no explicit supplier is present, compatible `activeContext.entityType === "supplier"` can be used for prompts like `这个供应商相关的 PO 和发票`.
- Matching is deterministic: supplier id/code, exact normalized name, retained aliases or legacy names, and unambiguous relationship-only supplier names.
- Ambiguous matches return an `ambiguous_match` card instead of guessing.

## Supported Sections

- `purchase_orders`: total, open, overdue, due-soon, and top related POs.
- `invoices`: invoice variance, pending review, credit memo amount, and reconciliation status when available.
- `contracts`: active, expiring, expired, and top contracts when available.
- `inventory`: linked items and item risk where supplier-to-item evidence exists.
- `rfqs`: participation, open RFQs, and pending responses where RFQ evidence exists.

If a section has no reliable data, the response uses limited-data evidence instead of inventing counts.

## Cards

- `supplier_operational_summary`
- `supplier_related_po_summary`
- `supplier_invoice_summary`
- `supplier_contract_summary`
- `supplier_inventory_risk_summary`
- `supplier_rfq_summary`
- `supplier_operational_comparison`

Existing `evidence`, `recommended_actions`, `missing_fields`, `empty_state`, and `ambiguous_match` cards remain reusable.

## Deep Links

Recommended actions are navigation or review only. Safe targets stay inside broad application routes such as `/srm`, `/procurement`, `/inventory`, and supplier-filtered variants when the route is clear.

No action may approve, submit, convert, send, post, adjust inventory, close exceptions, or execute payment.

## Boundary

This feature is deterministic and read-only. It does not call GPT, Doubao, DeepSeek, vector search, semantic search, or external databases. Future LLM usage should be limited to intent and slot extraction before the deterministic resolver and evidence builders run.
