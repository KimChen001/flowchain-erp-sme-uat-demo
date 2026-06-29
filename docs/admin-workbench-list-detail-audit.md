# Admin Workbench List / Detail Audit

## Purpose

This is an internal UI audit for FlowChain workbench pages. It defines where document-heavy pages should move from split preview panels to a practical order-center flow, without expanding FlowChain into a generic ERP.

## Target Pattern

```text
List page = search/filter/table/export/row actions
Detail page = full record detail after click
AI assistant = floating natural-language query support
```

## Why This Matters

Full-width tables feel closer to daily business systems: users can search, filter, export, compare, and then open a record when they need evidence or actions. Permanent list and detail split panels make both sides cramped, especially for document-heavy pages with line items, approvals, linked evidence, and status history. Detail should feel like entering a business document, not watching a preview beside a table.

## Module Audit

| Module | Current pattern | Issue | Target pattern | Priority | Implementation risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- |
| Purchase Orders / PO | Filter card, table, and selected detail split beside the list | Table and detail compete for space | Full-width list opens full-width PO detail | High | Medium | Separate list/detail first |
| Purchase Requests / PR | Table plus selected detail side-by-side | PR detail evidence and actions are cramped | Full-width list with filters, then detail view | High | Medium | Add PR filters and split list/detail |
| RFQ / RFx | Table plus selected detail card below | Detail feels like a preview, not a record page | RFQ list opens full-width detail view | High | Medium | Add RFQ filters and split list/detail |
| Receiving / GRN | GRN table, selected detail, ERP document modal, scan and QC modals | Important flow but more modal/action coupling | Planned GRN list/detail after modal flows are isolated | High | Higher | Document follow-up; avoid risky broad refactor now |
| SRM / Supplier Management | Supplier list and SupplierDetailModal | Not primarily a split-panel problem | Stronger supplier filter workbench later | Medium | Medium | Keep modal detail for now |
| Inventory | Operational panels and stock views | Needs structured filters more than list/detail split | Filtered inventory workbench after read API plan | Medium | Higher | Plan read API before major UI migration |
| Master Data | API-first tables with modal/detail affordances | Modal detail acceptable; filters need polish | Table-first workbench with current-result export | Medium | Low | Polish filters later |
| Finance Collaboration | Table-oriented finance collaboration pages | Needs consistency polish, not new finance scope | Table/filter/export consistency | Low | Medium | Defer |
| Reports | Report catalog and exports | Not a record detail split issue | Keep export/catalog focus | Low | Low | Defer |
| Data Management / Imports | Import validation and data management views | Not a document detail split issue | Keep validation-first workbench | Low | Low | Defer |
| Today Cockpit | Signal-first cockpit | Should not become a list/detail page | Add recent documents/activity signals later | Medium | Medium | Add activity polish later |

## Migration Order

1. Purchase Orders
2. Purchase Requests
3. RFQ / RFx
4. Receiving / GRN
5. SRM supplier filters
6. Master Data filters
7. Today Cockpit recent activity/logs
8. Inventory read API plan before major UI migration

## UX Rules

- Do not show permanent list and detail side-by-side for document-heavy pages.
- Clicking a document number or `查看详情` opens detail mode.
- Detail view must have `返回列表`.
- Filters and selected record behavior must be safe when results change.
- Export must respect current filters.
- AI assistant stays floating and complementary.
- Do not restore an old fixed AI side panel.
- Do not introduce customer-visible UAT, demo, sample, fallback, or static-data wording.
