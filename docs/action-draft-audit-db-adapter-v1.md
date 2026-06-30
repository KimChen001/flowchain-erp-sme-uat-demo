# ActionDraft and AuditLog DB Adapter v1

Round 26 adds the first database-backed repository adapters while keeping the default runtime JSON/demo-data-backed.

## Registry Behavior

JSON mode remains the default:

- `masterData`: JSON adapter
- `inventoryRead`: JSON adapter
- `procurementRead`: JSON adapter
- `actionDrafts`: JSON adapter
- `auditLog`: JSON adapter

Database mode is opt-in through `FLOWCHAIN_PERSISTENCE_MODE=database`:

- `actionDrafts`: DB adapter
- `auditLog`: DB adapter
- `masterData`: JSON read fallback until its DB adapter exists
- `inventoryRead`: JSON read fallback until its DB adapter exists
- `procurementRead`: JSON read fallback until its DB adapter exists

The registry can be created without opening a database connection. DB-backed methods validate database configuration when invoked.

## ActionDraft DB Adapter

File: `server/repositories/db-action-draft-repository.mjs`

Methods:

- `getSchema()`
- `normalizeDraftType(type)`
- `validateDraft(request)`
- `previewDraft(request, options)`
- `persistDraft(draft)`
- `getDraft(id, options)`
- `confirmDraft()`

`previewDraft` intentionally remains non-mutating. It reuses the current preview builders and does not call Prisma.

`persistDraft` is explicit future-path persistence. It validates `DATABASE_URL` in database mode and writes `ActionDraft`, validation, and audit trail records only when a caller deliberately invokes it.

`confirmDraft` returns a not-implemented error. There is still no confirmation workflow and no PR/RFQ/PO/inventory write is created from a draft.

## AuditLog DB Adapter

File: `server/repositories/db-audit-log-repository.mjs`

Methods:

- `listAuditEntries(filters)`
- `recordAuditEntry(entry, options)`
- `recordAiEventBestEffort(entry, options)`
- compatibility aliases `listAuditEvents()` and `recordAuditEvent()`

The adapter maps audit events into the Prisma `AuditLog` model and stores flexible before/after/metadata details in sanitized JSON metadata.

Best-effort AI audit catches DB/config failures and returns `{ ok: false, errorCode }` instead of breaking read-only AI responses.

## Clean Config Errors

Missing `DATABASE_URL` does not affect JSON mode.

When a DB adapter method is invoked in database mode without `DATABASE_URL`, the controlled error is:

```json
{
  "error": "DATABASE_URL is required when FLOWCHAIN_PERSISTENCE_MODE=database.",
  "code": "FLOWCHAIN_DATABASE_CONFIG_MISSING"
}
```

The server error helper still redacts raw connection strings, provider keys, bearer tokens, and stack details.

## Route Behavior

`GET /api/action-drafts/schema` and `POST /api/action-drafts/preview` use the repository registry. In database mode, preview still does not persist.

`GET /api/audit-log` now uses `ctx.repositories.auditLog`, so database mode selects the DB audit adapter.

Legacy mutation routes remain blocked by the Round 24 database-mode mutation guard.

## Test Strategy

Default tests do not require `DATABASE_URL` or a live database.

Tests cover:

- JSON registry behavior unchanged;
- database registry selects DB ActionDraft and AuditLog adapters;
- JSON read fallbacks remain for master data, procurement, and inventory;
- missing `DATABASE_URL` produces a clean config error when a DB method is invoked;
- action draft preview remains preview-only and non-mutating;
- unsupported draft type handling remains clean;
- audit metadata redacts secret-like values;
- best-effort audit failure does not throw.

No separate live DB test is required for this round.

## Non-Goals

- No real PR/RFQ/PO/GRN/inventory business writes.
- No automatic draft persistence from preview.
- No confirmation workflow.
- No supplier message sending.
- No default runtime migration to DB.
- No live database requirement for normal test, typecheck, or build.
- No external AI provider enablement.
