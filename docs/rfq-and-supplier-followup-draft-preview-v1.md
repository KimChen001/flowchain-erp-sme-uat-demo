# RFQ And Supplier Follow-up Draft Preview v1

This pass extends the draft-first preview pattern to two safe adjacent draft types:

- RFQ Draft Preview
- Supplier Follow-up Draft Preview

Both remain preview-only. FlowChain does not create RFQs, send supplier messages, persist drafts, or execute autonomous actions.

## RFQ Draft Payload

`server/domain/rfq-and-supplier-followup-draft-preview.mjs` builds RFQ previews with:

- `itemIdOrSku`
- `itemName`
- `quantity`
- `unit`
- `supplierCandidates`
- `requestedDeliveryDate`
- `reason`
- `requiresConfirmation`

The helper validates item and quantity. Missing item or quantity returns a clean validation failure. Supplier candidates come from explicit payload data, preferred supplier metadata, and available master supplier references.

## Supplier Follow-up Payload

Supplier follow-up previews include:

- `supplierId`
- `supplierName`
- `relatedDocumentType`
- `relatedDocumentId`
- `followupReason`
- `messageDraft`
- `severity`
- `dueDate`
- `requiresConfirmation`

The helper validates supplier identity. If no message is provided, it creates a concise editable business-tone draft. It does not send the message.

## Preview Endpoint

`POST /api/action-drafts/preview` routes `rfq_draft` and `supplier_followup_draft` to the specialized preview helpers.

Rules:

- no `writeDb`;
- no RFQ creation;
- no supplier message sending;
- no procurement or inventory mutation;
- no database persistence;
- unsupported draft types still return clean generic failure.

## UI Behavior

The existing action draft review shell renders both draft types. It shows payload fields, origin evidence, validation messages, audit preview, and a disabled confirm button.

AI RFQ draft cards can open the shell through the review action. Today Cockpit procurement follow-up actions can attempt a supplier follow-up preview when enough context is available; missing supplier context is shown as clean validation feedback.

## Evidence

RFQ drafts include SKU and supplier candidate evidence where available. Supplier follow-up drafts include supplier and related document evidence where available. Broken evidence remains readable text through the canonical evidence boundary.

## Future Work

Creating RFQs, sending supplier messages, saving drafts, and confirmation workflows remain future work.
