# FlowChain Prisma Scaffold

This scaffold is opt-in and not used by the default JSON runtime.

## Commands

- `npm run db:generate`: generate Prisma Client.
- `npm run db:push`: push schema to an explicitly configured database.
- `npm run db:migrate`: create/apply a development migration.
- `npm run db:studio`: open Prisma Studio.

All commands require an explicit `DATABASE_URL` through `prisma.config.ts`. Normal `npm test`, `npm run typecheck`, and `npm run build` do not require a database.

## Current Scope

The initial schema covers low-risk persistence foundations:

- tenant/user context;
- master data references;
- action draft preview shell;
- action draft validation and audit trail;
- audit log;
- compact AI evidence.

It intentionally does not add procurement, receiving, inventory posting, finance, payment, tax filing, or supplier-message write workflows.
