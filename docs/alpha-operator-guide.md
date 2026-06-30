# Alpha Operator Guide

FlowChain is an AI-assisted SCM, procurement, inventory, and planning workbench for SMEs. This guide is for controlled Alpha operation only. It is not production ERP guidance, not autonomous execution guidance, and not production MRP guidance.

## Alpha Boundary

- JSON mode is the default runtime mode.
- DB mode is opt-in and should be used only when the operator intentionally tests repository-backed reads.
- Test preview-first and draft-first flows before any save-shell flow.
- ActionDraft final confirmation is disabled and not implemented.
- ActionDraft review may preview, edit simple fields, copy, and save an ActionDraft shell only.
- Preview flows must not create PR, RFQ, PO, GRN, inventory movement, or production MRP records.
- Legacy mutation routes are blocked in DB mode by the route classification guard.
- Forecast, MRP release, and replenishment actions are ActionDraft preview only.
- Do not use real production data during Alpha.

## Core Test Modules

- Today Cockpit: start here for the main guided signal, evidence, and recovery flow.
- AI Assistant: test deterministic prompts, evidence cards, and recommended action navigation.
- Procurement PR/RFQ/PO/GRN: verify document recovery, status explanation, and linked evidence.
- Inventory SKU focus: verify SKU detail recovery, movements, exceptions, and lots/serial context.
- Inventory exceptions, movements, and lots: verify explanatory evidence and recovery paths.
- ActionDraft Review: verify preview, simple edit, copy, save shell, cancel/reset, and disabled final confirm.
- Planning Workbench: optional guided Alpha scenario only, not production MRP.

## Planning Guided Scenario

Planning is split into five guided subviews:

- Planning Cockpit: high-level planning priority and risk summary.
- Demand Forecast: historical demand, method comparison, forecast metrics, horizon, and scenario review.
- MRP Plan: gross requirement, scheduled receipts, inventory, net requirement, planned receipt/release, exception reason, and BOM evidence.
- Replenishment Workbench: prioritized recommendations, supplier, buyer, quantity, amount, reason, evidence, and ActionDraft preview.
- Planning Parameters: lead time, MOQ, batch multiple, safety stock, reorder point, supplier, buyer, unit cost, and demo/static assumptions.

Treat Planning as optional guided Alpha. Do not position it as autonomous release, production replenishment, or production MRP.

## Required AI Prompts

- 今天最需要处理什么？
- 今天采购有什么要跟？
- 哪些 PO 快逾期？
- 哪些 RFQ 没回复？
- 哪些采购申请还没转 PO？
- 哪些收货有异常？
- 哪些库存项目需要关注？
- 哪些 SKU 有 MRP 例外？
- MRP 计划释放有哪些需要审阅？
- 这个 forecast 的 MAPE 怎么样？

## Guided Test Scenarios

Scenario A: Today Cockpit to AI to procurement evidence to recovery.

1. Open Today Cockpit.
2. Ask `今天最需要处理什么？`.
3. Open an evidence or recommended action target.
4. Confirm the target page keeps recovery controls visible.

Scenario B: PO due or overdue to PO detail to recovery.

1. Ask `哪些 PO 快逾期？`.
2. Open the recommended PO or PO list.
3. Confirm PO status, supplier, ETA, linked PR/GRN, and recovery paths.

Scenario C: RFQ pending response to RFQ detail to related PR/PO.

1. Ask `哪些 RFQ 没回复？`.
2. Open RFQ detail.
3. Confirm pending supplier response, source PR, related PO if present, and recovery paths.

Scenario D: Inventory SKU to movements, exceptions, lots, and recovery.

1. Ask `哪些库存项目需要关注？`.
2. Open a SKU focus target.
3. Confirm movements, exceptions, lots/serial evidence, and clear focus recovery.

Scenario E: Inventory replenishment to ActionDraft preview.

1. Trigger a replenishment draft preview from Inventory.
2. Review evidence, payload, validation, and audit boundary.
3. Try copy, simple edit, save shell if enabled, and cancel/reset.
4. Confirm final confirm remains disabled.

Scenario F: Planning Cockpit to Demand Forecast to MRP Plan to Replenishment Workbench.

1. Open Planning Cockpit.
2. Click Demand Forecast, review forecast history, model comparison, metrics, and horizon.
3. Open MRP Plan, review net requirement, planned receipt/release, exception, and BOM evidence.
4. Open Replenishment Workbench and trigger ActionDraft preview only.
5. Confirm no direct PR/RFQ/PO/GRN/inventory record is created.

Scenario G: Planning Parameters to explain assumptions.

1. Open Planning Parameters.
2. Verify lead time, MOQ, batch multiple, safety stock, reorder point, supplier, buyer, and unit cost.
3. Ask `这个 SKU 的计划参数是什么？`.
4. Confirm AI evidence lands back in the Planning subviews and remains read-only.

## Local Runtime Troubleshooting

- Confirm current HEAD with `git log -1 --oneline`.
- Start the API with `npm run api`.
- Start the frontend with `npm run dev`.
- Open browser Network and inspect `/api/ai/chat`.
- `200` means the route returned a handled response; inspect cards, evidence, and action targets.
- `404` usually means the API server is not serving the expected route or the frontend is pointing at the wrong target.
- `500` means inspect the API terminal first; restart after pulling latest code.
- Pending or cancelled requests often mean the frontend request was aborted, the dev server refreshed, or the API process is stuck.
- Restart the API after pulling latest code.
- Do not test while Codex is mid-run or while files are being edited.

## Issue Capture Template

- Tester:
- Date/time:
- Browser/device:
- Scenario:
- Step:
- Expected:
- Actual:
- Screenshot/video:
- Severity: S0/S1/S2/S3
- Category: AI timeout / no response; navigation / recovery; evidence link; ActionDraft boundary; Planning/MRP explanation; data mismatch; typography/display; performance; permissions/boundary confusion
- Reproducibility:
- Notes:

## Severity Rules

- S0: cannot continue testing.
- S1: core scenario broken.
- S2: workaround exists.
- S3: polish, copy, or style issue.

## Operator Recommendation

Start with 3 internal pilot users first. After S0 and S1 issues are cleared and S2 issues have known workarounds, expand to 5-10 controlled Alpha users. Do not ask users to use real production data. Capture screenshots for all S0, S1, and S2 issues.
