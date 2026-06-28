# Data Source Audit

## Purpose

This is an internal architecture audit for moving FlowChain from mixed frontend static data and backend JSON runtime data toward backend/API source-of-truth.

The audit is not customer-visible, does not require immediate deletion of frontend static data, and should be used for safe migration planning. It documents current dependencies, backend coverage, duplication risks, and a practical migration sequence. No module migration, runtime data change, API behavior change, AI Chat behavior change, database implementation, RDS, or PolarDB work is implied by this document.

## Current Source Categories

1. Frontend static constants: exported objects and arrays from `src/data/demo-data`.
2. Frontend embedded fixture arrays: module-local arrays used as UI data, options, scoring rows, import templates, and report filters.
3. Backend JSON runtime data: mutable JSON state loaded through `server/repositories/json-db.mjs` from `data/scm-demo.json`.
4. Backend domain helpers: normalization, scoring, workflow, inventory, master data, receiving, purchasing, MRP, and AI query helpers.
5. Backend REST APIs: current HTTP routes under `server/routes`.
6. AI Chat cards/evidence: backend `/api/ai/chat` responses grounded in backend domain helpers, active context, and read-only operational evidence.
7. Future database persistence: a later persistence provider after source ownership and API shapes stabilize.

## Audit Summary Table

| Module | Current frontend data source | Backend API/domain coverage | AI Chat dependency | ActiveContext dependency | Write behavior | Migration readiness | Risk | Recommended next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Today Cockpit / Overview | Mixed: imports `FORECAST_SKUS`, `INVENTORY_MOVEMENT_LEDGER`, `inventoryItems`, `purchaseOrders`, `receivingDocs`, `RFQS`, `PORTAL_SUPPLIERS`, returns, invoices, credit memos, reconciliation data; also fetches API snapshots. | Partial API reads for POs, PRs, RFQs, receiving docs, supplier performance; domain coverage through purchasing, receiving, inventory, supplier scoring, and AI operational queries. | Medium: overview concepts overlap with AI cards and evidence. | Medium: selected operational entity can drive AI context. | Frontend read-only dashboard; linked modules can write through APIs. | partial | medium | Keep current mixed dashboard until each card has an API-backed source map; migrate one summary card at a time. |
| Procurement Workbench | Static-heavy: imports contracts, portal suppliers, returns, RFQs, supplier invoices, POs, receiving docs; panels import invoice, payables, reconciliation, return, and contract constants. | Partial: PR, RFQ, PO, receiving, supplier recommendations, supplier performance, inventory movements, workflow/audit helpers. Finance/procurement settlement panels remain mostly frontend static. | High: AI procurement query and RFQ query can answer operational questions from backend runtime data. | High: workbench entities are likely active context targets. | Mixed: workbench panels mostly read-only; linked PR/RFQ/PO/receiving APIs write JSON runtime. | partial | high | Split operational procurement from finance/settlement panels; migrate RFQ/PR/PO reads after response shapes are stable. |
| Purchase Requests | Imports owners, SKU catalog, supplier list, and purchase orders from static data for creation helpers and reference context; fetches PRs from API. | Strong route coverage for `GET /api/purchase-requests`, `POST /api/purchase-requests`, `PATCH /api/purchase-requests/:id/status`, `POST /api/purchase-requests/:id/convert-to-po`, supplier recommendations, RFQ creation. | High: AI procurement operational query depends on PR status, blockers, and related PO/RFQ evidence. | High: PR IDs can be active context. | Writes JSON runtime for create, status transition, convert to PO, and downstream workflow/audit events. | partial | medium | Make API response shape the primary list source, then replace static SKU/supplier lookup references with master-data APIs. |
| Purchasing / Purchase Orders | Imports procurement trend, static purchase orders, receiving docs, supplier invoices, and modal reference data; fetches POs from API. | Strong route coverage for `GET /api/purchase-orders`, `POST /api/purchase-orders`, `PATCH /api/purchase-orders/:id/status`; PO creation from PR conversion and RFQ award also exists. | High: AI procurement evidence depends on PO status, lines, supplier, and receiving progress. | High: PO IDs can be active context and link to PR/RFQ/GRN evidence. | Writes JSON runtime for create/status/line updates and downstream workflow/audit events. | partial | medium | Keep PO list API-backed; migrate modal reference data to master-data APIs before removing static PO helpers. |
| RFQ | Imports `RFQS` as static fallback/reference; fetches RFQs from API and can patch status. | Strong route coverage for `GET /api/rfqs`, `POST /api/rfqs`, `PATCH /api/rfqs/:id/status`; RFQ award can create PO through backend workflow. | High: AI RFQ operational query uses backend RFQ evidence. | High: RFQ IDs and source PRs can be active context. | Writes JSON runtime for RFQ creation, status changes, award-to-PO, workflow, and audit events. | partial | medium | Keep RFQ list API-first; verify frontend fields against route response before removing static fallback. |
| Receiving | Imports arrival schedule, static POs, QC exceptions, receiving docs, and supplier invoices; fetches receiving docs and POs from APIs. | Strong route coverage for `GET /api/receiving-docs`, `POST /api/receiving-docs`, `PATCH /api/receiving-docs/:id`; receiving domain can apply posted GRNs to PO and inventory movement state. | Medium: AI procurement answers may include receiving/GRN blockers. | Medium: GRN and PO context should align with backend IDs. | Writes JSON runtime for GRN create/update/posting, PO receiving progress, inventory application, workflow, and audit events. | partial | high | Separate operational GRN lifecycle from static schedule/QC/invoice displays; migrate only posted receiving status cards first. |
| Inventory | Static-heavy: imports inventory items, movements, lots, transfers, variances, forecast SKUs, and PR helpers; domain exception/planning helpers also import static ledgers. | Partial: `GET /api/inventory-movements`, MRP route, inventory domain helpers, receiving inventory application; no full inventory item/balance REST endpoint found outside master-data item reads and MRP. | Medium: AI inventory status uses backend/domain inventory evidence where available. | Medium: item/SKU active context should map to backend item IDs. | Inventory module can create PRs through `/api/purchase-requests`; receiving can write movement state. | defer | high | Audit inventory card fields and define item/balance endpoints before replacing static exception, lot, transfer, and variance data. |
| SRM / Supplier Management | Imports contracts and RFQs in SRM; `suppliers/Page.tsx` imports monthly procurement, procurement data, and supplier data; procurement portal imports portal suppliers. | Partial: master-data suppliers, supplier performance, supplier recommendations, supplier score helpers, AI supplier status query. | High: supplier status and recommendation cards depend on supplier concepts. | High: supplier ID/name is a core active context entity. | Mostly read-only in frontend; backend recommendations/performance are read-only. | partial | medium | Migrate supplier list/detail reads to master-data supplier APIs after response shape alignment; preserve frontend-only scoring until backend parity exists. |
| Master Data | Uses static/imported tables and overview entries; domain helpers import master constants from `src/data/demo-data`. | Ready for read migration: `GET /api/master-data/items`, item detail, suppliers, supplier detail, warehouses, payment terms, tax codes. | High: AI active context and status answers depend on item and supplier concepts. | High: item and supplier IDs should come from backend source where possible. | Current master-data APIs are read-only. | ready | low | First migration candidate: backend-read one low-risk table or detail panel; keep JSON provider and static fallback unchanged. |
| Finance | Imports purchase returns, supplier credit memos, reconciliation statements, payables, supplier invoices; finance summary derives from static constants. | Limited direct API coverage; procurement settlement concepts overlap with POs, receiving docs, audit log, and future backend aggregation. | Low to medium: finance visibility can be evidence, but AI write/draft behavior should not be expanded now. | Low to medium: invoice/supplier context may need alignment later. | Frontend read-only today; no broad finance write APIs found. | blocked | high | Defer until backend aggregation endpoints for invoices, payables, returns, and reconciliation exist. |
| Reports | Static-heavy plus API-backed sections: imports report constants from demo data, embedded report filters/months/methods, and fetches PRs, forecast plans, MRP plan, audit log. | Partial: PRs, forecast plans, MRP plan, audit log; missing broad report aggregation APIs. | Medium: reports can expose evidence also used by AI but should remain read-only. | Low to medium: selected report rows can reference PR/SKU/supplier IDs. | Frontend read-only, except source modules write through their APIs. | partial | medium | Keep existing API-backed report sections; move derived aggregation backend-side only after source modules migrate. |
| Data Management / Imports | Embedded import configs, supported statuses, supported reasons, templates, and validation options in `src/modules/imports/Page.tsx`. | No import REST endpoints found. Backend JSON repository exists but should not be written by frontend import migration in this phase. | Low: AI Chat should not infer business truth from import fixtures. | Low. | Frontend import tooling appears local/read-oriented in current audit. | defer | medium | Document import schemas separately before any write path; do not connect imports to runtime JSON yet. |
| AI Assistant | Frontend quick prompts and UI state are embedded; business answers come from backend `/api/ai/chat`. | Strong backend-first coverage: `/api/ai/tools`, `/api/ai/chat`, active-context, status, RFQ/procurement operational query, confidence, draft preparation, provider adapter skeleton. | Primary dependency: backend cards/evidence are the business answer source. | High: active context is passed to backend and should align with backend IDs. | Chat endpoint returns answers and review-only draft preparation; it should not submit/approve/convert/send/post. | ready | low | Keep AI Chat backend-first; align activeContext IDs as modules migrate to APIs. |

