# Planning / Forecast / MRP Readiness Notes

Round: R65 Planning Alpha Readiness Gate

This note records the current Planning / Forecast / MRP readiness after R57-R65 hardening. It is an internal readiness artifact, not product copy, and does not claim production MRP readiness.

## Inspected Surface

- Forecast UI: `src/modules/forecast/Page.tsx`
- Forecast domain: `src/domain/forecast/*`
- MRP domain: `src/domain/mrp/*`
- MRP route: `server/routes/mrp.routes.mjs`
- S&OP route: `server/routes/sop.routes.mjs`
- Route classification: `server/domain/route-classification.mjs`
- Navigation shell: `src/app/routes.tsx`, `src/app/FlowChainApp.tsx`
- ActionDraft integration: `src/modules/action-drafts/*`, `server/domain/action-draft-*`, `server/routes/action-drafts.routes.mjs`
- Existing tests: route classification, backend foundation, DB mode smoke/parity, ActionDraft boundary/persistence/review shell, draft workflow integration

## Current Capabilities

- Forecast supports deterministic domain methods: naive, SMA, SES, Holt, and Holt-Winters.
- Forecast domain returns fitted values, forecast horizon, MAPE, WMAPE, sMAPE, RMSE, MAE, bias, tracking signal, and Theil U.
- Forecast UI supports custom history input, champion/challenger method benchmarking, scenario and promotion adjustment, service-level inputs, export, and saved forecast plans.
- Forecast UI performs supply-demand reconciliation over the selected horizon and derives replenishment recommendations.
- MRP API exposes `GET /api/mrp-plan` as a read-only plan with rows, schedule lines, BOM-related demand, planned receipts/releases, exceptions, and summary totals.
- MRP route includes deterministic BOM explosion, dependent demand traceability, safety stock netting, MOQ and batch multiple rounding, lead time release offsets, and exception classification.
- MRP frontend consumption shows row-level schedule, dependent demand sources, planned receipt/release, exceptions, and release recommendations.
- S&OP route exposes `GET /api/sop-cycle` as a draft/history read model built from MRP, supplier performance, forecast plans, PRs, and open POs.
- ActionDraft review shell and route support draft previews and controlled ActionDraft persistence without creating final PR/RFQ/PO/GRN/inventory records.

## Demo / Static Assumptions

- Forecast SKU history and SKU options still come from frontend demo data (`FORECAST_SKUS` and related fixtures).
- Forecast page owns important planning calculations: scenario adjustment, confidence band, supply-demand reconciliation, stockout detection, safety factor, recommended quantity, amount, and priority.
- Forecast month labels are hard-coded around the 2026-05 base month in `MONTHS_24` and `FUTURE_LABEL`.
- Forecast saved plan persistence is a legacy JSON mutation via `POST /api/forecast-plans`.
- MRP profiles are route-local static data in `mrpProfiles`, including allocated quantity, inbound receipts, MOQ, batch multiple, lead time, service level, ABC/XYZ, supplier, unit price, and fallback BOM demand.
- BOM master is route-local static data in `bomMaster`, including finished-goods demand, multi-level components, phantom assembly flag, qty per, scrap percentage, and lead time offset.
- S&OP draft uses fixed planning copy and IDs such as `2026-06` / `SOP-2026-`, and its source can fall back to `MRP profile`.
- Supplier assumptions for planning recommendations are static through forecast procurement profiles and route-local MRP supplier fields.

## Alpha Safety Gate

- Forecast-generated PR and MRP release actions now open ActionDraft `purchase_request_draft` preview instead of directly calling `POST /api/purchase-requests`.
- `FlowChainApp` wires Forecast/MRP to `openActionDraftReview`, and draft workflow tests lock that Forecast no longer contains `/api/purchase-requests`.
- Forecast/MRP copy now explains demo/static planning boundaries, forecast metrics, MRP exceptions, planned receipt/release semantics, BOM evidence, and human review requirements.
- Planning AI prompts are deterministic, read-only, and return Forecast/MRP evidence without provider dependency or business writes.
- `GET /api/mrp-plan` remains read-only and DB-mode allowed; `POST /api/forecast-plans`, `POST /api/sop-cycle`, and legacy PR mutations remain DB-mode blocked.

## Remaining Non-Production Boundaries

- Forecast plan save still writes through legacy JSON `POST /api/forecast-plans`; keep Alpha scenario optional and guided.
- S&OP save still writes through legacy JSON `POST /api/sop-cycle`; do not include S&OP commit as an unguided Alpha task.
- Forecast SKU history, month labels, procurement profiles, MRP profiles, and BOM master still include demo/static assumptions.
- ActionDraft confirmation remains intentionally disabled; Alpha users may preview/save draft shells but must not expect final PR/PO creation from Forecast/MRP.

## Already Solid

- Forecast algorithms are domain-level and covered by deterministic edge-case tests in `src/domain/forecast/planning.ts`.
- Forecast metric calculations are centralized in `runForecast`, including invalid/short history degradation and scenario adjustment tests.
- Route classification already marks `GET /api/mrp-plan` read-only and DB-mode allowed.
- Route classification already marks `POST /api/forecast-plans`, `POST /api/sop-cycle`, and `POST /api/purchase-requests` as legacy mutations and DB-mode blocked.
- Legacy mutation guard is already exercised by route classification, backend foundation, DB smoke, and procurement DB parity tests.
- ActionDraft boundary and review shell already make final confirmation unavailable / not implemented.
- MRP read model, BOM explosion, net requirements, lot sizing, planned release periods, exception classification, and planning route guards now have focused tests.
- Planning AI UAT prompts are covered by read-only route tests and contextual quick prompt tests.

## Completed Hardening

- R57: Hardened forecast engine tests and edge-case behavior.
- R58: Stabilized the MRP read model contract with explicit source metadata.
- R59: Strengthened BOM explosion tests and evidence for multi-level, phantom, scrap, lead-time offset, and shared components.
- R60: Strengthened MRP netting, lot sizing, planned release, and exception tests with exported pure helpers.
- R61: Added planning route guard tests proving read/write boundaries and DB-mode blocking.
- R62: Improved Forecast/MRP explanation copy while avoiding production-readiness claims.
- R63: Converted Forecast and MRP release actions to ActionDraft `purchase_request_draft` preview and removed direct PR creation from UAT-facing release actions.
- R64: Added deterministic read-only planning AI prompts.
- R65: Gates Forecast/MRP for optional guided Alpha only.

## R65 Recommendation

Forecast/MRP ready for optional guided Alpha scenario.

Use this only as a guided planning demonstration: forecast metrics, MRP evidence, exception review, and ActionDraft preview. Do not position it as autonomous MRP, production replenishment, or final PR/PO release.
