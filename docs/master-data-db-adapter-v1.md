# Master Data DB Adapter v1

Round 27 adds a read-only database-backed adapter for Master Data while keeping JSON mode as the default runtime.

## Scope

Database mode now uses DB adapters for:

- `masterData`
- `actionDrafts`
- `auditLog`

Database mode still uses JSON read fallback for:

- `procurementRead`
- `inventoryRead`

No Master Data write API is added.

## Models

The adapter uses the existing Prisma foundation models:

- `Item`
- `Supplier`
- `Warehouse`
- `PaymentTerm`
- `TaxCode`

No schema change is required in this round. Compatibility details that do not have stable first-class columns yet are read from `metadata`.

## Adapter Methods

File: `server/repositories/db-master-data-repository.mjs`

Methods:

- `listItems(filters)`
- `getItem(idOrSku, options)`
- `listSuppliers(filters)`
- `getSupplier(idOrName, options)`
- `listWarehouses(filters)`
- `listPaymentTerms(filters)`
- `listTaxCodes(filters)`

All methods are read-only. They validate database configuration when invoked and do not connect during registry creation.

## Response Compatibility

The DB adapter maps Prisma rows to the current Master Data API read shapes:

- items expose `id`, `sku`, `name`, `category`, `baseUom`, `defaultWarehouseId`, `preferredSupplierId`, `leadTimeDays`, `moq`, `batchMultiple`, and `status`;
- suppliers expose `id`, `name`, `status`, `risk`, `score`, `defaultCurrency`, `paymentTermsId`, `categories`, and `preferred`;
- warehouses expose `id`, `name`, `type`, `status`, `parentId`, and `sourceType`;
- payment terms expose `id`, `label`, `days`, `status`, and `sourceType`;
- tax codes expose `id`, `label`, `rate`, `status`, and `sourceType`.

Missing item or supplier lookups return `null`, preserving the current route 404 behavior.

## Registry Behavior

JSON mode:

- all repositories use JSON adapters.

Database mode:

- `masterData`: DB adapter;
- `actionDrafts`: DB adapter;
- `auditLog`: DB adapter;
- `procurementRead`: JSON read fallback;
- `inventoryRead`: JSON read fallback.

Legacy mutation routes remain blocked by the database-mode mutation guard.

## Clean Config Errors

Missing `DATABASE_URL` does not affect JSON mode. In database mode, calling a Master Data DB method without `DATABASE_URL` raises the controlled `FLOWCHAIN_DATABASE_CONFIG_MISSING` error.

Normal `npm test`, `npm run typecheck`, and `npm run build` do not require a live database.

## Test Strategy

Default tests use mocked Prisma clients for DB mapping checks.

Tests cover:

- JSON mode unchanged;
- database mode selects DB MasterDataRepository;
- procurement and inventory remain JSON fallback;
- mocked Prisma rows map to the current read shapes;
- missing `DATABASE_URL` fails cleanly only when a DB method is invoked;
- route response shape remains stable with injected repositories.

No live DB test is required for this round.

## Non-Goals

- No Master Data write APIs.
- No automatic seeding.
- No modification to `data/scm-demo.json`.
- No procurement or inventory DB adapter migration.
- No default runtime switch to DB.
- No tenant or permission expansion beyond the existing tenant filter assumption.