## Module-Level Details

### Module: Today Cockpit / Overview

- Current data source: mixed. `src/modules/overview/Page.tsx` imports static forecasting, inventory, PO, receiving, RFQ, supplier portal, return, invoice, credit memo, and reconciliation constants while also fetching live snapshots from procurement APIs.
- Key imported constants / embedded fixtures: `FORECAST_SKUS`, `INVENTORY_MOVEMENT_LEDGER`, `inventoryItems`, `purchaseOrders`, `receivingDocs`, `RFQS`, `PORTAL_SUPPLIERS`, `PURCHASE_RETURNS`, `SUPPLIER_CREDIT_MEMOS`, `SUPPLIER_INVOICES`, `SUPPLIER_RECONCILIATION_STATEMENTS`, plus embedded action rows, decision cards, risk cards, KPIs, pulse rows, and quick links.
- Backend API/domain coverage: PR, PO, RFQ, receiving, supplier performance, inventory movement, MRP, and AI procurement/RFQ query helpers cover many operational concepts.
- Current gaps: not every dashboard card has a single backend source; many derived indicators combine static constants and fetched arrays.
- Migration recommendation: migrate card by card, starting with a card whose backend endpoint already returns complete fields.
- Suggested first migration step: document the source of each cockpit card and mark whether it is static, API, derived, or mixed.
- What not to change yet: do not remove static dashboard constants or change dashboard fallback behavior.

