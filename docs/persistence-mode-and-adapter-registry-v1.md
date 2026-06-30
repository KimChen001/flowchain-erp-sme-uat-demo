# Persistence Mode and Adapter Registry v1

Round 17 introduces a lightweight persistence mode helper and adapter registry skeleton. Runtime behavior remains JSON/demo-data-backed by default.

## Persistence mode

The helper `getPersistenceMode(env)` reads `FLOWCHAIN_PERSISTENCE_MODE`.

Supported values:

- `json`: default and current runtime behavior.
- `database`: opt-in database-readiness mode. Rounds 26-27 add DB adapters for ActionDraft, AuditLog, and Master Data while procurement read and inventory read remain JSON read fallback until their DB adapters exist.

Rules:

- Missing env falls back to `json`.
- Unknown env falls back to `json`.
- `DATABASE_URL` is not required.
- Fake or missing database configuration must not affect normal test/build or JSON runtime.

## Adapter registry shape

`createRepositoryRegistry({ db, env })` returns the JSON registry unless `FLOWCHAIN_PERSISTENCE_MODE=database` is explicitly selected.

The main route context uses the JSON registry by default. In database mode, the registry is now partial: migrated repositories use DB adapters, and un-migrated read repositories use JSON fallback. Un-migrated legacy mutation routes are blocked before they can call `writeDb`.

Current JSON registry groups:

- `masterData`
- `inventoryRead`
- `procurementRead`
- `actionDrafts`
- `auditLog`
- `aiConversation`

The JSON registry delegates to current domain read models and small repository helpers. It does not migrate routes yet and does not duplicate core business logic.

## Partial Database Registry

`FLOWCHAIN_PERSISTENCE_MODE=database` no longer selects a pure placeholder registry.

Current database-mode mapping:

- `actionDrafts`: DB adapter
- `auditLog`: DB adapter
- `masterData`: DB adapter
- `procurementRead`: JSON read fallback
- `inventoryRead`: JSON read fallback
- `aiConversation`: future adapter placeholder

The DB adapters validate `DATABASE_URL` only when their database-backed methods are invoked. JSON mode still ignores missing database configuration.

## Relation to contract tests

The Round 16 JSON adapter contract tests remain the behavioral baseline. Future database adapters should satisfy the same contract categories before route behavior is migrated behind the registry.

## Route wiring status

Round 22 wires the registry into the main server `routeContext` after the JSON database snapshot is loaded. Repository-compatible routes now receive `ctx.repositories` during normal request handling.

Repository-compatible route groups are:

- Master Data;
- Procurement read;
- Inventory read;
- Action Draft preview;
- Audit Log.

Each route group still keeps a local JSON fallback for isolated handler tests and compatibility, but injected repositories take priority.

## Non-goals

- Round 17 did not add Prisma or Drizzle. Round 25 later adds a Prisma scaffold, Round 26 starts the partial database registry for ActionDraft and AuditLog, and Round 27 adds Master Data DB reads.
- No database connection during registry creation.
- No migrations.
- No broad route migration.
- No public API response shape changes.
- No real persistence beyond the existing JSON-backed behavior.
- No `DATABASE_URL` requirement.
- No demo data mutation.
