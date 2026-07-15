# Receiving PostgreSQL verification

This runbook closes the database gate for the PO → GRN → inventory → PO progress → audit → reversal transaction. It uses a real PostgreSQL server and never substitutes runtime JSON or an in-memory database.

## Prerequisites

- Node.js 20 or newer and the repository dependencies installed with `npm install`.
- PostgreSQL 16 is recommended. The checked-in harness pins workspace-local Embedded PostgreSQL 16.14, so Docker and a system PostgreSQL installation are not required.
- Enough permission to execute the PostgreSQL binaries downloaded inside `node_modules`.
- Do not set real credentials in tracked files. `.env.test.local` is gitignored; `.env.test.example` contains placeholders only.

## Full isolated verification

Run:

```sh
npm run test:db:receiving
```

The command creates a temporary PostgreSQL cluster in the operating system's temporary directory, chooses a free loopback port, generates a local-only random password, and creates three isolated databases:

1. `flowchain_receiving_fresh_test` for fresh `prisma migrate deploy` and all posting/reversal tests.
2. `flowchain_receiving_baseline_test` for baseline-only schema, preserved legacy data, additive migration, and posting tests.
3. `flowchain_receiving_duplicate_test` for duplicate balance preflight and expected migration refusal.

The cluster and all three databases are deleted when the command finishes. No password or complete connection URL is printed. An existing `DATABASE_URL_TEST` is not modified or used by the full destructive migration scenarios; the isolated embedded cluster is always used.

On success, expect:

- Fresh database: 15 tests passed, 0 failed, 0 skipped.
- Baseline upgrade: 11 tests passed, 0 failed, 0 skipped.
- Duplicate preflight: one duplicate group found, additive migration rejected with `FLOWCHAIN_INVENTORY_BALANCE_DUPLICATES`, and both source rows retained.
- Final line: `PostgreSQL receiving verification: PASS`.

The command fails with a non-zero exit code if PostgreSQL cannot start, a migration fails unexpectedly, any DB test fails, or a required DB test reports a skip.

## Dedicated external test database

For directed tests against an independently provisioned disposable database, copy `.env.test.example` to an untracked `.env.test.local`, set `DATABASE_URL_TEST`, and export the same value as `DATABASE_URL` before invoking the test files. First verify the host, database, schema, current user, and PostgreSQL version yourself. The database name must clearly identify it as a test database.

```sh
FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS=true node --test --test-concurrency=1 \
  server/domain/receiving-posting-transaction.test.mjs \
  server/domain/receiving-reversal-transaction.test.mjs
```

If `FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS=true` and `DATABASE_URL_TEST` is missing, the DB tests fail instead of skipping.

## Migration scenarios

### Fresh database

The verification script creates an empty database, runs `prisma migrate deploy`, then checks the command-execution table, receiving posting columns, balance natural-key unique index, and idempotency unique index before running the transactions.

### Baseline upgrade

The script applies the authoritative baseline SQL, records that baseline migration as applied, inserts a legacy tenant/item/warehouse/balance marker, and then runs `prisma migrate deploy`. It confirms the marker remains, the normalized keys are populated, the version default is present, and a new receiving transaction succeeds.

Do not mark the additive migration as applied unless its SQL has actually completed.

### Duplicate balance preflight

Run `prisma/migrations/20260715011000_receiving_posting_foundation/preflight.sql` as a read-only query before upgrading an existing database. Each returned group requires a business-approved correction based on:

```text
tenantId + sku + coalesce(warehouseId, '') + lower(trim(coalesce(location, '')))
```

The migration intentionally raises `FLOWCHAIN_INVENTORY_BALANCE_DUPLICATES`. It does not merge, update, or delete either row. Remediation must be reviewed case by case: select the rows `FOR UPDATE` in a maintenance transaction, choose the authoritative row, reconcile quantities against immutable movements, update references if required, remove only the business-approved duplicate, rerun the preflight, and commit only after reconciliation is exact. Keep the transaction rolled back until that approval exists.

## What the DB tests prove

- Partial and full receiving, over-receipt rejection, atomic rollback injection, fixed-scale quantities, audit and command execution persistence.
- Same-key replay and changed-payload conflict backed by the database unique constraint.
- Same-key and different-key concurrent posting through two independent Prisma clients/connection pools.
- `SERIALIZABLE`, GRN `SELECT ... FOR UPDATE`, version checks, and unique constraints prevent duplicate posting.
- Tenant-scoped posting and reversal fail closed.
- Safe reversal, double-reversal rejection, downstream-consumption refusal, retained original movements and reversal reason.
- Reconciliation after posting, reversal, and multiple GRNs to one balance.

The test files are scheduled serially so cleanup for unrelated tenants does not introduce artificial `SERIALIZABLE` conflicts. The explicit concurrency cases remain simultaneous and use independent clients.

## Cleanup and troubleshooting

Normal exit automatically stops PostgreSQL and deletes its temporary data directory. If the process is terminated forcibly, stop any orphan PostgreSQL process that points to a `flowchain-receiving-pg-*` directory under the OS temporary directory, then delete only that verified temporary directory.

Common failures:

- PostgreSQL binary execution blocked: allow the workspace dependency or use an approved dedicated test server.
- Port race: rerun; the script obtains a new free loopback port each time.
- `FLOWCHAIN_INVENTORY_BALANCE_DUPLICATES`: run the read-only preflight and perform approved reconciliation; never bypass the check.
- Any `# skipped` value above zero: treat the gate as failed.
- Prisma migration failure: preserve the database for diagnosis; do not run `prisma migrate reset` against an unknown database.

## Production prohibitions

Never run this harness against production, staging, a developer's business database, or any database whose isolation is uncertain. Never commit a password, dump, data volume, `.env`, or `.env.test.local`. Do not use `prisma migrate reset`, truncate an existing business database, auto-merge duplicate balances, or mark a failed additive migration as applied.

## Recorded verification

On 2026-07-15, the full command completed against real Embedded PostgreSQL 16.14 on Windows x64: fresh migration and transaction tests passed, baseline upgrade and transaction tests passed, duplicate preflight rejected the migration without changing either duplicate row, and no required DB test was skipped.
