# Admin Workbench UI Direction

FlowChain should keep its cockpit and AI strengths while becoming more useful as a daily supply-chain workbench for SMEs.

```text
Overview = Signal
Workbench = Evidence and operations
AI Assistant = Natural language query and guided support
```

## Why This Matters

FlowChain already has strong signal-first and AI-assisted qualities. SME users also need a dependable daily business surface where they can search, filter, compare records, export current results, open details, review status, and follow operational logs. A practical supply-chain system should support both structured filters and natural language AI, because users switch between known-document work and exploratory questions throughout the day.

## What To Learn From Admin Order Centers

Useful admin and order-center patterns include:

- Visible query forms with clear business inputs.
- Table-first record browsing.
- Compact KPI summaries above the workbench when useful.
- Status chips that are easy to scan.
- Row-level view and review actions.
- Export for the current result set.
- Reset and search actions.
- Recent activity or logs where they support follow-up.
- Predictable navigation and stable page structure.
- Confirmation dialogs for risky operations.

## What Not To Copy

FlowChain should not expand into unrelated generic ERP scope. Do not add Customer Center, Sales Order Center, CRM, HR, full finance, GL, payment execution, tax filing, bank integration, generic profit-statistics modules, OCR, or PDF export restoration.

## FlowChain Module Pattern

Today Cockpit:
Daily action queue, urgent procurement/inventory/supplier signals, low-stock and exception signals, recent documents, recent activity or audit log signals, and AI quick entry.

Procurement:
PR, RFQ, PO, receiving, and invoice workbenches with filters by document id, supplier, item, status, owner, date, and source. Export current results and preserve detail panels and evidence.

Inventory:
Filters by SKU, warehouse, risk, batch/bin, and status. Export risk or exception lists. Do not force a full inventory migration before the read API plan is clear.

SRM:
Supplier code/name/category/risk/certification/score filters. Export supplier follow-up or performance lists while keeping scoring and collaboration boundaries clear.

Master Data:
API-first read tables with filters by code/name/status/category and export for the current table.

Finance Collaboration:
Supplier invoice visibility, payable/reconciliation/settlement readiness, and variance review. No GL, payment execution, bank, or tax filing scope.

Reports / Imports:
Report/export and import validation visibility. No broad BI rewrite now.

## Standard Workbench Layout

A workbench page should usually contain:

- Page title and short business subtitle.
- Compact KPI strip if useful.
- Search/filter card.
- Table result card.
- Result count.
- Row actions.
- Export current result.
- Detail side panel or modal.
- Optional recent activity/log panel.
- Floating AI assistant, not a fixed side panel.

## Standard Filter Fields

Procurement / PO:
PO number, supplier, SKU/item, status, source PR/RFQ, owner, ETA/date range, and source type.

PR:
PR number, requester, buyer, supplier, SKU/item, status, priority, and required date range.

RFQ:
RFQ id, supplier, item/category, status, due date, and response status.

SRM:
Supplier code/name, category, risk, certification, score range, open PO flag, and invoice variance flag.

Inventory:
SKU/item, warehouse, risk level, stock status, batch/bin, and exception status.

## Export Guidance

Use labels like `导出当前结果` or `导出`. Existing CSV implementation can remain, but button text should not over-emphasize the file format. Do not restore PDF export. Future `.xlsx` support can be planned later. Export should respect current filters.

## AI And Structured Filters

Users should be able to use traditional filters or ask AI naturally. AI should use the same operational data layer and complement workbench filters, not replace them. Future global search can route PO, supplier, and item queries into the AI resolver and operational search, while PO pages continue to work without AI.

## Near-Term Sequence

1. Purchase Order Center-style workbench pilot.
2. Purchase Request Center-style workbench pilot.
3. SRM Supplier Center-style workbench pilot.
4. Today Cockpit recent activity/log polish.
5. Master Data table filter polish.
6. Inventory read API plan before major inventory UI migration.
7. AI plus global business search integration later.
