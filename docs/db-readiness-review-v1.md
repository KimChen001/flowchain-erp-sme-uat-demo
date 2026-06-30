# DB Readiness Review v1

Round 28 adds the first explicit database test and seed harness while keeping JSON mode as the default runtime.

## Current Status

- JSON mode remains the default.
- Normal `npm test`, `npm run typecheck`, and `npm run build` do not require `DATABASE_URL`, `DATABASE_URL_TEST`, or a live database.
- Database mode is opt-in through `FLOWCHAIN_PERSISTENCE_MODE=database`.
- DB adapter coverage currently includes ActionDraft, AuditLog, and Master Data.
- Procurement Read and Inventory Read remain JSON fallback repositories in database mode until later rounds.
- Legacy mutation routes remain blocked in database mode by the route mutation guard.

## Test DB Harness

The test DB harness is explicit and safe by default:

- `DATABASE_URL_TEST` is the only database URL accepted by the harness.
- Missing `DATABASE_URL_TEST` produces a clean skip reason.
- Production-like test database names are refused unless `FLOWCHAIN_ALLOW_PRODUCTION_TEST_DB=true` is explicitly set.
- `DATABASE_URL_TEST` is mapped to `DATABASE_URL` only inside the test database helper environment.
- Default test/build commands do not call the helper in a way that opens a live database connection.

Command:

```bash
npm run test:db
```

Without `DATABASE_URL_TEST`, this command verifies the skip/config behavior only.

## Seed Strategy

Round 28 adds a dry-run seed plan for Master Data foundations:

- Tenant
- PaymentTerm
- TaxCode
- Supplier
- Warehouse
- Item

Command:

```bash
npm run db:seed:dry-run
```

The command reads the committed demo JSON as source input, returns a deterministic plan, and does not mutate `data/scm-demo.json`. Apply mode is intentionally not implemented in this round.

## Remaining Gaps

- Procurement Read DB adapter.
- Inventory Read DB adapter.
- Master Data executable test DB seed and parity check.
- ActionDraft persistence end-to-end.
- AuditLog persistence end-to-end.
- CI database service strategy.
- Aliyun staging database strategy.
- Tenant/user permission boundary.
- Controlled business write workflow prerequisites.
