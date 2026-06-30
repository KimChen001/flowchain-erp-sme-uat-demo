# Server Error and Health Safety v1

Round 23 sanitizes server-level error responses and removes provider diagnostics from the default health endpoint.

## Error Policy

Unexpected server errors now return a generic user-facing response:

```json
{ "error": "Internal server error" }
```

The response must not include:

- raw exception messages;
- stack traces;
- provider token values;
- environment variable names and values;
- database connection strings;
- filesystem paths from future database or ORM errors.

Internal warning logs may include a short sanitized summary through `sanitizeErrorSummary`, with known credential-like patterns redacted.

## Safe Error Helper

New helper:

- `server/utils/safe-errors.mjs`

Exports:

- `GENERIC_INTERNAL_ERROR`
- `sanitizeErrorSummary(error)`
- `sendInternalServerError(res, send, error, options)`

`server/routes/scm-legacy.routes.mjs` now uses this helper in the global catch block.

Route-level validation errors remain unchanged where they are intentional business or workflow feedback. Future rounds can review individual route messages separately if they become database or provider-backed.

## Health Endpoint

Default `GET /api/health` remains available and now returns only safe runtime readiness fields:

- `ok`
- `persistenceMode`
- `timestamp`
- current demo/read-model counts:
  - `purchaseOrders`
  - `purchaseRequests`
  - `inventoryMovements`
  - `receivingDocs`

The default health endpoint no longer returns:

- OpenAI key presence;
- Doubao/ARK key presence;
- selected AI provider;
- selected model;
- proxy availability flags;
- database URL or database credential state.

## Persistence Mode Note

Health computes the safe persistence mode through `getPersistenceMode(process.env)`.

Repository registry creation remains after health handling, so the explicit database-mode placeholder does not make `/api/health` itself fail before a real database adapter exists.

Business routes still create `createRepositoryRegistry({ db, env: process.env })` during normal dispatch.

## Diagnostics

No diagnostics endpoint is added in this round.

If future diagnostics are needed, they should be:

- disabled by default;
- enabled only by explicit dev/test configuration;
- sanitized;
- free of key presence, model names, proxy values, and database credential details unless there is a strong reviewed reason.

## Tests

R23 tests verify:

- global 500 responses use the generic error payload;
- raw error text, keys, and database URLs are not returned;
- sanitized log summaries redact secret-like strings;
- default health source no longer includes provider/key/model/proxy fields;
- the global catch calls the safe error helper.

## Non-Goals

This round does not:

- change business route validation semantics broadly;
- remove dev logging entirely;
- add auth or RBAC around health;
- add diagnostics endpoints;
- add a database;
- add an ORM;
- enable external AI providers;
- mutate `data/scm-demo.json`.
