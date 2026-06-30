# FlowChain Frontend Stability Review

## Purpose

This document captures the current frontend product and architecture state after landing-page simplification, scope audit, and workbench component cleanup.

It is intended for product alignment, future Codex tasks, possible later Figma work, and backend planning. It does not claim production readiness. It also should not be used as customer-facing product copy, especially where internal engineering wording appears.

This is an internal engineering and product alignment document.

## Product Positioning

FlowChain is an AI-assisted supply chain and supplier management platform for SMEs.

中文定位：面向中小企业的 AI 辅助供应链与供应商管理平台。

FlowChain is not a full ERP suite. The product should not drift into CRM, HR, full Sales/O2C, General Ledger, payment engine, tax filing, bank integration, tax bureau integration, OCR, complex RBAC, or a workflow engine.

Finance remains a supporting visibility layer only. It should help procurement, supplier collaboration, invoice matching, AP visibility, reconciliation, tax split visibility, and settlement readiness. It should not become full accounting.

## Current Scope

Current in-scope modules:

- Today Cockpit
- Procurement / P2P
- Inventory Management
- Inventory Exception Documents
- SRM / Supplier Management
- SRM Scoring
- Master Data
- Forecast / MRP
- Finance Collaboration
- Reports Center
- Data Management / Imports
- AI Assistant

Explicitly out of scope:

- CRM
- HR
- Full Sales/O2C
- General Ledger
- Payment execution
- Tax filing
- Bank integration
- Tax bureau integration
- OCR
- Full workflow engine
- Complex RBAC
- Supplier external account invitation
- Production backend persistence unless separately planned

## Module Boundary Summary

Procurement owns PR, RFx, PO, receiving collaboration, invoice collaboration, three-way match, returns, and the procurement-side supplier portal.

Inventory owns inventory visibility, movement ledger, lots and serials, transfer, cycle count, ABC/XYZ, bin map, and inventory exception documents.

Inventory Movement Ledger explains what changed.

Inventory Exception Documents explain why it changed and how it is closed.

SRM owns supplier master visibility, supplier performance, supplier risk, certification/admission, sourcing participation, contract/catalog summary, supplier collaboration overview, and scoring visibility.

Master Data owns canonical source-of-truth records for items, suppliers, warehouses/bins, tax codes, and payment terms.

Finance owns supplier invoice register visibility, AP/payables visibility, credit memo offset, supplier reconciliation, settlement readiness, and tax split visibility.

Reports owns read-only cross-module reporting and export paths.

Data Management owns import templates, validation visibility, and import history.

AI Assistant owns contextual explanation and evidence-backed guidance. It does not own autonomous execution.

## Current Frontend Architecture

The frontend is a React / Vite / TypeScript application.

- `src/app` contains the shell, navigation, route wiring, and AI panel layout.
- `src/modules` contains focused workbench modules.
- Procurement, SRM, Master Data, and Finance have been split into smaller focused files.
- Shared UI components live in `src/components`.
- Domain helpers live in `src/domain`.
- Static/frontend seed data lives under `src/data`.
- API client/helpers live under `src/lib`.

The backend remains JSON/API oriented and is not the focus of this frontend stability review.

Recent cleanup:

- Landing pages were simplified.
- First-screen information density was reduced.
- Detailed tables were moved behind tabs/subviews.
- SRM scoring wording was stabilized.
- Sales/Customer visible scope was removed from reports, imports, and main app wiring.
- Customer-visible metadata and product tagline were aligned to supply chain collaboration positioning.

## Current UX Pattern

Preferred UX pattern:

Signal -> Evidence -> Action

Landing pages should show concise signals and entry points. Detailed tables should stay in subviews. Evidence and detail panels should support decisions. The AI Assistant should remain secondary and contextual rather than dominating the first screen. Import/export actions should remain contextual and should not dominate landing pages.

## Stability Checklist

The following areas are considered stable enough for the next planning step:

- Product scope
- Sidebar IA
- Workbench landing pattern
- Procurement boundary
- Inventory movement vs exception boundary
- SRM scoring wording
- Master Data ownership
- Finance supporting-only boundary
- Reports/Data Management boundary
- AI Assistant placement
- Customer-visible wording guardrails

## Alpha Readiness Classification

R66 post-planning audit classifies the visible system as follows for controlled Alpha:

- Core Alpha ready: Today Cockpit guided flow, Procurement workbench, PR/RFQ/PO/GRN read and recovery paths, Inventory SKU focus, ActionDraft preview/review shell, AI Assistant deterministic guidance.
- Optional guided Alpha: Forecast / MRP planning review and draft preview only. It is useful for guided demand/MRP evidence review, but it is not production MRP or autonomous release.
- Observation-only: Master Data, SRM, Finance Collaboration, Reports Center, and Data Management / Imports. These are useful for context, exports, and evidence review, but should not anchor the first Alpha task.
- Excluded from Alpha: full auth/RBAC, production multi-tenant permission infrastructure, final ActionDraft confirmation, autonomous AI business mutations, GL/payment/tax filing, bank/tax integrations, and production MRP release.

Known Alpha guardrails:

- Preview flows must remain non-mutating.
- Legacy mutation routes must remain blocked in database mode.
- JSON mode remains the default; database mode remains opt-in.
- Forecast/MRP release actions must remain ActionDraft preview only.
- User-facing copy should say preview, review, or draft when final business execution is not implemented.

## Known Limitations

- No production backend persistence yet.
- No full RBAC/SSO/MFA.
- No GL/payment/tax filing.
- No real bank/tax bureau integration.
- No external supplier account invitation.
- Some data remains static or JSON-backed.
- Build has an existing Vite chunk-size warning.
- Browser click-through smoke testing is not fully automated yet.

## Recommended Next Steps

Recommended order:

1. Freeze frontend scope unless a clear bug is found.
2. Add or improve lightweight smoke test coverage if practical.
3. Prepare Backend Foundation v1 plan.
4. Start backend with minimal user/tenant/profile/audit log only.
5. Add Master Data persistence.
6. Add SRM supplier profile/scoring API.
7. Add Procurement/Inventory/Finance APIs later.
8. Only consider Figma/global redesign later if the UI becomes a real blocker.

## Guardrails For Future Codex Tasks

Future Codex prompts should always include:

- Do not touch `data/scm-demo.json`.
- Do not use `git add .`.
- Do not reintroduce CRM, HR, full Sales/O2C, GL, payment, or tax filing.
- Do not restore PDF export unless explicitly requested.
- Do not add backend persistence unless explicitly scoped.
- Preserve customer-visible wording guardrails.
- Preserve current module boundaries.
