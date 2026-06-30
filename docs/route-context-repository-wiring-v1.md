# RouteContext Repository Wiring v1

Round 22 wires the repository adapter registry into the main server route context while preserving the existing JSON-backed runtime behavior.

## What Changed

`server/routes/scm-legacy.routes.mjs` now imports and creates the repository registry after the request database snapshot is loaded:

```js
const repositories = createRepositoryRegistry({ db, env: process.env })
```

The registry is passed through `routeContext.repositories`, so repository-compatible routes can use injected adapters instead of constructing local fallback JSON repositories.

## Route Groups Using the Registry

The following route groups already prefer `ctx.repositories.*` and keep JSON fallback behavior for unit tests or isolated handler use:

- `server/routes/master-data.routes.mjs` uses `ctx.repositories.masterData`.
- `server/routes/procurement-read.routes.mjs` uses `ctx.repositories.procurementRead`.
- `server/routes/inventory.routes.mjs` uses `ctx.repositories.inventoryRead`.
- `server/routes/action-drafts.routes.mjs` uses `ctx.repositories.actionDrafts`.

Existing tests cover each route group's injected repository behavior and response shape.

## JSON Default Behavior

Default behavior remains JSON/demo-data-backed:

- missing `FLOWCHAIN_PERSISTENCE_MODE` resolves to `json`;
- unknown `FLOWCHAIN_PERSISTENCE_MODE` resolves to `json`;
- `DATABASE_URL` is not required;
- normal `npm test`, `npm run typecheck`, and `npm run build` do not require a database;
- public API response shapes are unchanged in JSON mode.

## Database Placeholder Behavior

`FLOWCHAIN_PERSISTENCE_MODE=database` still reaches the existing safe placeholder:

```text
Database persistence adapter is not implemented yet. Use FLOWCHAIN_PERSISTENCE_MODE=json.
```

That placeholder is only selected when database mode is explicitly requested. It is intentionally not a real database adapter and does not connect to a database.

R23 should sanitize global error responses before any database scaffold is added. R24 should block legacy mutation routes in database mode before real DB adapters are introduced.

## Testing Strategy

R22 adds a lightweight server factory wiring test that verifies:

- `createRepositoryRegistry` is imported by the main server route module;
- the registry is created from `{ db, env: process.env }`;
- `repositories` is added to `routeContext`;
- registry creation occurs before route dispatch.

Existing route tests verify the injected repository behavior for:

- Master Data;
- Procurement read;
- Inventory read;
- Action Draft preview.

## Non-Goals

This round does not:

- add Prisma, Drizzle, or any ORM;
- add a database connection;
- add migrations;
- implement database adapters;
- change API response shapes;
- remove JSON fallback repositories;
- migrate legacy mutation routes;
- block mutation routes yet;
- mutate `data/scm-demo.json`.
