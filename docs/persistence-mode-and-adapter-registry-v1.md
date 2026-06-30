# Persistence Mode and Adapter Registry v1

Round 17 introduces a lightweight persistence mode helper and adapter registry skeleton. Runtime behavior remains JSON/demo-data-backed by default.

## Persistence mode

The helper `getPersistenceMode(env)` reads `FLOWCHAIN_PERSISTENCE_MODE`.

Supported values:

- `json`: default and current runtime behavior.
- `database`: opt-in database-readiness mode. Rounds 26-30 add DB adapters for ActionDraft, AuditLog, Master Data, Procurement Read, and Inventory Read.

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
- `procurementRead`: DB adapter
- `inventoryRead`: DB adapter
- `aiConversation`: future adapter placeholder

The DB adapters validate `DATABASE_URL` only when their database-backed methods are invoked. JSON mode still ignores missing database configuration.

The Procurement Read DB adapter is read-only. It supports the same public read categories as the JSON repository: document list/detail, links, followups, summary, and document type helpers.

The Inventory Read DB adapter is read-only. It supports the same public read categories as the JSON repository: items, lots, serials, movements, exceptions, summary, and item lookup aliases.

## Parity Harness

Round 31 adds a mocked DB adapter parity harness. It checks:

- database-mode registry selection for all migrated adapters;
- JSON-mode registry behavior without database configuration;
- public row shape parity for Master Data, Procurement Read, and Inventory Read;
- preview-only parity for ActionDraft;
- AuditLog shape compatibility and redaction;
- no write-style methods on read adapters.

Round 35 adds a Procurement Read DB parity harness. It compares mocked Prisma output against the JSON procurement contract for document lists, document detail lookups, links, followups, summary keys, type helpers, missing document behavior, no mutation, Today Cockpit compatibility, AI procurement compatibility, and route guard stability. It does not add procurement write APIs or require a live database for default tests.

## Test DB Harness

Round 28 adds an explicit test database harness for future adapter parity work. It is not part of the default runtime path.

- `npm run test:db` validates the harness and skips cleanly when `DATABASE_URL_TEST` is missing.
- `DATABASE_URL_TEST` is mapped to database mode only inside the helper environment.
- Production-like test database URLs are refused unless `FLOWCHAIN_ALLOW_PRODUCTION_TEST_DB=true` is explicitly set.
- `npm test`, `npm run typecheck`, and `npm run build` still do not require any database URL.

Round 28 also adds `npm run db:seed:dry-run`, which builds a deterministic Master Data seed plan without writing to a database or mutating `data/scm-demo.json`.

Round 32 adds `npm run db:seed:master-data` and `npm run test:db:master-data`. The seed command defaults to dry-run and only applies through the explicit script `--apply` path with `DATABASE_URL_TEST`. The parity command skips cleanly when `DATABASE_URL_TEST` is absent.

## ActionDraft Persistence

Round 33 adds explicit ActionDraft shell persistence:

- `POST /api/action-drafts/preview` remains non-mutating and does not call `persistDraft`.
- `POST /api/action-drafts` and `POST /api/action-drafts/save` call `persistDraft` only when the database adapter is active.
- JSON mode returns a demo-safe `501`.
- Saving a draft does not create PR/RFQ/PO records, send supplier messages, confirm drafts, or mutate inventory.

## AuditLog Persistence

Round 34 wires safe system events to the DB AuditLog adapter in database mode:

- `draft_previewed`
- `draft_saved`
- `legacy_mutation_blocked`
- AI best-effort events such as `ai_draft_prepared` and provider-blocked fallbacks

Audit writes are best-effort for read-only and draft flows. A missing `DATABASE_URL` or audit write failure does not break AI read answers, draft preview, draft save responses after the draft is persisted, or the database-mode mutation guard response. Audit payloads use route and draft summaries rather than raw request bodies, prompts, bearer tokens, API keys, stack traces, or database URLs.

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
