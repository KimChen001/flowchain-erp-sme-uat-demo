# Master Data API Field Map

## Purpose

This is an internal mapping document for the Master Data API-first frontend migration. It is not customer-visible.

The document explains how backend master-data read models are normalized into the current frontend table/detail shapes. It also records current compromises so future SRM, Inventory, Purchase Request, and AI activeContext migration work can reuse the same source-of-truth decisions without guessing.

## Source Endpoints

- `GET /api/master-data/items`
- `GET /api/master-data/suppliers`
- `GET /api/master-data/warehouses`
- `GET /api/master-data/payment-terms`
- `GET /api/master-data/tax-codes`

## Item Field Map

| Backend field | Frontend field | Mapping behavior | Fallback source | Notes |
| --- | --- | --- | --- | --- |
| `id` / `sku` | `sku` | Uses `sku` first, then `id`. | Matching fallback item by SKU/name, then index. | Keeps table row key stable when backend exposes SKU. |
| `name` | `name` | API value wins. | Fallback item name, then generated label. | Detail modal title uses this field. |
| `category` | `category` | API value wins. | Fallback item category, then `未分类`. | Used by table/search. |
| `baseUom` | `unit` | API value wins. | Fallback item unit, then `件`. | Backend read model names this as base UOM. |
| `defaultWarehouseId` | `defaultWarehouse` | API value wins. | Fallback default warehouse. | Current UI displays a label-like warehouse field; backend currently provides an ID. |
| `preferredSupplierId` | `defaultSupplier` | Resolves against normalized supplier rows by supplier code/name when possible; otherwise displays the API value. | Fallback default supplier. | Lets API supplier IDs become readable supplier names where available. |
| `leadTimeDays` | `leadTimeDays` | API value wins. | Fallback lead time, then `0`. | Used by detail summary. |
| `moq` | `reorderPoint` | API value currently fills frontend reorder point. | Fallback reorder point, then `0`. | Known compromise until backend exposes a dedicated reorder point. |
| `status` | `status` | `inactive`/`disabled`/`停用` -> `停用`; `draft`/`review`/`pending`/`待完善`/`待复核` -> `待完善`; everything else -> `启用`. | Fallback status when API status is absent through merge behavior. | UI only accepts `启用`, `待完善`, `停用`. |
| Not provided | `specification` | Preserved from fallback. | `ITEM_MASTER`. | Backend read model does not expose this yet. |
| Not provided | `defaultBin` | Preserved from fallback. | `ITEM_MASTER`. | Inventory migration should define bin ownership later. |
| Not provided | `safetyStock` | Preserved from fallback. | `ITEM_MASTER`. | Inventory/planning endpoint should own this later if needed. |
| Not provided | `maxStock` | Preserved from fallback. | `ITEM_MASTER`. | Same as above. |
| Not provided | `batchManaged` | Preserved from fallback. | `ITEM_MASTER`. | Presentation/control flag only in current frontend data. |
| Not provided | `serialManaged` | Preserved from fallback. | `ITEM_MASTER`. | Presentation/control flag only in current frontend data. |
| Not provided | `qaRequired` | Preserved from fallback. | `ITEM_MASTER`. | Receiving/quality ownership needs later alignment. |
| Not provided | `defaultTaxCode` | Preserved from fallback. | `ITEM_MASTER`. | Backend item read model does not expose it yet. |

## Supplier Field Map

| Backend field | Frontend field | Mapping behavior | Fallback source | Notes |
| --- | --- | --- | --- | --- |
| `id` | `code` | API value wins. | Matching fallback supplier code, then generated code. | Used for table key and AI activeContext entity ID. |
| `name` | `name` | API value wins. | Fallback supplier name. | Used by table, detail modal, and AI activeContext label. |
| `categories[0]` | `category` | First API category wins. | Fallback supplier category, then `未分类`. | Backend can expose multiple categories; current UI has one category column. |
| `paymentTermsId` | `paymentTerms` | API value wins. | Fallback payment terms. | Current UI displays the ID/code. |
| `defaultCurrency` | `currency` | API value wins. | Fallback currency, then `CNY`. | |
| `score` | `rating` | Numeric conversion of API score. | Fallback rating, then `0`. | Non-numeric score strings become fallback/zero. |
| `risk` | `riskStatus` | `high`/`高` -> `高`; `low`/`低` -> `低`; other values -> `中`. | Fallback risk when API risk is absent. | Covers English and Chinese values. |
| `preferred` | `certificationStatus` | Uses fallback certification first; if absent, preferred suppliers become `已认证`, otherwise `待复核`. | `SUPPLIER_MASTER`. | Certification remains frontend/future SRM-owned for now. |
| `status` | `status` | Same status mapping as items. | Fallback status when API status is absent. | UI only accepts `启用`, `待完善`, `停用`. |
| Not provided | `contact` | Preserved from fallback. | `SUPPLIER_MASTER`. | Backend read model does not expose contact detail yet. |
| Not provided | `email` | Preserved from fallback. | `SUPPLIER_MASTER`. | |
| Not provided | `phone` | Preserved from fallback. | `SUPPLIER_MASTER`. | |
| Not provided | `taxId` | Preserved from fallback. | `SUPPLIER_MASTER`. | |
| Not provided | `defaultTaxCode` | Preserved from fallback. | `SUPPLIER_MASTER`. | |
| Not provided | `onTimeRate` | Preserved from fallback. | `SUPPLIER_MASTER`. | SRM supplier performance should own this later. |
| Not provided | `qualityRate` | Preserved from fallback. | `SUPPLIER_MASTER`. | SRM supplier performance should own this later. |

