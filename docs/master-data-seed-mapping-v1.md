# Master Data Seed Mapping v1

Round 27 documents how existing JSON demo Master Data can be seeded into the Prisma foundation models later. This round does not add an automatic seed script and does not modify `data/scm-demo.json`.

## Tenant Assumption

Initial seed runs should create or reuse:

- `Tenant.id`: `tenant-flowchain-sme`
- locale/currency from the operator-selected environment or current demo defaults.

All Master Data rows should be scoped to this tenant.

## Seed Order

Recommended order:

1. `Tenant`
2. `PaymentTerm`
3. `TaxCode`
4. `Supplier`
5. `Warehouse`
6. `Item`

Items should be loaded after suppliers so `preferredSupplierId` can link to a known supplier when possible.

## Supplier Mapping

JSON source: `db.suppliers`.

Prisma target: `Supplier`.

Mapping:

- `id` or `supplierId` -> `Supplier.id`
- derived tenant -> `tenantId`
- `code` -> `code`
- `name` or `supplierName` -> `name`
- `category` or `type` -> `category`
- `status` -> `status`
- normalized `risk` -> `riskLevel`
- `score`, `rating`, or derived performance score -> `score` when explicit and numeric
- remaining compatibility fields -> `metadata`

Metadata candidates:

- `defaultCurrency`
- `paymentTermsId`
- `paymentTerms`
- `categories`
- `preferred`
- fallback score source
- source row identifiers

## Item Mapping

JSON source: `db.products`.

Prisma target: `Item`.

Mapping:

- `id`, `itemId`, or derived SKU id -> `Item.id`
- derived tenant -> `tenantId`
- `sku`, `code`, or item id -> `sku`
- `name` or `itemName` -> `name`
- `category` -> `category`
- `unit`, `uom`, or `baseUom` -> `unit`
- resolved supplier id -> `preferredSupplierId`
- `status` -> `status`
- `safetyStock` -> `safetyStock`
- `reorderPoint` -> `reorderPoint`
- remaining compatibility fields -> `metadata`

Metadata candidates:

- `defaultWarehouseId`
- `warehouseId`
- `leadTimeDays`
- `moq`
- `minimumOrderQuantity`
- `batchMultiple`
- preferred supplier resolution source

## Warehouse Mapping

JSON source: `db.warehouses`, plus explicit operator-selected defaults.

Prisma target: `Warehouse`.

Mapping:

- `id` or `warehouseId` -> `Warehouse.id`
- derived tenant -> `tenantId`
- `code` or id -> `code`
- `name` or `label` -> `name`
- `status` -> `status`
- child/location details -> `metadata`

Derived warehouses from item or movement references should be reviewed before seeding. Do not blindly seed every inferred reference without operator approval.

## Payment Term Mapping

JSON source: `db.paymentTerms`.

Prisma target: `PaymentTerm`.

Mapping:

- `id`, `paymentTermsId`, or `code` -> `PaymentTerm.id`
- derived tenant -> `tenantId`
- `code` or id -> `code`
- `label` or `name` -> `name`
- `days` or `netDays` -> `days`
- remaining display/source fields -> `metadata`

If no source data exists, an explicit operator seed may create `NET30`.

## Tax Code Mapping

JSON source: `db.taxCodes`.

Prisma target: `TaxCode`.

Mapping:

- `id`, `taxCodeId`, or `code` -> `TaxCode.id`
- derived tenant -> `tenantId`
- `code` or id -> `code`
- `label` or `name` -> `name`
- `rate` -> `rate`
- `taxType` -> `taxType`
- `region` -> `region`
- remaining display/source fields -> `metadata`

If no source data exists, an explicit operator seed may create a default standard tax code appropriate for the target demo locale.

## Fields Skipped Or Deferred

Do not seed these as Master Data writes in the adapter round:

- procurement documents;
- inventory balances and movements;
- supplier invoices;
- three-way match records;
- action draft persistence;
- audit history beyond explicit future seed/test data.

## Future Seed Script Direction

A future explicit seed script should:

- require database mode and a non-production target;
- support dry-run output;
- never run as part of normal `npm test`, `npm run typecheck`, or `npm run build`;
- read a committed or operator-specified source snapshot, not assume local unstaged changes;
- report skipped fields and unresolved supplier/warehouse references.
