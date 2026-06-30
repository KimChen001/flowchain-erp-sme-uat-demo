# Persistence Mode and Adapter Registry v1

Round 17 introduces a lightweight persistence mode helper and adapter registry skeleton. Runtime behavior remains JSON/demo-data-backed by default.

## Persistence mode

The helper `getPersistenceMode(env)` reads `FLOWCHAIN_PERSISTENCE_MODE`.

Supported values:

- `json`: default and current runtime behavior.
- `database`: future placeholder only.

Rules:

- Missing env falls back to `json`.
- Unknown env falls back to `json`.
- `DATABASE_URL` is not required.
- Fake or missing database configuration must not affect normal test/build or JSON runtime.

## Adapter registry shape

`createRepositoryRegistry({ db, env })` returns the JSON registry unless `FLOWCHAIN_PERSISTENCE_MODE=database` is explicitly selected.

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

This error is only reachable when database mode is explicitly selected. Default JSON mode does not throw.

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

- No Prisma or Drizzle.
- No database connection.
- No migrations.
- No broad route migration.
- No public API response shape changes.
- No real persistence beyond the existing JSON-backed behavior.
- No `DATABASE_URL` requirement.
- No demo data mutation.
