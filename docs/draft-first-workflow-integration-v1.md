# Draft-first Workflow Integration v1

## Scope

Round 6 connects existing workflow shortcuts to the action draft review shell. It de-risks AI-assisted and cockpit-assisted entry points without changing the underlying business write APIs.

## Integrated Entry Points

- Inventory replenishment shortcut now opens a preview-only draft from `ReplenishmentRequestModal`.
- Low-stock inventory context maps to `purchase_request_draft`.
- Missing supplier or missing price context maps to `rfq_draft`.
- Today Cockpit inventory actions map to `purchase_request_draft` when SKU context is available.
- Today Cockpit sourcing and quotation actions map to `rfq_draft` when SKU context is available.
- Today Cockpit PO follow-up actions map to `po_followup_draft`.
- Today Cockpit supplier follow-up actions map to `supplier_followup_draft` when supplier context is available.

Unsupported or under-specified cockpit actions show: `当前动作需要人工复核，尚未接入草稿预览。`

## Write Boundary

The integrated shortcuts call:

- `POST /api/action-drafts/preview`

They do not call:

- `POST /api/purchase-requests`
- RFQ creation routes
- supplier message send routes
- inventory mutation routes
- database persistence helpers

The preview response must keep `previewOnly: true`. The visible confirm action in the review shell remains disabled.

## Existing Write APIs Kept

The backend write APIs and manual workbench actions are intentionally left in place. They are legacy/manual operational surfaces and are outside this de-risk pass unless a future round explicitly replaces them with a confirmation workflow.

## Validation Coverage

`server/domain/draft-workflow-integration.test.mjs` locks the integration boundary by checking:

- inventory replenishment no longer contains the direct submit path;
- cockpit mappings include supported draft types and fallback copy;
- the action draft preview route stays preview-only and does not call persistence writes.