### Module: Procurement Workbench

- Current data source: static-heavy. `src/modules/procurement/Page.tsx` and child panels import contracts, portal suppliers, returns, RFQs, invoices, POs, receiving docs, payables, credit memos, and reconciliation statements.
- Key imported constants / embedded fixtures: `CONTRACTS`, `PORTAL_SUPPLIERS`, `PURCHASE_RETURNS`, `RFQS`, `SUPPLIER_INVOICES`, `purchaseOrders`, `receivingDocs`, `PAYABLES`, `SUPPLIER_CREDIT_MEMOS`, `SUPPLIER_RECONCILIATION_STATEMENTS`; embedded workflow paths and panel queue logic.
- Backend API/domain coverage: PR, PO, RFQ, receiving, supplier recommendations, supplier performance, inventory movements, workflow, audit, and AI operational queries. Settlement, invoice, contract, and reconciliation APIs are not present as full backend sources.
- Current gaps: workbench queue and finance panels can disagree with runtime PR/RFQ/PO/GRN state.
- Migration recommendation: split operational procurement records from finance settlement/read-model cards before migrating.
- Suggested first migration step: use backend PO/RFQ/receiving reads only for an operational queue prototype, without changing panel behavior.
- What not to change yet: do not migrate invoice, payables, reconciliation, contract, or return panels in the same step.

### Module: Purchase Requests

- Current data source: API-backed list/write path with static reference helpers. `src/modules/purchase-requests/Page.tsx` imports `OWNERS`, `SKU_CATALOG`, `SUPPLIER_LIST`, and `purchaseOrders`.
- Key imported constants / embedded fixtures: static owner, SKU, supplier, purchase order references; embedded header rows and creation line rows.
- Backend API/domain coverage: PR list/create/status/convert routes, supplier recommendation route, RFQ create route, purchasing/workflow domain helpers, audit events.
- Current gaps: static SKU and supplier lookup values can diverge from master-data APIs and backend JSON runtime.
- Migration recommendation: keep PR API as primary transactional source and migrate reference data to master-data APIs.
- Suggested first migration step: compare `SKU_CATALOG` and `SUPPLIER_LIST` fields against `/api/master-data/items` and `/api/master-data/suppliers`.
- What not to change yet: do not change convert-to-PO workflow or status transition behavior.

### Module: RFQ

- Current data source: mixed. `src/modules/rfq/Page.tsx` imports `RFQS` and fetches `/api/rfqs`.
- Key imported constants / embedded fixtures: static `RFQS`, local status/action display logic.
- Backend API/domain coverage: RFQ list/create/status, award-to-PO generation, workflow transitions, AI RFQ operational query.
- Current gaps: frontend display shape and backend runtime shape need field-by-field verification before removing static fallback.
- Migration recommendation: keep backend as the transactional source and gradually narrow static fallback usage.
- Suggested first migration step: add an internal field map from RFQ page columns to `/api/rfqs` response fields.
- What not to change yet: do not change RFQ award behavior, PO generation, or AI RFQ answers.

### Module: Purchasing / Purchase Orders

