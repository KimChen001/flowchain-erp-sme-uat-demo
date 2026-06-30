# System Harness and Product Review v1

## Purpose

This round adds a repeatable lightweight system harness for FlowChain after Rounds 1-11. The harness is not a full browser E2E suite. It is a product-path and contract-level safety net that exercises the JSON/demo-data-backed read models, route handlers, AI safety boundaries, draft-first flows, evidence navigation shape, typography guardrails, and documentation consistency.

Primary test file:

- `server/domain/system-harness-product-review.test.mjs`

Run with:

- `npm test`
- or targeted: `node --test server/domain/system-harness-product-review.test.mjs`

## Harness Categories

### Core Business Path Harness

Covered by the system harness:

- Today Cockpit returns `summary`, `cards`, `followups`, `inventoryRisks`, `recentDocuments`, `recentMovements`, `recommendedActions`, and `evidence`.
- Today Cockpit inventory risk points to a SKU focus target.
- Today Cockpit procurement follow-up actions include safe evidence.
- Global Search returns canonical focus target shape for PO lookup.
- AI cockpit answer returns evidence-backed deterministic content.

### Draft-first Invariant Harness

Covered by the system harness and existing draft tests:

- `POST /api/action-drafts/preview` remains preview-only.
- PR draft preview does not create a real PR.
- RFQ draft preview does not create a real RFQ.
- Supplier follow-up draft preview does not send supplier messages.
- Drafts keep `requiresConfirmation: true`.
- Drafts keep `confirmationBoundary.previewOnly: true` and `submitted: false`.
- Unsupported real-write draft types fail cleanly.

### AI Safety / Latency Harness

Covered by the system harness and AI-specific tests:

- External providers are disabled unless explicitly opted in.
- Fake `OPENAI_API_KEY`, `ARK_API_KEY`, and `DOUBAO_API_KEY` do not enable provider calls.
- Cockpit prompt `今天最需要处理什么？` uses deterministic local fast path.
- Provider-disabled fallback is sanitized.
- Payloads do not expose fake keys, bearer tokens, stack traces, or raw provider errors.
- Cockpit fast path does not wait for audit persistence.
- Read-only AI answers stay successful when DB audit persistence fails.

### Evidence / Navigation Harness

Covered by source-level and route-level assertions:

- Canonical evidence helper maps PR, RFQ, PO, GRN, invoice, three-way match, SKU, and supplier evidence.
- Broken evidence is not made clickable.
- Global Search, AI evidence, and Today Cockpit evidence use compatible focus target shape.
- Today Cockpit recommended actions keep evidence arrays.

### Typography / UI Consistency Harness

Covered by lightweight source checks:

- Typography tokens define table header/body/link/chip/form/button scale.
- `tableLinkClass` remains the standard table ID link style.
- Today Cockpit does not use compact amount strings such as `万元` or compact notation.

The grep review for `万`, `万元`, `compactDisplay`, `notation:.*compact`, `formatCompact`, and `toWan` still finds historical docs/tests and a few non-core chart/sales labels. Those are documented as outside the current SCM core table/customer-facing amount boundary for this round. No broad UI rewrite is included here.

### API Contract Harness

Covered by route-handler tests:

- `GET /api/today-cockpit`
- `GET /api/procurement/documents`
- `GET /api/procurement/documents/:type/:id`
- `GET /api/procurement/links`
- `GET /api/procurement/followups`
- `GET /api/procurement/summary`
- inventory read APIs for items, item detail, movements, exceptions, and summary
- `GET /api/action-drafts/schema`
- `POST /api/action-drafts/preview`
- `POST /api/ai/chat`

Checks include status, stable top-level fields, no mutation, clean invalid input behavior, and sanitized payloads.

### DB Adapter Parity Harness

Covered by `server/domain/db-adapter-parity-harness.test.mjs`:

- database-mode registry selects all migrated DB adapters;
- JSON-mode registry remains database-free;
- Master Data, Procurement Read, and Inventory Read DB rows keep public shape parity with JSON adapters;
- ActionDraft preview remains preview-only and non-mutating;
- AuditLog records keep compatible public keys and redact sensitive metadata;
- read adapters do not expose write-style methods.

### Audit Persistence Harness

Covered by `server/domain/audit-log-persistence.test.mjs`:

- ActionDraft save records a best-effort DB audit event without creating business documents;
- ActionDraft preview survives DB audit failure;
- database-mode legacy mutation block audit omits request bodies and secrets;
- read-only AI answers survive DB audit adapter failure.

### Test DB Seed Harness

Covered by `server/domain/master-data-db-parity.test.mjs`:

- Master Data seed rows are deterministic and non-mutating;
- explicit apply mode uses upserts against a safe test DB environment;
- Master Data DB parity skips cleanly without `DATABASE_URL_TEST`.

### Docs Consistency Harness

Docs reviewed for consistency with:

- draft-first boundary;
- PR/RFQ/supplier follow-up preview-only behavior;
- AI provider safety gate;
- AI audit latency hardening;
- AI timeout/cockpit fast path;
- evidence link boundary;
- Today Cockpit and procurement read model boundaries;
- database entity model v2 and future persistence boundary.

No broad doc rewrite is included in this round.

### Demo / UAT Scenario Harness

The harness locks the backend/helper-level readiness for a manual UAT flow:

- open Today Cockpit;
- inspect inventory risk;
- navigate to procurement evidence shape;
- search a PO;
- ask AI cockpit priority prompt;
- generate preview-only PR/RFQ/supplier follow-up drafts.

## Non-goals

- Do not add new product features.
- Do not add a browser E2E framework.
- Do not add a database.
- Do not enable external AI.
- Do not create real business writes.
- Do not redesign UI.
