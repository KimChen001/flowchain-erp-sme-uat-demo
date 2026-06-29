# Workbench Experience Consolidation v1

## Purpose

This is an internal product and UI direction note. It is not customer-facing.

FlowChain should keep moving toward a coherent daily-use supply-chain workbench for SMEs: operational signals first, compact filters, readable results, safe document details, and an AI assistant that supports the work without taking over the page.

## Current State

- PO, PR, and RFQ have already moved toward list to detail mode.
- Table readability is being normalized globally with horizontal scroll, stable min widths, no awkward wrapping for IDs/status/actions, and product-friendly export wording.
- The AI Assistant is floating, not a fixed side panel.
- Master Data and SRM supplier identity are API-first.
- Today Cockpit needs more operational daily-work content beyond summary cards.
- Receiving and GRN are high-value but must be refactored carefully because scan, QC, ERP document, stock posting, and exception flows are complex.
- SRM needs stronger supplier-center filters and export behavior.

## Target Pattern

```text
Overview / Today Cockpit = daily signals and follow-up
Workbench list = filter/search/table/export
Document detail = full record detail after click
AI Assistant = natural language query and guided support
```

## Global Workbench Page Pattern

Standard page structure:

- Breadcrumb or module context where useful.
- Page title and short subtitle.
- Primary action button on the right when there is a safe primary action.
- KPI strip only where it helps the operator decide what to do.
- Filter/search card with compact controls.
- Result/table card with readable table layout.
- Result count close to the table/export area.
- Export current result for list/table exports.
- Row-level actions for details and safe next steps.
- Detail view or modal for full record review.
- Empty state with concise product-neutral wording.
- Loading and error state where data is async.
- Floating AI assistant remains available globally.

## Today Cockpit Target

Today Cockpit should show:

- Today's action queue.
- Pending PRs.
- Pending RFQs and supplier responses.
- PO arrivals and overdue POs.
- Receiving exceptions.
- Invoice variances.
- Low-stock and replenishment risk items.
- High-risk suppliers.
- Recent documents.
- Recent activity or audit log.
- AI quick entry.

## Receiving / GRN Target

Receiving should eventually use:

- GRN list page.
- Full GRN detail view.
- Safe scan receive and QC modals.
- No duplicate stock posting.
- No direct mutation of completed receiving without an audit/action flow.
- ERP document modal preserved.

## SRM Supplier Center Target

SRM should feel like a supplier workbench:

- Supplier code/name filter.
- Category filter.
- Risk filter.
- Certification filter.
- Rating/score range.
- Open PO flag.
- Invoice variance flag.
- Reconciliation exception flag.
- Export current result.
- SupplierDetailModal remains acceptable for now.

## Non-goals

- No CRM.
- No Sales Order Center.
- No Customer Center.
- No full finance, GL, payment, tax, or bank features.
- No OCR.
- No PDF export.
- No real AI provider integration in this task.
- No database migration in this task.