- Current data source: mixed. `src/modules/purchasing/Page.tsx` imports static procurement trend, purchase orders, receiving docs, and supplier invoices while fetching runtime purchase orders from `/api/purchase-orders`. `NewPOModal.tsx` imports owner, SKU, and supplier reference constants.
- Key imported constants / embedded fixtures: `procurementTrend`, `purchaseOrders`, `receivingDocs`, `SUPPLIER_INVOICES`, `OWNERS`, `SKU_CATALOG`, `SUPPLIER_LIST`, local status order, export header rows, and shipment modal step arrays.
- Backend API/domain coverage: purchase order list/create/status routes, PO creation through PR conversion and RFQ award, purchasing normalization helpers, workflow validation, audit events, and receiving linkage.
- Current gaps: modal reference values and some trend/invoice displays remain frontend static; API-backed PO rows may not cover every presentation-only field.
- Migration recommendation: keep `/api/purchase-orders` as the operational source and move reference selectors toward master-data APIs before removing static PO data.
- Suggested first migration step: map PO page columns and modal fields to `/api/purchase-orders`, `/api/master-data/items`, and `/api/master-data/suppliers`.
- What not to change yet: do not change PO status transitions, PR/RFQ-generated PO behavior, or receiving linkage.

### Module: Receiving

- Current data source: mixed. `src/modules/receiving/Page.tsx` imports schedule, PO, QC exception, receiving doc, and supplier invoice data while fetching runtime receiving docs and POs.
- Key imported constants / embedded fixtures: `arrivalSchedule`, `purchaseOrders`, `qcExceptions`, `receivingDocs`, `SUPPLIER_INVOICES`, plus embedded logistics/status arrays.
- Backend API/domain coverage: receiving list/create/patch, PO read/status, receiving normalization, GRN line normalization, posting protection, inventory application, workflow/audit events.
- Current gaps: arrival schedule, QC exception, and invoice visibility are not fully backend-owned.
- Migration recommendation: separate GRN operational status from logistics/invoice panels.
- Suggested first migration step: migrate a receiving status card to runtime `/api/receiving-docs` and `/api/purchase-orders` only.
- What not to change yet: do not alter posted GRN protection, inventory application, or receiving write rules.

### Module: Inventory

- Current data source: static-heavy. `src/modules/inventory/Page.tsx`, `InventoryMovementLedger.tsx`, and `src/domain/inventory/exceptions.ts` import inventory constants from `src/data/demo-data`.
- Key imported constants / embedded fixtures: inventory items, movement ledger, lots, transfers, variances, forecast SKUs, and embedded ABC/XYZ, tab, summary, and exception calculations.
- Backend API/domain coverage: `GET /api/inventory-movements`, MRP route, inventory helpers, receiving-to-inventory application, master-data item reads. Full inventory item/balance, lot, transfer, variance, and exception APIs were not found.
- Current gaps: static exception and risk calculations likely duplicate backend/domain concepts.
- Migration recommendation: defer broad migration until item/balance and exception endpoint shapes exist.
- Suggested first migration step: define read contracts for inventory position, movement ledger, lot status, transfer status, variance, and exception cards.
- What not to change yet: do not replace inventory calculations or delete static ledgers in this phase.

### Module: SRM / Supplier Management

- Current data source: mixed and static-heavy. `src/modules/srm/Page.tsx` imports `CONTRACTS` and `RFQS`; `src/modules/suppliers/Page.tsx` imports monthly procurement, procurement data, and supplier data; supplier portal panels use `PORTAL_SUPPLIERS`.
- Key imported constants / embedded fixtures: `CONTRACTS`, `RFQS`, `PORTAL_SUPPLIERS`, `monthlyProcurement`, `procurementData`, `supplierData`, scoring rule arrays.
- Backend API/domain coverage: master-data suppliers, supplier recommendations, supplier performance, supplier score helpers, AI supplier status and procurement evidence.
- Current gaps: frontend scoring/workbench displays may not match backend supplier performance shape.
- Migration recommendation: migrate supplier list/detail reads after confirming field parity, then preserve frontend-only scoring until backend scoring is complete.
- Suggested first migration step: compare supplier cards to `/api/master-data/suppliers` and `/api/supplier-performance`.
- What not to change yet: do not change scoring display semantics or supplier recommendation formulas.

### Module: Master Data

- Current data source: static/imported tables and helpers. `src/modules/master-data/Page.tsx`, `MasterDataOverview.tsx`, `src/domain/master-data/helpers.ts`, and `src/domain/finance/tax.ts` depend on frontend master constants.
- Key imported constants / embedded fixtures: item, supplier, warehouse, payment term, tax code, and supporting reference constants from `src/data/demo-data`.
- Backend API/domain coverage: `/api/master-data/items`, `/api/master-data/items/:id`, `/api/master-data/suppliers`, `/api/master-data/suppliers/:id`, `/api/master-data/warehouses`, `/api/master-data/payment-terms`, `/api/master-data/tax-codes`.
- Current gaps: current backend master-data APIs are read-only; write behavior and persistence provider decisions are intentionally out of scope.
- Migration recommendation: first backend-read migration candidate.
- Suggested first migration step: migrate one low-risk read-only table or detail panel to master-data API reads while keeping current static fallback untouched.
- What not to change yet: do not add master-data writes, persistence provider abstraction, RDS, or database schema.

