# JSON Adapter Contract Tests v1

Round 16 locks the current JSON/demo-data-backed behavior before FlowChain introduces any database adapter. These tests are adapter contracts: future persistence implementations should satisfy the same observable read, preview, audit, and evidence shapes before route behavior is migrated away from the JSON snapshot.

## Contract categories

- Master Data read contract: item, supplier, warehouse, payment term, and tax code reads are stable, safe, and non-mutating.
- Inventory read contract: item, lot, serial, movement, exception, and summary read models expose stable shapes and handle missing arrays safely.
- Procurement read contract: document, link, follow-up, summary, canonical document type, missing ID, and invalid type behavior remain stable.
- Today Cockpit aggregation contract: top-level fields, deterministic output, canonical evidence, and draft-first recommendations remain stable.
- Action Draft preview contract: supported draft schema, PR/RFQ/supplier follow-up previews, unsupported type failures, missing field validation, preview-only, and no business record creation are locked down.
- Audit log contract: audit entries can be listed and recorded through the current repository helper without leaking secrets or stack traces.
- AI evidence/read-model contract: deterministic cockpit/evidence-reuse answers use stable evidence and fake provider keys do not enable external provider access.

## Shared helpers

The helper module `server/domain/json-adapter-contract-helpers.test.mjs` provides:

- `deepCloneFixture`
- `assertNoMutation`
- `loadDemoDbSnapshot`
- `expectNoSecrets`
- `expectNoStackTrace`
- `expectPreviewOnly`
- `expectCanonicalEvidence`
- `expectStableTopLevelFields`

The helpers intentionally load the demo snapshot read-only and never write `data/scm-demo.json`.

## How to run

Run only the contract suite:

```bash
npm run test:contracts
```

Run the full server domain suite:

```bash
npm test
```

Round-level validation still uses:

```bash
npm test
npm run typecheck
npm run build
git diff --check
git status
```

## Future database adapters

A database-backed adapter should pass these contract categories before routes are broadly moved behind the adapter registry. The expected migration path is:

1. Keep JSON as the default runtime mode.
2. Add database adapters behind the same repository boundaries.
3. Run JSON and database adapters against the same contract expectations.
4. Migrate route dependencies only after contract parity is proven.

## Non-goals

- No production database connection.
- No Prisma, Drizzle, migration files, or `DATABASE_URL` requirement.
- No route behavior rewrite.
- No procurement, inventory, or master data write behavior.
- No supplier message sending.
- No external AI provider calls.
- No mutation of the demo JSON snapshot.
