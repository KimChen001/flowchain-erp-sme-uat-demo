# FlowChain Product Scope & IA Review

## 1. Product Positioning

FlowChain is best framed as an AI-assisted supply chain and supplier management platform for SMEs.

Core focus:
- Today Cockpit
- Procurement / P2P
- Inventory Management
- Inventory Exception Closure
- SRM / Supplier Management
- Master Data
- Forecast / MRP

Supporting layers:
- Finance Collaboration
- Invoice matching / tax split visibility
- AP / reconciliation visibility
- Reports Center
- Data Management
- AI Assistant

This is not a full ERP suite. It should not drift into CRM, HR, full Sales/O2C, GL, payment engine, or tax filing.

## 2. Current Module Map

### Today Cockpit
Purpose: prioritize daily actions, risks, and evidence.
Owns: cross-module action rows, evidence cards, quick navigation.
Should not own: editing workflows, deep business persistence, or broad reporting.

### Procurement
Purpose: PR, RFx, PO, receiving collaboration, invoice collaboration, three-way match, returns.
Owns: sourcing execution and operational matching.
Should not own: full supplier performance governance or finance posting.

### Inventory
Purpose: stock visibility, movement ledger, lots/serials, transfers, cycle count, exception closure.
Owns: operational inventory state and exception evidence.
Should not own: real stock posting engine or financial settlement.

### SRM / Supplier Management
Purpose: supplier master visibility, performance, risk, certification, sourcing participation, contract visibility.
Owns: supplier health and collaboration context.
Should not own: CRM-style relationship management or procurement execution.

### Master Data
Purpose: source-of-truth setup for items, suppliers, warehouses, tax codes, payment terms.
Owns: canonical reference data.
Should not own: SRM interpretation or transactional workflows.

### Finance Collaboration
Purpose: supplier invoice register, AP visibility, credit memo offset, reconciliation, settlement readiness.
Owns: supporting financial visibility only.
Should not own: GL, payment engine, or tax filing.

### Forecast / MRP
Purpose: demand prediction, replenishment signal, MRP exception support.
Owns: planning recommendations.
Should not own: order execution or accounting.

### Reports Center
Purpose: exportable cross-module reports with deep links back into workbenches.
Owns: read-only analytical views.
Should not own: transactional editing.

### Data Management
Purpose: import templates, validation results, failed row handling, import history.
Owns: structured data intake.
Should not own: backend parser redesign or persistence logic.

### AI Assistant
Purpose: contextual explanation and decision support.
Owns: module-aware guidance.
Should not own: business logic or autonomous execution.

## 3. Navigation Health Check

Overall navigation is coherent and usable.

Assessment:
- Top-level modules are sensible for the current scope.
- Second-level navigation is readable, though some sections are still dense.
- Deep links are mostly coherent and now route by `module:view`.
- Procurement and SRM are separated well enough for the current stage.

Recommendations:
- Keep top-level structure as-is for now.
- Rename only if a label becomes misleading.
- Split large module pages later, not now.
- Avoid adding more top-level modules until backend structure is defined.

## 4. Boundary Review

### Procurement vs SRM
Good boundary:
- Procurement owns PR/RFx/PO/GRN/invoice collaboration/three-way match/returns.
- SRM owns supplier performance/risk/certification/sourcing participation/contract visibility.

Risk:
- Supplier portal and supplier invoice views can blur the line.

Recommendation:
- Keep procurement portal as execution collaboration.
- Keep SRM as the supplier management home.

### Procurement vs Finance
Good boundary:
- Procurement owns matching and exception collaboration.
- Finance owns supplier invoice register, AP visibility, credit memo offset, reconciliation, settlement readiness.

Risk:
- Invoice-related actions can overroute into finance too early.

Recommendation:
- Preserve procurement-side invoice collaboration.
- Keep finance on AP visibility and reconciliation only.

### Master Data vs SRM
Good boundary:
- Master Data owns the source of truth.
- SRM owns the interpretation of supplier performance, risk, and certification.

Recommendation:
- Keep master data as canonical records.
- Use SRM for supplier health and evidence summaries.

### Inventory Movement vs Inventory Exceptions
Good boundary:
- Movement Ledger explains what changed.
- Exception Documents explain why it changed and how closure happens.

Recommendation:
- Keep both views.
- Avoid merging them into one table.

### Finance boundary
Current finance scope is appropriate if kept supporting-only.

Recommendation:
- Freeze GL, payment engine, tax filing, bank integration, and tax bureau integration.

## 5. Customer Demo Path

Suggested paths:

### Path A: Supplier risk to action
Today Cockpit -> SRM risk -> supplier detail -> related PO / invoice / reconciliation -> next action.

### Path B: Inventory exception closure
Today Cockpit -> Inventory movement ledger -> Inventory exception document -> evidence -> procurement follow-up.

### Path C: Procure-to-collaborate
PR -> RFx -> PO -> GRN -> invoice collaboration -> three-way match -> return / credit -> finance visibility.

These paths tell a clear story: FlowChain moves from signal to evidence to action.

## 6. Figma Redesign Brief

Recommended direction:
- Keep a workbench-first layout.
- Preserve clear top-level modules and tighter subviews.
- Make the sidebar lightweight and stable.
- Use compact KPI cards for status summaries.
- Keep tables dense but readable.
- Make row actions minimal: `详情`, `更多`, and one primary action only when necessary.
- Use document shell / modal patterns for evidence-heavy objects.
- Place the AI panel as a persistent but secondary lane.
- Use consistent status chips across modules.
- Put import/export actions near the relevant table header, not as a dominant banner.
- Optimize mobile for navigation and summary first, not full-density tables.

## 7. Backend Foundation Readiness

The product is directionally ready for backend foundation, but not for a full enterprise backend.

Recommended build order:
1. Minimal user / tenant / role context
2. Master data API / persistence
3. Audit log foundation
4. SRM supplier profile and performance API
5. Procurement document APIs
6. Inventory movement / exception APIs
7. Supplier invoice / credit memo / reconciliation APIs
8. Reports and import job persistence

Do not start with:
- full production RBAC
- SSO / MFA
- GL
- payment engine
- tax filing
- workflow engine
- broad ERP backend expansion

## 8. Code Cleanup Candidates

Low-risk cleanup candidates:
- split `src/modules/srm/Page.tsx`
- split `src/modules/master-data/Page.tsx`
- split `src/modules/finance/Page.tsx`
- extract report registry from `src/modules/reports/Page.tsx`
- extract import registry from `src/modules/imports/Page.tsx`
- centralize route / sourceModule mapping
- reduce duplicated table/action patterns
- decouple domain helpers from direct data imports where practical

## Freeze List

Freeze for now:
- CRM
- HR
- full Sales/O2C
- GL
- real payment engine
- tax filing
- bank/tax bureau integration
- complex RBAC
- OCR
- workflow engine
- backend persistence unless separately tasked
- full UI redesign in code
- new business modules

## 9. Recommended Next 3 Tasks

1. Prepare a Figma UI redesign brief and component system for the current workbench structure.
2. Do a code cleanup pass on large module pages and registry-style configs.
3. Build Backend Foundation v1 with minimal user context and master data persistence first.
