# Planning / Forecast / MRP Readiness Notes

Round: R56 Planning Reality Audit and Scope Freeze

This note freezes the current Planning / Forecast / MRP reality before additional hardening work. It is an internal readiness artifact, not product copy, and does not claim production MRP readiness.

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

## Unsafe For Alpha

- Forecast-generated PR creation still directly calls `POST /api/purchase-requests` from the Forecast page.
- MRP release still directly calls `POST /api/purchase-requests` from the Forecast page.
- Forecast plan save still writes through `POST /api/forecast-plans`.
- S&OP save still writes through `POST /api/sop-cycle`.
- The Forecast panel is not wired to `openActionDraftReview`; `FlowChainApp` currently renders `<ForecastPanel />` without an ActionDraft review prop.
- The Forecast/MRP UI uses execution language such as generating purchase requests and releasing MRP orders before the release path is converted to draft preview.

## Already Solid

- Forecast algorithms are domain-level enough to test directly in `src/domain/forecast/planning.ts`.
- Forecast metric calculations are centralized in `runForecast`, although edge cases need stronger tests.
- Route classification already marks `GET /api/mrp-plan` read-only and DB-mode allowed.
- Route classification already marks `POST /api/forecast-plans`, `POST /api/sop-cycle`, and `POST /api/purchase-requests` as legacy mutations and DB-mode blocked.
- Legacy mutation guard is already exercised by route classification, backend foundation, DB smoke, and procurement DB parity tests.
- ActionDraft boundary and review shell already make final confirmation unavailable / not implemented.

## Needs Dedicated Work

- R57: Harden forecast engine tests and edge-case behavior before reducing page-level calculation.
- R58: Stabilize the MRP read model contract and add explicit source/demo metadata where useful.
- R59: Strengthen BOM explosion tests and evidence, especially multi-level, phantom, scrap, lead-time offset, and shared components.
- R60: Strengthen MRP netting, lot sizing, planned release, and exception tests; extract pure helpers only where small.
- R61: Add planning route guard tests proving read/write boundaries and DB-mode blocking.
- R62: Improve Forecast/MRP explanation copy and typography while avoiding production-readiness claims.
- R63: Convert Forecast and MRP release actions to ActionDraft `purchase_request_draft` preview and remove direct PR creation from UAT-facing release actions.
- R64: Add read-only planning AI prompts only if the existing AI architecture supports them safely.
- R65: Gate Forecast/MRP as optional guided Alpha, observation-only, or excluded from Alpha.

## R56 Recommendation

Forecast/MRP should not enter Alpha yet. Treat it as a dedicated Planning phase with useful demo capability, partially solid domain logic, and known unsafe mutation paths. The next round should begin with Forecast engine domain hardening, not release conversion, so the planning basis is testable before the safety workflow is changed.
