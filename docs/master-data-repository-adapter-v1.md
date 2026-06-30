# Master Data Repository Adapter v1

Round 19 moves Master Data read access toward repository-backed adapters while preserving existing API behavior.

## Repository methods

Current implementation: `server/repositories/json-master-data-repository.mjs`.

Methods:

- `listItems()`
- `getItem(idOrSku)`
- `listSuppliers()`
- `getSupplier(idOrName)`
- `listWarehouses()`
- `listPaymentTerms()`
- `listTaxCodes()`

The adapter delegates to the existing Master Data read model and does not duplicate mapping logic.

## Route wiring

`server/routes/master-data.routes.mjs` now prefers `ctx.repositories.masterData` when provided and falls back to the JSON repository. Response shapes remain unchanged:

- `{ items }`
- `{ item }`
- `{ suppliers }`
- `{ supplier }`
- `{ warehouses }`
- `{ paymentTerms }`
- `{ taxCodes }`

Missing item and supplier responses remain the same 404 payloads.

## JSON behavior

The JSON implementation remains the default through the adapter registry. It reads from the in-memory demo DB object and does not mutate `data/scm-demo.json`.

## Future database mapping

Future database adapters should map the same methods to:

- Item
- Supplier
- Warehouse
- Location / Bin
- PaymentTerm
- TaxCode

Those adapters should satisfy the JSON adapter contract tests before becoming route defaults.

## Non-goals

- No database connection.
- No ORM package.
- No Master Data write APIs.
- No response shape change.
- No tenant or permission system expansion.
- No demo data mutation.
