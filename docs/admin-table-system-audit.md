# Admin Table System Audit

## Purpose

This is an internal UI audit. It is not customer-facing.

It defines how FlowChain workbench tables should behave globally so supply chain, procurement, inventory, supplier management, and master-data screens feel like one professional admin system.

## Current Problem

FlowChain tables are implemented manually per module. This gives each workbench useful local control, but it has also created inconsistent table layout behavior.

Wide tables are often compressed into the viewport. Header cells may be `nowrap` while body cells wrap, or the table may have no realistic minimum width. IDs, dates, amount columns, status chips, and action buttons can become visually misaligned. Long supplier, item, or document names can force rows into awkward vertical wrapping.

The result is a system that can feel less like a polished ERP/admin workbench, especially in invoice matching, inventory, master data, and other dense operational tables.

## Target Pattern

```text
Workbench table = filter/search card + result count + full-width table + horizontal scroll when needed + stable row actions + export current result
```

## Global Table Rules

- All table-heavy cards should use `overflow-x-auto`.
- Wide operational tables should set realistic `min-width`.
- IDs should be `whitespace-nowrap`.
- Dates should be `whitespace-nowrap`.
- Amounts should use `whitespace-nowrap tabular-nums`.
- Status chips should not wrap.
- Action columns should use `whitespace-nowrap` and have enough min width.
- Long names should use `max-w-* truncate`, not vertical wrapping.
- 10+ column tables should prefer horizontal scroll over squeezing.
- Export button labels should use `导出当前结果`, `导出`, or `导出详情`, not `导出 CSV`.
- Actual implementation can still use CSV.
- Do not restore PDF export.
- Do not implement xlsx in this task.

## Priority Matrix

| Priority | Module | Files | Findings |
| --- | --- | --- | --- |
| High | Supplier Invoice | `src/modules/procurement/SupplierInvoiceRegister.tsx` | Visible wrapping risk across invoice number, supplier, PO, GRN, dates, amounts, status, variance, and row actions. List export should export the visible filtered result. |
| High | Three-way Match | `src/modules/procurement/ThreeWayMatchPanel.tsx` | Many operational columns need horizontal scroll, amount alignment, stable status chips, and one-line actions. |
| High | Inventory | `src/modules/inventory/Page.tsx` | Multiple wide operational tables need min-widths, truncation for item names, tabular numeric cells, and product-friendly export wording. |
| High | Master Data | `src/modules/master-data/Page.tsx`, `src/modules/master-data/MasterDataTables.tsx` | Many wide master-data variants need consistent min-widths, no-wrap identifiers, action columns, and truncated descriptions. |
| Medium / High | Receiving | `src/modules/receiving/Page.tsx` | Several tables need safe readability classes, but receiving business flow should not be refactored. |
| Medium | Procurement / Purchase Orders | `src/modules/purchasing/Page.tsx` | List/detail behavior is already improved; table classes should align with the global pattern. |
| Medium | Procurement / Purchase Requests | `src/modules/purchase-requests/Page.tsx` | List/detail behavior is already improved; table classes should align with the global pattern. |
| Medium | Procurement / RFQ | `src/modules/rfq/Page.tsx` | List/detail behavior is already improved; RFQ table needs realistic min-width and no-wrap document cells. |
| Medium | SRM | `src/modules/srm/Page.tsx`, `src/modules/srm/SupplierTable.tsx` | Supplier table already has a useful pattern; RFx participation and contracts need min-widths and no-wrap IDs/dates/status. |
| Low / Follow-up | Reports / Data Management / Imports | `src/modules/reports`, `src/modules/imports` | Table-heavy areas should follow the same rules when touched, but they are outside the first high-priority pass. |

## Implementation Plan

- Add lightweight table utility styles as shared class constants.
- Apply the utilities to high-priority and safe medium-priority tables in this pass.
- Keep existing table markup and local rendering behavior.
- Do not convert to a large DataTable framework.
- Do not change business actions, routing, API behavior, or backend persistence.

## Table Layout Residue Pass

The previous table polish improved many high-density screens, but screenshots from Inventory exposed remaining readability issues. This is a global table-system concern, not an inventory-only problem.

Observed residue:

- SKU values can split across lines, for example `SKU-` / `00744`.
- GRN, PO, PR, RFQ, INV, and source document ids can split across lines, for example `GRN-202605-` / `0418`.
- Status chips can split vertically, for example `异常` / `处理` or `待复` / `核`.
- Owner/person names can wrap awkwardly.
- Quantity columns such as 入库 / 出库 / 调整 can become too narrow.
- Action buttons can stack or spread too loosely.
- Horizontal scroll exists in many cards, but min-width and nowrap rules are still too weak in some tables.

High-risk table groups to audit:

1. Inventory: inventory transactions, inventory exception documents, lots, and serials.
2. Receiving / GRN: GRN list, receiving exceptions, and supplier returns / SRN.
3. Supplier Invoice: invoice collaboration table.
4. Three-way Match: match list.
5. SRM: supplier table, RFx participation, contracts, invoice and reconciliation tables where present.
6. Master Data: items, suppliers, warehouses, tax codes, and payment terms.
7. Finance Collaboration: payable, invoice, variance, credit memo, and settlement readiness tables.
8. Reports / Imports / Data Management: data-heavy report and import review tables.
9. Today Cockpit: recent documents, action queue, compact evidence lists.

Standard rules:

- Business IDs should never split across lines.
- SKU should never split into `SKU-` and `00744`.
- GRN, PO, PR, RFQ, and INV ids should stay one line.
- Status chips should stay one-line pills.
- Owner/person names should stay one line or truncate.
- Quantity columns need enough minimum width.
- Action columns need enough minimum width.
- Wide tables should use horizontal scroll instead of compressing identifiers.
- Long descriptions can truncate, but identifiers should not wrap.
- Use `break-keep` for short Chinese labels and chips where useful.
- Use `whitespace-nowrap` for IDs, dates, status, actions, owner, and source documents.
- Use `tabular-nums` for quantity and amount values.
- Keep amount format as full numbers, for example `¥140,000`, not `14万`.