## Warehouse Field Map

| Backend field | Frontend field | Mapping behavior | Fallback source | Notes |
| --- | --- | --- | --- | --- |
| `id` | `warehouseCode` | API value wins. | Matching fallback warehouse code, then generated code. | |
| `id` | `bin` | Used only when fallback bin is unavailable. | `WAREHOUSE_BINS`. | Current backend endpoint returns warehouse references, not a full bin master. |
| `name` | `warehouseName` | API value wins. | Fallback warehouse name. | |
| `type` | `zone` | Used only when fallback zone is unavailable. | `WAREHOUSE_BINS`. | Current UI zone remains mostly fallback-owned. |
| `status` | `available` / `qaStatus` | `inactive`, `disabled`, `frozen`, `停用`, `冻结` force `available=false` and `qaStatus=冻结`; otherwise fallback values are preserved. | `WAREHOUSE_BINS`. | Backend blocked status intentionally overrides fallback availability. |
| `parentId` | None today | Not displayed. | N/A | Useful for later warehouse/bin hierarchy. |
| Not provided | `capacity` | Preserved from fallback. | `WAREHOUSE_BINS`. | |
| Not provided | `utilization` | Preserved from fallback. | `WAREHOUSE_BINS`. | |
| Not provided | `owner` | Preserved from fallback. | `WAREHOUSE_BINS`. | |
| Not provided | `temperatureRequirement` | Preserved from fallback. | `WAREHOUSE_BINS`. | |

## Payment Terms Field Map

| Backend field | Frontend field | Mapping behavior | Fallback source | Notes |
| --- | --- | --- | --- | --- |
| `id` | `code` | API value wins. | Matching fallback term code, then generated code. | |
| `label` | `name` | API value wins. | Fallback term name. | |
| `days` | `netDays` | API value wins. | Fallback net days, then `0`. | |
| `days` | `dueDateRule` | Used only when fallback due date rule is unavailable. | `PAYMENT_TERMS`. | Existing wording is preserved when fallback matches. |
| `status` | `status` | `inactive`/`disabled`/`停用` -> `停用`; `draft`/`review`/`pending`/`待完善`/`待复核` -> `待复核`; everything else -> `启用`. | Fallback status when API status is absent. | Payment terms use `待复核`, not item-style `待完善`. |
| Not provided | `discountRule` | Preserved from fallback. | `PAYMENT_TERMS`. | |
| Not provided | `description` | Preserved from fallback. | `PAYMENT_TERMS`. | |

## Tax Code Field Map

| Backend field | Frontend field | Mapping behavior | Fallback source | Notes |
| --- | --- | --- | --- | --- |
| `id` | `code` | API value wins. | Matching fallback tax code, then generated code. | |
| `label` | `name` | API value wins. | Fallback tax code name. | |
| `rate` | `rate` | API value wins. | Fallback rate, then `0`. | |
| `status` | `status` | Same review-status mapping as payment terms. | Fallback status when API status is absent. | |
| `rate` | `type` | Derives `进项税` when rate is greater than `0`, otherwise `免税`, only if fallback type is unavailable. | `TAX_CODES`. | Fallback type remains authoritative when available. |
| Not provided | `region` | Preserved from fallback. | `TAX_CODES`. | |
| Not provided | `isDefault` | Preserved from fallback; otherwise first API tax code is default. | `TAX_CODES`. | |
| Not provided | `description` | Preserved from fallback. | `TAX_CODES`. | |

## Known Compromises

- `moq` currently maps to `reorderPoint` because the backend item read model does not yet expose a dedicated reorder point.
- Some UI presentation fields still come from fallback data because the backend read model is intentionally narrower.
- Empty API arrays are treated as valid empty results. They do not automatically repopulate from fallback.
- Failed or invalid API responses fallback per resource: one failed endpoint does not prevent other API-backed resources from rendering.
- This is a read-only migration. It does not add write, edit, delete, database, RDS, or PolarDB behavior.

## Future Follow-Ups

- Align backend master-data read models with UI fields where those fields should become source-of-truth.
- Add dedicated inventory balance, lot, transfer, variance, and exception endpoints before migrating Inventory.
- Use master-data API IDs for SRM supplier views and PR item/supplier selectors.
- Reduce fallback-only presentation fields only after backend coverage and API shapes are stable.
