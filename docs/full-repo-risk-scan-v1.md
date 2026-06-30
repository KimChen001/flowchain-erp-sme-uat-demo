# Full Repository Risk Scan v1

Round 21 records the remaining repository, routing, diagnostics, and database-readiness risks before adding ORM or database scaffolding.

This is an evidence and planning round only. It does not change runtime behavior, add a database, add an ORM, or mutate demo data.

## Scope

Core scope scanned:

- `server`
- `src`
- `docs`

Protected local file:

- `data/scm-demo.json` was intentionally not read for mutation, edited, staged, or committed.

## Scan Commands

The following searches were run or split where PowerShell quoting made the combined pattern unsafe:

```powershell
git grep -n "writeDb" -- server src docs
git grep -n "error.message" -- server src
git grep -n "OPENAI_API_KEY\|ARK_API_KEY\|DOUBAO_API_KEY\|DATABASE_URL" -- server src docs
git grep -n "method: \"POST\"\|method: 'POST'\|fetch(.*POST\|apiJson" -- src server
git grep -n "purchase-requests\|purchase-orders\|rfqs\|receiving\|inventory-movements" -- src server
git grep -n "ctx.repositories\|createRepositoryRegistry\|createJson.*Repository" -- server
git grep -n "text-\[10px\]\|text-\[11px\]\|text-xs\|compactDisplay\|万元\|万" -- src server docs
```

Split scans used for POST/client calls:

```powershell
git grep -n "method: 'POST'" -- src server
git grep -n 'method: "POST"' -- src server
git grep -n "apiJson" -- src server
git grep -n "fetch(" -- src server
```

## Confirmed Findings

### Repository Wiring Gaps

Severity: High

Recommended fix round: R22

Findings:

- `server/repositories/adapter-registry.mjs` defines `createRepositoryRegistry({ db, env })`.
- `server/routes/scm-legacy.routes.mjs` does not import `createRepositoryRegistry`.
- `routeContext` in `server/routes/scm-legacy.routes.mjs` does not include `repositories`.
- Repository-compatible routes therefore still use local JSON fallback repositories:
  - `server/routes/master-data.routes.mjs`
  - `server/routes/procurement-read.routes.mjs`
  - `server/routes/inventory.routes.mjs`
  - `server/routes/action-drafts.routes.mjs`

Risk:

- Database mode cannot be meaningfully exercised by routes because the registry is not injected.
- Future DB adapters may exist but remain unused by runtime routes.
- Fallback JSON repositories are safe for current JSON mode, but they hide missing DI wiring.

Immediate blocker before ORM:

- Wire `createRepositoryRegistry({ db, env: process.env })` into `routeContext` and test that routes prefer `ctx.repositories`.

### Direct JSON Write Paths

Severity: High

Recommended fix round: R24

Findings:

Legacy route handlers still call `writeDb` directly in route groups including:

- `server/routes/market.routes.mjs`
- `server/routes/purchase-orders.routes.mjs`
- `server/routes/purchase-requests.routes.mjs`
- `server/routes/receiving.routes.mjs`
- `server/routes/rfqs.routes.mjs`
- `server/routes/scm-legacy.routes.mjs`
- `server/routes/sop.routes.mjs`

AI audit has a best-effort write path:

- `server/routes/ai.routes.mjs` records sanitized audit events through `recordAiEventBestEffort`.
- Some AI fast paths pass `persist: false`.

Risk:

- If database mode is added before route mutation classification, legacy write paths could still mutate JSON while the runtime claims database persistence.
- Manual demo workflow writes need an explicit database-mode guard until migrated.
- AI audit write failures are currently best-effort and should remain non-blocking, but the persistence target must be explicit.

Immediate blocker before ORM:

- Classify every mutation path and block un-migrated legacy JSON writes when `FLOWCHAIN_PERSISTENCE_MODE=database`.

### Route Mutation Paths

Severity: High

Recommended fix round: R24

Findings:

Frontend `apiJson` calls still target mutation endpoints for manual/demo workflows:

