# Purchase Request Draft Preview v1

Purchase Request Draft Preview v1 is the first concrete draft-first flow. It prepares a reviewable PR draft from inventory risk or AI context, but it does not create a real purchase request.

## Payload Shape

The preview payload is normalized by `server/domain/purchase-request-draft-preview.mjs`:

- `itemIdOrSku`
- `itemName`
- `warehouse`
- `suggestedQuantity`
- `quantity`
- `unit`
- `reason`
- `supplierSuggestion`
- `urgency`
- `severity`
- `availableQuantity`
- `reorderPoint`
- `safetyStock`
- `requiresConfirmation`

`suggestedQuantity` is deterministic and conservative. When inventory data has a reorder point or safety stock and current available quantity is below that target, the suggestion is the gap. If the system cannot derive a safe quantity, the draft remains previewable but validation marks quantity for manual review.

## Preview Endpoint

`POST /api/action-drafts/preview` handles `purchase_request_draft` through the PR draft preview helper.

Rules:

- missing SKU returns a clean validation failure;
- unknown SKU returns a clean not-found failure;
- missing quantity can become a manual-review warning;
- no `writeDb` call;
- no real PR record;
- no inventory posting;
- no supplier message;
- no database persistence.

## UI Behavior

Today Cockpit recommended inventory actions can open the action draft review shell. AI PR draft cards can also open the same shell.

The shell shows business fields, origin evidence, validation warnings, and an audit preview. The confirm button remains disabled. Copying draft content is local UI behavior only.

## Evidence

Origin evidence uses canonical evidence links where safe:

- SKU evidence focuses inventory;
- supplier evidence focuses SRM;
- broken evidence remains readable text.

## Future Work

Confirmed PR creation, draft persistence, approval workflow, and submit actions remain future work. This pass does not add write APIs or database persistence.
