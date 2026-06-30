# ActionDraft and AuditLog Repository Adapter v1

Round 18 makes ActionDraft and AuditLog the first concrete repository-backed persistence candidates while keeping runtime behavior JSON/demo-data-backed.

## Why these repositories first

ActionDraft and AuditLog are low-risk persistence candidates because current draft behavior is preview-only and audit records are supporting metadata. They do not directly mutate procurement documents, inventory balances, supplier messages, payments, or finance records.

## ActionDraftRepository

Current JSON implementation: `server/repositories/json-action-draft-repository.mjs`.

Methods:

- `getSchema()`
- `validateDraft(request)`
- `previewDraft(request, options)`

Preview support:

- `purchase_request_draft`
- `rfq_draft`
- `supplier_followup_draft`
- generic preview-only draft types from the action draft boundary

The route `POST /api/action-drafts/preview` now uses `ctx.repositories.actionDrafts` when injected and falls back to the JSON repository. Response shape remains `{ draft, previewOnly: true }`.

## AuditLogRepository

Current implementation: `server/repositories/audit-log-repository.mjs`.

Methods:

- `listAuditEntries(filters)`
- `recordAuditEntry(entry, options)`
- `recordAiEventBestEffort(entry, options)`
- compatibility aliases `listAuditEvents()` and `recordAuditEvent()`

AI route audit behavior remains best-effort. This round adds the repository surface and tests without rewriting every AI audit call site.

## Preview-only guarantees

Action draft previews still set:

- `requiresConfirmation: true`
- `confirmationBoundary.previewOnly: true`
- `confirmationBoundary.submitted: false`
- `confirmationBoundary.requiresUserReview: true`

No PR, RFQ, PO, inventory, payment, or supplier message is created by preview.

## Future path

Future rounds can add durable `persistDraft`, `getDraft`, and `confirmDraft` methods only after an explicit confirmation workflow exists. Audit logging can later move fully behind `ctx.repositories.auditLog`.

## Non-goals

- No real draft persistence.
- No database connection.
- No ORM package.
- No PR/RFQ/PO creation from preview.
- No inventory mutation.
- No supplier message sending.
- No confirmation workflow.
- No broad frontend UI change.