- `/api/auth/login`
- `/api/forecast-plans`
- `/api/action-drafts/preview`
- `/api/ai/chat`
- `/api/purchase-requests`
- `/api/purchase-requests/:id/status`
- `/api/purchase-requests/:id/convert-to-po`
- `/api/rfqs`
- `/api/rfqs/:id/status`
- `/api/purchase-orders`
- `/api/purchase-orders/:id/status`
- `/api/receiving-docs`
- `/api/receiving-docs/:id`

Classification notes:

- `/api/action-drafts/preview` is preview-only and should remain allowed.
- `/api/ai/chat` is read/analysis plus best-effort audit; cockpit fast paths can avoid persistence.
- Purchase request, RFQ, PO, receiving, forecast, market refresh, S&OP, and auth/login routes are legacy/demo mutations.

Risk:

- The app still has valid manual demo writes, but they are not database-ready.
- The draft-first boundary is strong for AI action preparation, but legacy manual screens can bypass future draft-confirm flows.

Immediate blocker before ORM:

- Add route classification docs/metadata and a DB-mode guard for legacy mutation routes.

### Raw Error Exposure

Severity: High

Recommended fix round: R23

Findings:

- The global server catch in `server/routes/scm-legacy.routes.mjs` returns `{ error: error.message }`.
- Several route-level validation or workflow catches return `error.message` directly.
- Frontend modules display caught `error.message`, which is acceptable only when backend errors are sanitized.

Risk:

- Unexpected exceptions may leak implementation details, provider text, file paths, or future database errors.
- Future ORM errors could expose schema/table/connection details if not sanitized first.

Immediate blocker before ORM:

- Add a safe server error helper and replace the global catch response with a generic 500.
- Keep route-level domain validation messages only where they are intentionally user-facing.

### Provider, Key, and Diagnostic Exposure

Severity: High

Recommended fix round: R23

Findings:

`GET /api/health` currently returns provider and diagnostics fields including:

- OpenAI key presence
- Doubao/ARK key presence
- selected provider
- selected model
- proxy availability flags

AI provider route code reads:

- `OPENAI_API_KEY`
- `ARK_API_KEY`
- `DOUBAO_API_KEY`
- provider/model env vars

Risk:

- Health output reveals operational configuration that should not be public.
- Adding database diagnostics later could repeat the same pattern with `DATABASE_URL` or database state.

Immediate blocker before ORM:

- Make `/api/health` safe by default.
- Move any useful diagnostics behind an explicit dev/test-only diagnostics mode and keep values sanitized.

### Typography and Amount Regression

Severity: Medium

Recommended fix round: Watch in R22-R24; fix only if touched

Findings:

- Core SCM docs and tests already enforce that Today Cockpit should not use compact amount labels such as `万元` or `compactDisplay`.
- `src/modules/sales/Page.tsx` and `src/modules/suppliers/Page.tsx` still contain `万`/compact amount usage, but those modules are outside the current core SCM database-readiness scope.
- Many `text-xs`, `text-[10px]`, and `text-[11px]` classes remain across the UI.

Risk:

- Future touched core screens can regress into dense typography or compact money labels.
- Existing out-of-core pages may still look inconsistent with the refined SCM cockpit style.

Immediate blocker before ORM:

- None. Treat as a regression watch item unless a later round edits affected UI surfaces.

### Draft-First Bypass Risk

Severity: High

Recommended fix round: R24

Findings:

- AI draft preparation and `/api/action-drafts/preview` are preview-only.
- Legacy manual endpoints still create or update PR/RFQ/PO/GRN records directly in JSON.
- The draft-first story is accurate for AI-assisted actions, not for every manual demo workflow endpoint.

Risk:

- Without route classification, future database mode could imply a controlled draft-confirm write model while still allowing legacy direct writes.
- Users or tests may confuse preview-only AI boundaries with manual workflow behavior.

Immediate blocker before ORM:

- Document each route group as read-only, preview-only, legacy mutation, future mutation, or diagnostics/static.
- Block legacy mutations in database mode until intentionally migrated.

### Database Migration Blockers

Severity: High