### Module: Finance

- Current data source: static-heavy. Finance modules import supplier invoices, payables, returns, credit memos, and reconciliation statements.
- Key imported constants / embedded fixtures: `PURCHASE_RETURNS`, `SUPPLIER_CREDIT_MEMOS`, `SUPPLIER_RECONCILIATION_STATEMENTS`, `PAYABLES`, `SUPPLIER_INVOICES`, and derived finance payables.
- Backend API/domain coverage: indirect only through PO, receiving, audit, supplier, and master-data routes; no full finance settlement, invoice, AP, payment, tax, bank, or reconciliation APIs were found.
- Current gaps: invoice and settlement visibility can duplicate PO/receiving state but lacks backend ownership.
- Migration recommendation: block broad migration until backend aggregation and finance read APIs exist.
- Suggested first migration step: document desired finance read models and their source entities.
- What not to change yet: do not add payment, bank, tax integration, GL, OCR, or finance write APIs.

### Module: Reports

- Current data source: mixed. Reports import static data and fetch PRs, forecast plans, MRP plan, and audit log.
- Key imported constants / embedded fixtures: demo data imports, report filters, month labels, forecast method arrays, merged local rows.
- Backend API/domain coverage: `/api/purchase-requests`, `/api/forecast-plans`, `/api/mrp-plan`, `/api/audit-log`; MRP and audit domain helpers.
- Current gaps: most report aggregations are still frontend-derived and depend on static inputs.
- Migration recommendation: migrate report sections only after source modules have backend ownership.
- Suggested first migration step: keep current API-backed report sources and document remaining static-derived report tiles.
- What not to change yet: do not introduce broad report aggregation APIs before source-of-truth ownership is settled.

### Module: Data Management / Imports

- Current data source: embedded frontend configuration in `src/modules/imports/Page.tsx`.
- Key imported constants / embedded fixtures: `IMPORT_CONFIGS`, module filters, required/optional fields, supported statuses, supported settlement statuses, supported reasons, and generated headers.
- Backend API/domain coverage: no import route was found; JSON DB repository exists but is not an import API.
- Current gaps: imports are not connected to a backend validation/write contract.
- Migration recommendation: defer runtime import integration.
- Suggested first migration step: create an internal import schema map that names target backend entities and validation ownership.
- What not to change yet: do not write imported records into `data/scm-demo.json` or add broad import write APIs.

### Module: AI Assistant

- Current data source: frontend has prompt/UI constants, but business answers are backend-driven through `/api/ai/chat`.
- Key imported constants / embedded fixtures: quick prompts and contextual quick prompts in `src/modules/ai-assistant/Panel.tsx`.
- Backend API/domain coverage: `/api/ai/tools`, `/api/ai/chat`, active context, AI status helpers, AI procurement operational query, AI RFQ operational query, confidence, review-only draft preparation, provider adapter skeleton.
- Current gaps: active context IDs can still come from modules using frontend static data.
- Migration recommendation: keep AI Chat backend-first and align activeContext sources as frontend modules migrate.
- Suggested first migration step: ensure selected supplier, item, PR, RFQ, PO, and GRN IDs passed to AI are backend IDs wherever the module already fetches backend data.
- What not to change yet: do not let frontend static data generate business answers, and do not add AI submit/approve/convert/send/post actions.

## Backend Endpoint And Domain Coverage

