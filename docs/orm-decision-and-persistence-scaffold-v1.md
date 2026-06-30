# ORM Decision and Persistence Scaffold v1

Round 25 chooses Prisma and adds a minimal opt-in database scaffold.

Default runtime remains JSON/demo-data-backed. Normal `npm test`, `npm run typecheck`, and `npm run build` do not require `DATABASE_URL` or a live database.

## Decision

Selected toolkit: Prisma.

Rationale:

- Schema readability is useful for the entity model review path.
- Generated client conventions are easier to explain for future adapter work.
- Migration commands are familiar and well-documented for staging dry-runs.
- PostgreSQL support fits the current Aliyun RDS direction and JSON field needs.
- The repository boundary keeps Prisma out of route modules and default JSON mode.

Drizzle remains a reasonable alternative for a lean SQL-first service, but this round chooses one toolkit only. Drizzle is not installed.

## Files Added

- `prisma/schema.prisma`
- `prisma.config.ts`
- `prisma/README.md`
- `server/persistence/persistence-config.mjs`
- `server/persistence/prisma-client.mjs`
- `server/domain/persistence-scaffold.test.mjs`

## Package Scripts

- `npm run db:generate`
- `npm run db:push`
- `npm run db:migrate`
- `npm run db:studio`

These scripts are explicit operator commands. They are not run by normal test/build, and they do not run migrations automatically.

## Initial Schema Scope

The first schema covers low-risk foundations:

- `Tenant`
- `User`
- `Supplier`
- `Item`
- `Warehouse`
- `PaymentTerm`
- `TaxCode`
- `ActionDraft`
- `ActionDraftValidation`
- `ActionDraftAuditTrail`
- `AuditLog`
- `AiEvidence`

The schema intentionally excludes transactional procurement and inventory write models for now:

- no `PurchaseRequest`;
- no `RFQ`;
- no `PurchaseOrder`;
- no `ReceivingDocument` / `GRN`;
- no `SupplierInvoice`;
- no `InventoryMovement`;
- no finance, payment, or tax filing execution models.

## Prisma 7 Configuration

Prisma 7 keeps the datasource URL out of `schema.prisma`. FlowChain uses `prisma.config.ts` for migration/CLI datasource configuration:

```ts
datasource: {
  url: env('DATABASE_URL'),
}
```

This keeps schema modeling separate from environment configuration.

## Environment Behavior

Default:

```text
FLOWCHAIN_PERSISTENCE_MODE=json
```

JSON mode:

- ignores missing `DATABASE_URL`;
- does not import Prisma client through normal route handling;
- keeps existing demo JSON behavior;
- keeps the Round 24 database-mode mutation guard inactive.

Database mode:

```text
FLOWCHAIN_PERSISTENCE_MODE=database
DATABASE_URL=postgresql://...
```

- validates `DATABASE_URL` only when database mode is explicitly selected;
- returns a clean config error if database mode is selected without `DATABASE_URL`;
- does not enable legacy write routes;
- still depends on future DB adapters before runtime persistence can move from JSON read fallback to DB reads/writes.

## Prisma Client Loading

`server/persistence/prisma-client.mjs` dynamically imports `@prisma/client` only after `validateDatabasePersistenceConfig` succeeds.

This prevents default JSON mode from connecting to, generating for, or requiring a database.

## Relation to Route Mutation Guard

Round 24 remains active:

- read-only and preview-only routes can continue in database mode;
- legacy mutation routes are blocked in database mode until migrated;
- no procurement/inventory JSON write route is allowed while claiming database persistence mode.

## Test Strategy

R25 tests verify:

- JSON default does not require `DATABASE_URL`;
- `DATABASE_URL` alone does not switch the runtime out of JSON mode;
- explicit database mode without `DATABASE_URL` throws a clean config error;
- Prisma client dynamic import happens only after config validation;
- the schema includes only the initial low-risk models.

## Non-Goals

This round does not:

- connect runtime routes to Prisma;
- run migrations;
- create a live database;
- migrate JSON data;
- persist ActionDraft/AuditLog through DB adapters;
- implement procurement, receiving, inventory, finance, payment, or tax write workflows;
- remove JSON mode;
- require `DATABASE_URL` for normal test/build;
- enable external AI providers;
- mutate `data/scm-demo.json`.
