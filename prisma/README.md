# FlowChain Prisma Scaffold

Database persistence is opt-in. The default JSON runtime remains available for
the existing UAT and preview modules, while formal receiving posting/reversal is
database-only and requires `FLOWCHAIN_ENABLE_DB_RECEIVING_POSTING=true`.

## Commands

- `npm run db:generate`: generate Prisma Client.
- `npm run db:push`: push schema to an explicitly configured database.
- `npm run db:migrate`: create/apply a development migration.
- `npm run db:studio`: open Prisma Studio.

All commands require an explicit `DATABASE_URL` through `prisma.config.ts`. Normal `npm test`, `npm run typecheck`, and `npm run build` do not require a database.

## Migration rollout

- Empty database: run `prisma migrate deploy`; the baseline migration creates
  the pre-existing schema and the following additive migration installs the
  receiving posting foundation.
- Existing database previously managed with `prisma db push`: back up the
  database, verify it matches `20260715010000_baseline`, then mark only that
  baseline as applied with `prisma migrate resolve --applied
  20260715010000_baseline`. Run the additive migration normally afterward.
- Before the additive migration, run
  `migrations/20260715011000_receiving_posting_foundation/preflight.sql`.
  Returned rows represent duplicate inventory-balance natural keys and require
  business-approved remediation. The migration fails closed and never removes
  or merges these records automatically.

Never mark the additive receiving migration as applied unless its columns,
indexes, constraints, and command-execution table already exist.

## Current Scope

The initial schema covers low-risk persistence foundations:

- tenant/user context;
- master data references;
- action draft preview shell;
- action draft validation and audit trail;
- audit log;
- compact AI evidence;
- transactional receiving posting and reversal;
- immutable receipt/reversal movements, balance reconciliation, PO received
  quantities, structured audit, database idempotency, and tenant isolation.

It does not add outbound posting, transfer, stock count, costing, AP/GL, tax
filing, supplier-message writes, or a complete warehouse UI.