Recommended fix rounds: R22-R24 before R25

Findings:

- `createDatabaseRepositoryRegistry()` is intentionally a placeholder and throws a clear not-implemented error only when database mode is explicitly selected.
- JSON mode remains safe by default and does not require `DATABASE_URL`.
- Registry injection is missing from `routeContext`, so database mode behavior is not route-visible yet.
- Legacy mutation routes have not been classified or guarded.
- Raw global errors and health diagnostics need sanitization before future DB errors/configuration exist.

Risk:

- Adding ORM before wiring/sanitization/guards would create confusing partial database behavior.
- A missing or misconfigured DB could be exposed through raw 500 responses.
- Legacy JSON writes could remain active under database mode unless guarded.

Immediate blocker before ORM:

- Complete R22, R23, and R24 first.

### Docs Mismatch

Severity: Medium

Recommended fix rounds: R22-R24

Findings:

- `docs/repository-boundary-v1.md` describes future `routeContext.repositories` injection.
- `docs/persistence-mode-and-adapter-registry-v1.md` states route wiring was not migrated in R17.
- R18-R20 added repository-compatible adapters/routes, but main `routeContext` still has no registry injection.
- `docs/backend-route-map-v1.md` has useful high-level mutation labels, but it is not yet a complete DB-mode guard source of truth.

Risk:

- Docs correctly show direction, but implementation now needs to catch up before ORM work starts.
- Without a single classification artifact, later DB adapter work may duplicate assumptions.

Immediate blocker before ORM:

- R22 should document actual routeContext injection.
- R24 should create a route mutation classification document and guard behavior.

## R22-R24 Follow-Up Plan

### R22: RouteContext Repository Registry Wiring v1

Recommended changes:

- Import `createRepositoryRegistry` in `server/routes/scm-legacy.routes.mjs`.
- Build `repositories` after `readDb()`.
- Add `repositories` to `routeContext`.
- Test JSON default behavior and route preference for injected repositories.
- Document the route groups now using the registry.

Expected result:

- JSON mode remains unchanged.
- Missing `FLOWCHAIN_PERSISTENCE_MODE` remains JSON.
- Unknown mode remains JSON.
- Explicit database mode reaches the placeholder only when selected.

### R23: Server Error Sanitization + Health Diagnostics Cleanup v1

Recommended changes:

- Add a safe error response helper.
- Replace global raw `error.message` 500 responses with a generic response.
- Keep internal logging short and secret-safe.
- Remove provider key presence, model, and proxy flags from default `/api/health`.
- Add tests proving no key/model/proxy/default diagnostic leakage.

Expected result:

- Future DB/provider errors are not exposed through global 500 responses.
- `/api/health` is safe as a public readiness endpoint.

### R24: Route Mutation Classification + DB Mode Guard v1

Recommended changes:

- Create complete route classification documentation.
- Add lightweight classification metadata/helpers if useful.
- In database mode, allow read-only and preview-only routes.
- In database mode, block legacy mutation routes with a clean 409/501 response until migrated.
- Keep default JSON behavior unchanged.

Expected result:

- Database mode cannot accidentally write to JSON through legacy mutation endpoints.
- Draft-first and manual legacy behavior are explicit.

## Non-Goals

This round intentionally does not:

- add Prisma, Drizzle, or any ORM;
- add a database connection;
- add migrations;
- require `DATABASE_URL`;
- change broad runtime behavior;
- remove legacy routes;
- rewrite the server;
- add real procurement, receiving, inventory, payment, finance, or tax write workflows;
- enable external AI providers;
- mutate `data/scm-demo.json`.

## Readiness Gate Before ORM

Do not start ORM/database scaffolding until these are complete:

1. `routeContext.repositories` is injected and tested.
2. Global server errors are sanitized.
3. Default health output no longer exposes provider/key/model/proxy diagnostics.
4. Legacy mutation routes are classified.
5. Database mode blocks un-migrated JSON write routes.
6. JSON mode remains default and passes normal `npm test`, `npm run typecheck`, and `npm run build` without `DATABASE_URL`.
