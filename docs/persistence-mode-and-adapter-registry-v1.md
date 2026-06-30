# Persistence Mode and Adapter Registry v1

Round 17 introduces a lightweight persistence mode helper and adapter registry skeleton. Runtime behavior remains JSON/demo-data-backed by default.

## Persistence mode

The helper `getPersistenceMode(env)` reads `FLOWCHAIN_PERSISTENCE_MODE`.

Supported values:

- `json`: default and current runtime behavior.
- `database`: opt-in database-readiness mode. Real DB adapters are not implemented yet; Round 24 blocks legacy JSON write routes and allows read/preview routes with JSON read fallback until DB adapters exist.

Rules:

- Missing env falls back to `json`.
- Unknown env falls back to `json`.
- `DATABASE_URL` is not required.
- Fake or missing database configuration must not affect normal test/build or JSON runtime.

## Adapter registry shape

`createRepositoryRegistry({ db, env })` returns the JSON registry unless `FLOWCHAIN_PERSISTENCE_MODE=database` is explicitly selected.

The main route context uses the JSON registry by default. In Round 24, explicit database mode uses JSON read fallback for allowed read/preview routes and blocks un-migrated legacy mutation routes before they can call `writeDb`.

Current JSON registry groups:

- `masterData`
- `inventoryRead`
- `procurementRead`
- `actionDrafts`
- `auditLog`
- `aiConversation`

The JSON registry delegates to current domain read models and small repository helpers. It does not migrate routes yet and does not duplicate core business logic.

## Database placeholder

`FLOWCHAIN_PERSISTENCE_MODE=database` currently throws a safe not-implemented error:

```text
Database persistence adapter is not implemented yet. Use FLOWCHAIN_PERSISTENCE_MODE=json.
```

This error is only reachable when `createRepositoryRegistry` is called directly with database mode explicitly selected. The main server route path does not use the placeholder for read/preview routes in database mode; it uses JSON read fallback plus the Round 24 mutation guard until real DB adapters are added.

## Relation to contract tests

The Round 16 JSON adapter contract tests remain the behavioral baseline. Future database adapters should satisfy the same contract categories before route behavior is migrated behind the registry.

## Route wiring status

Round 22 wires the registry into the main server `routeContext` after the JSON database snapshot is loaded. Repository-compatible routes now receive `ctx.repositories` during normal request handling.

The first repository-compatible route groups are:

- Master Data;
- Procurement read;
- Inventory read;
- Action Draft preview.

Each route group still keeps a local JSON fallback for isolated handler tests and compatibility, but injected repositories take priority.

## Non-goals

- Round 17 did not add Prisma or Drizzle. Round 25 later adds a Prisma scaffold, but this registry still does not expose real database adapters.
- No database connection.
- No migrations.
- No broad route migration.
- No public API response shape changes.
- No real persistence beyond the existing JSON-backed behavior.
- No `DATABASE_URL` requirement.
- No demo data mutation.