| Endpoint / domain helper | Module | Data source | Read/write | Used by frontend? | Used by AI Chat? | Migration relevance | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /api/me` | Context | Backend context helper | Read | Not found in audited frontend modules | Indirect context concept | Medium | Returns current user, tenant, and permissions context. |
| `GET /api/tenants/current` | Context | Backend context helper | Read | Not found in audited frontend modules | Indirect context concept | Medium | Tenant context endpoint exists. |
| `/api/context` | Context | Not found | N/A | No | Needs verification | Low | No matching route found during this audit. |
| `GET /api/ai/tools` | AI Assistant | Backend AI tool registry | Read | Not found in frontend usage scan | Yes | Medium | Controlled tool registry. |
| `POST /api/ai/chat` | AI Assistant | Backend AI routes/domain helpers | Read-style response; no business write action | Yes | Yes | High | Main AI Chat path; keep backend-first. |
| `GET /api/audit-log` | Reports / UI audit | Backend audit repository / JSON runtime | Read | Yes | Possible evidence | Medium | Existing endpoint is `/api/audit-log`; `/api/audit` was not found. |
| `GET /api/master-data/items` | Master Data / Inventory | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Yes, conceptually | High | Returns `{ items }`. Strong first migration candidate. |
| `GET /api/master-data/items/:id` | Master Data / Inventory | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Yes, conceptually | High | Returns `{ item }` or 404. |
| `GET /api/master-data/suppliers` | Master Data / SRM | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Yes, conceptually | High | Returns `{ suppliers }`. Strong first migration candidate. |
| `GET /api/master-data/suppliers/:id` | Master Data / SRM | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Yes, conceptually | High | Returns `{ supplier }` or 404. |
| `GET /api/master-data/warehouses` | Master Data / Inventory | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Possible | Medium | Returns `{ warehouses }`. |
| `GET /api/master-data/payment-terms` | Master Data / Finance | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Possible | Medium | Returns `{ paymentTerms }`. |
| `GET /api/master-data/tax-codes` | Master Data / Finance | Backend master-data domain over JSON runtime | Read | Not yet broadly used in scanned modules | Possible | Medium | Returns `{ taxCodes }`. |
| `GET /api/purchase-requests` | Purchase Requests / Reports / Overview | JSON runtime via procurement route | Read | Yes | Yes | High | Existing frontend use; API-backed read path. |
| `POST /api/purchase-requests` | Purchase Requests / Forecast / Inventory / App | JSON runtime write | Write | Yes | No direct AI write | High | Creates PR, workflow/audit events; preserve behavior. |
| `PATCH /api/purchase-requests/:id/status` | Purchase Requests | JSON runtime write | Write | Yes | No direct AI write | High | Status transitions use workflow validation. |
| `POST /api/purchase-requests/:id/convert-to-po` | Purchase Requests / Purchasing | JSON runtime write | Write | Yes | No direct AI write | High | Creates PO after approved PR; do not change in read migration. |
| `GET /api/purchase-orders` | Purchasing / Overview / Receiving | JSON runtime via purchasing route | Read | Yes | Yes | High | Existing frontend use; normalize purchase orders. |
| `POST /api/purchase-orders` | Purchasing / Forecast | JSON runtime write | Write | Yes | No direct AI write | High | Creates PO and workflow/audit events. |
| `PATCH /api/purchase-orders/:id/status` | Purchasing | JSON runtime write | Write | Yes | No direct AI write | High | Status/line updates with workflow validation. |
| `GET /api/rfqs` | RFQ / Overview | JSON runtime via RFQ route | Read | Yes | Yes | High | Existing frontend use. |
| `POST /api/rfqs` | RFQ / Purchase Requests | JSON runtime write | Write | Yes | No direct AI write | High | Creates RFQ and workflow/audit events. |
| `PATCH /api/rfqs/:id/status` | RFQ | JSON runtime write | Write | Yes | No direct AI write | High | Award can create PO and convert RFQ. |
| `GET /api/receiving-docs` | Receiving / Overview | JSON runtime via receiving route | Read | Yes | Yes, indirectly | High | Existing frontend use; normalizes GRN lines. |
| `POST /api/receiving-docs` | Receiving | JSON runtime write | Write | Yes | No direct AI write | High | Creates GRN; may apply receiving if posted. |
| `PATCH /api/receiving-docs/:id` | Receiving | JSON runtime write | Write | Yes | No direct AI write | High | Updates/posts GRN, applies inventory, protects posted docs. |
| `GET /api/supplier-recommendations` | PR / SRM | Backend supplier recommendation helper over JSON runtime | Read | Yes | Possible | Medium | Used during PR supplier recommendation. |
| `GET /api/supplier-performance` | Overview / Procurement / SRM | Backend supplier score/performance helper over JSON runtime | Read | Yes | Yes, conceptually | High | Good SRM migration support. |
| `GET /api/inventory-movements` | Inventory | JSON runtime inventory movements | Read | Not found in audited frontend usage | Possible | Medium | Endpoint exists but inventory UI still imports static ledger. |
| `GET /api/mrp-plan` | Forecast / Reports / Inventory planning | Backend MRP helper over JSON runtime plus route-local profiles/BOM | Read | Yes | Possible | Medium | Existing frontend use; route has embedded planning profiles. |
| `GET /api/forecast-plans` | Forecast / Reports | Legacy route over JSON runtime | Read | Yes | Possible | Medium | Existing frontend use. |
| `POST /api/forecast-plans` | Forecast | Legacy route writes JSON runtime | Write | Yes | No direct AI write | Medium | Creates saved forecast plan. |
| `GET /api/external-signals` | Market / AI evidence | Route-local demo external signal cache | Read | Not found in audited frontend usage | Possible | Low | Demo signal endpoint, not real external intelligence. |
| `GET /api/market-prices` | Market / Procurement evidence | JSON runtime market prices with demo provenance | Read | Not found in audited frontend usage | Possible | Low | Demo market signal source. |
| `POST /api/market-prices/refresh` | Market | JSON runtime write | Write | Not found in audited frontend usage | Possible | Low | Refreshes demo market prices. |
| `GET /api/sop-cycle` | S&OP / Planning | JSON runtime plus MRP/supplier helpers | Read | Not found in audited frontend usage | Possible | Low | Existing route, but no current module row depends on it directly. |
| `POST /api/sop-cycle` | S&OP / Planning | JSON runtime write | Write | Not found in audited frontend usage | No direct AI write | Low | Saves S&OP cycle. |
| `POST /api/auth/login` | Auth / App shell | Legacy route | Write-like auth response | Yes | No | Medium | Used by `FlowChainApp.tsx`. |
| `GET /api/auth/me` | Auth | Legacy route | Read | Not found in audited frontend usage | No | Low | Legacy auth current-user route. |
| `GET /api/health` | Runtime | Legacy route | Read | Not found in audited frontend usage | No | Low | Health endpoint. |
| `ai-active-context.mjs` | AI Assistant | Backend domain helper | Read/derive | Indirect through chat payload | Yes | High | Active context should align with backend IDs. |
| `ai-procurement-operational-query.mjs` | Procurement / AI | Backend domain helper | Read/derive | No direct frontend route | Yes | High | Read-only procurement evidence for AI. |
| `ai-rfq-operational-query.mjs` | RFQ / AI | Backend domain helper | Read/derive | No direct frontend route | Yes | High | Read-only RFQ evidence for AI. |
| `ai-draft-preparation.mjs` | AI Assistant | Backend domain helper | Read/derive draft | Through `/api/ai/chat` | Yes | Medium | Review-only draft preparation; no submit action. |
| `master-data.mjs` | Master Data / SRM / Inventory | Backend domain over JSON runtime | Read/normalize | Through master-data routes | Yes, conceptually | High | Strong candidate for frontend read migration. |
| `inventory.mjs` | Inventory / Receiving | Backend domain over JSON runtime | Read/write helper | Through receiving and inventory movement routes | Possible | Medium | Receiving can apply inventory changes; full inventory REST coverage incomplete. |
| `purchasing.mjs` | Purchasing / Procurement | Backend domain over JSON runtime | Read/write helper | Through PO/PR/RFQ routes | Yes | High | Normalization and PO line helpers. |
| `receiving.mjs` | Receiving / Inventory | Backend domain over JSON runtime | Read/write helper | Through receiving routes | Possible | High | GRN normalization and inventory application. |
| `supplier-score.mjs` | SRM | Backend domain over JSON runtime | Read/derive | Through supplier performance/recommendation | Yes, conceptually | High | Supports SRM migration but frontend scoring parity needs review. |
| `workflow.mjs` | Procurement / Receiving | Backend domain over JSON runtime | Write validation/history | Through transactional routes | No direct AI write | High | Preserve behavior during read migrations. |
| `json-db.mjs` | Runtime data | `data/scm-demo.json` | Read/write repository | Backend only | Backend only | High | Current JSON provider; do not modify runtime file in this task. |

## Duplicated Entity Risk

| Entity concept | Current duplicate locations | Source-of-truth target | Migration risk | Suggested cleanup order |
| --- | --- | --- | --- | --- |
| Suppliers | `src/data/demo-data`, SRM/suppliers/procurement panels, master-data supplier APIs, supplier performance helpers | Backend master-data supplier APIs plus supplier performance domain | medium | Master Data supplier reads, then SRM supplier detail, then scoring displays. |
| Items / SKUs | `SKU_CATALOG`, `FORECAST_SKUS`, inventory items, master-data item APIs, MRP product data | Backend master-data item APIs, then inventory/MRP read models | high | Master Data item reads first, then PR SKU selectors, then inventory/MRP alignment. |
| Warehouses / bins | Static inventory/warehouse constants, master-data warehouses, receiving warehouse mapping | Backend warehouse references and inventory balance endpoints | medium | Master-data warehouse read migration before inventory balance work. |
| Purchase requests | Static PR-adjacent references, backend `purchaseRequests`, reports, AI evidence | Backend PR APIs and workflow domain | medium | Keep API primary, remove static lookup dependencies after master-data reference migration. |
| RFQs | Static `RFQS`, backend `rfqs`, procurement panels, AI RFQ query | Backend RFQ APIs and workflow domain | medium | Verify RFQ response fields, migrate RFQ page fully, then workbench RFQ queue. |
| Purchase orders | Static `purchaseOrders`, backend `purchaseOrders`, receiving/procurement panels, reports | Backend PO APIs and purchasing domain | high | Stabilize PO read shape, then receiving PO selector, then dashboard/workbench cards. |
| Receiving docs | Static `receivingDocs`, backend `receivingDocs`, receiving panels, overview, procurement panels | Backend receiving APIs and receiving domain | high | Migrate operational GRN state first; defer logistics/QC/invoice static fixtures. |
| Inventory movements | Static `INVENTORY_MOVEMENT_LEDGER`, backend inventory movement route, receiving inventory application | Backend inventory movement APIs/domain | high | Define ledger response shape, then migrate ledger page, then exception/risk cards. |
| Supplier scoring | Frontend scoring arrays, supplier data, backend supplier performance/recommendations | Backend supplier performance/scoring domain | medium | Compare dimensions and thresholds, then migrate SRM displays with parity tests. |
| Finance settlement / invoice visibility | Static invoices, payables, returns, credit memos, reconciliation; PO/receiving backend data | Future backend finance read models | high | Defer until finance aggregation APIs exist; do not infer AP truth from static fixtures. |
| Reports | Static report fixtures plus API-backed PR/forecast/MRP/audit sections | Backend aggregation APIs after source modules migrate | medium | Keep mixed reports, migrate only sections whose source entities are backend-owned. |

## Recommended Migration Sequence

### Phase A: Audit Complete

- Create this document.
- Keep the task documentation-only.
- Preserve current UI/API/runtime behavior.

### Phase B: Master Data Frontend Read Migration

- Migrate one low-risk read-only table or detail panel to backend API.
- Use `/api/master-data/items`, `/api/master-data/suppliers`, `/api/master-data/warehouses`, `/api/master-data/payment-terms`, or `/api/master-data/tax-codes`.
- Keep fallback data only if needed.
- Do not add write behavior.

### Phase C: SRM Supplier Read Path Migration

- Move supplier list/detail reads to backend master-data and supplier performance APIs.
- Preserve frontend scoring displays if backend parity is not ready.
- Avoid changing supplier recommendation formulas in the same phase.

### Phase D: AI ActiveContext Alignment

- Ensure selected supplier, item, PR, RFQ, PO, and GRN IDs come from backend sources where possible.
- Keep AI Chat backend-first through `/api/ai/chat`.
- Do not let frontend static data generate business answers.

### Phase E: Procurement Read Migration

- Gradually migrate RFQ, PR, PO, and receiving reads.
- Keep AI query domain read-only.
- Preserve transactional route behavior and workflow validation.

### Phase F: Inventory Read Migration

- Migrate item position, risk, movements, exceptions, lots, transfers, and variances only after endpoint coverage improves.
- Start with `GET /api/inventory-movements` field parity before replacing static ledgers.

### Phase G: Reports / Finance Migration

- Add backend aggregation first, then move UI sections.
- Defer finance settlement, invoice, payable, credit memo, and reconciliation migration until backend read models exist.

### Phase H: Data Seed Cleanup

- Move static fixtures into an explicit fixture/seed location when modules no longer depend on them as runtime truth.
- Avoid runtime/static duplication.
- Keep seed loading explicit for development.

### Phase I: Persistence Provider / Database Transition

- Add database-backed persistence only after source-of-truth and API shapes stabilize.
- RDS, PolarDB, PostgreSQL, or MySQL should wait until schema boundaries are clear.

## Do Not Do Now

- Do not delete `src/data/demo-data`.
- Do not delete frontend fallback constants.
- Do not migrate everything to APIs in one commit.
- Do not add RDS or PolarDB.
- Do not add PostgreSQL or MySQL.
- Do not implement a persistence provider abstraction.
- Do not implement broad write APIs.
- Do not implement save draft.
- Do not implement submit, approve, convert, send, post, or auto-action behavior through AI.
- Do not add full RBAC.
- Do not add a workflow engine.
- Do not restore PDF export.
- Do not add CRM, HR, GL, payment, tax, bank, or OCR scope.
- Do not change customer-visible wording to expose demo, sample, or UAT implementation labels.

## Acceptance Criteria

This audit answers:

- Which modules still appear frontend-static-data-heavy: Procurement Workbench, Inventory, Finance, SRM/Supplier Management, Reports, Data Management/Imports, and parts of Today Cockpit / Overview.
- Which modules are already backend/API-backed: AI Assistant is backend-first; Purchase Requests, Purchasing/PO, RFQ, Receiving, Forecast saved plans, MRP, audit log, and Master Data have meaningful API coverage.
- Which modules can migrate first: Master Data read-only tables/details first, then SRM supplier reads, then selected PR/RFQ/PO/receiving read surfaces.
- Which migrations are risky: Inventory, receiving operational plus QC/logistics, procurement finance/settlement panels, Finance, and report aggregations.
- Which APIs already exist: listed in the backend endpoint coverage table above.
- Which endpoints are missing or need verification: `/api/context`, full inventory item/balance/lot/transfer/variance/exception APIs, finance invoice/payable/reconciliation APIs, import APIs, broad report aggregation APIs, and any customer-facing persistence/database provider endpoints.
- What should not be cleaned yet: frontend static data, frontend fallbacks, JSON runtime data, AI Chat behavior, transactional workflow routes, and current customer-visible UI language.
