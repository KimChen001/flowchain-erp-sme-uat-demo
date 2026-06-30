# Backend Route Map v1

## Route Classification

- Read: returns current demo/read-model state without mutation.
- Preview: prepares reviewable draft data and does not mutate business records.
- Manual/legacy write: existing demo workflow write route, not used by AI autonomous execution.

## Auth / Context

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/me` | Read | context route / users fallback | None | Demo user and permissions context. |
| `GET` | `/api/tenants/current` | Read | context route | None | Demo tenant settings. |
| `POST` | `/api/auth/login` | Manual/legacy write | JSON demo users | Writes login/user event | Demo login only. |
| `GET` | `/api/auth/me` | Read | JSON demo users | None | Legacy auth profile lookup. |

## AI

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/ai/tools` | Read | AI tool registry | None | Tools are read/draft-first; no autonomous writes. |
| `POST` | `/api/ai/chat` | Read / draft-prep response | AI route and read models | Best-effort audit only | Provider disabled by default; cockpit fast path is deterministic/local. |

## Search

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/search` | Read | global business search index | None | Returns canonical focus target shape for supported entities. |

## Today Cockpit

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/today-cockpit` | Read | Today Cockpit read model | None | Aggregates procurement and inventory read models. |

## Procurement Read APIs

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/procurement/documents` | Read | procurement read model | None | PR/RFQ/PO/GRN/invoice/three-way-match rows. |
| `GET` | `/api/procurement/documents/:type/:id` | Read | procurement read model | None | Supports canonical aliases; invalid type returns clean error. |
| `GET` | `/api/procurement/links` | Read | procurement link read model | None | Document relationship graph. |
| `GET` | `/api/procurement/followups` | Read | procurement follow-up read model | None | Open follow-up signals. |
| `GET` | `/api/procurement/summary` | Read | procurement summary read model | None | Stable top-level counts and amounts. |

## Inventory Read APIs

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/inventory/items` | Read | inventory read model | None | Item/SKU stock view. |
| `GET` | `/api/inventory/items/:sku` | Read | inventory read model | None | Item detail by SKU/name. |
| `GET` | `/api/inventory/lots` | Read | inventory read model | None | Lots where available. |
| `GET` | `/api/inventory/serials` | Read | inventory read model | None | Serials where available. |
| `GET` | `/api/inventory/movements` | Read | inventory read model | None | Read-only inventory movements. |
| `GET` | `/api/inventory/exceptions` | Read | inventory read model | None | Read-only exception documents. |
| `GET` | `/api/inventory/summary` | Read | inventory read model | None | Counts and risk totals. |
| `GET` | `/api/inventory-movements` | Read | legacy movement route | None | Compatibility movement endpoint. |

## Action Drafts

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/action-drafts/schema` | Read | action draft boundary helper | None | Lists supported draft types and confirmation boundary. |
| `POST` | `/api/action-drafts/preview` | Preview | action draft preview helpers | None | Preview-only; no PR/RFQ/PO creation and no supplier message sending. |

## Audit Log

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/audit-log` | Read | audit log repository | None | Lists existing audit entries with optional filters. |

## Master Data

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/master-data/items` | Read | master data read model | None | Item reference data. |
| `GET` | `/api/master-data/items/:id` | Read | master data read model | None | Item detail by id/SKU/name. |
| `GET` | `/api/master-data/suppliers` | Read | master data read model | None | Supplier reference data. |
| `GET` | `/api/master-data/suppliers/:id` | Read | master data read model | None | Supplier detail by id/name. |
| `GET` | `/api/master-data/warehouses` | Read | master data read model | None | Explicit or inferred warehouses. |
| `GET` | `/api/master-data/payment-terms` | Read | master data read model | None | Payment term references. |
| `GET` | `/api/master-data/tax-codes` | Read | master data read model | None | Tax code references only; no tax filing. |

## Planning / Market / Supplier Reads

| Method | Path | Class | Source | Mutation | Notes |
|---|---|---|---|---|---|
| `GET` | `/api/mrp-plan` | Read | MRP route/domain | None | Demo planning output. |
| `GET` | `/api/sop-cycle` | Read | S&OP route/domain | None | Demo S&OP cycle. |
| `POST` | `/api/sop-cycle` | Manual/legacy write | S&OP route/domain | Writes demo cycle | Manual demo write. |
| `GET` | `/api/supplier-performance` | Read | supplier performance helper | None | Supplier scoring view. |
| `GET` | `/api/supplier-recommendations` | Read | supplier recommendation helper | None | Sourcing recommendation view. |
| `GET` | `/api/external-signals` | Read | market route | May refresh remote demo signals | Not an AI provider call. |
| `GET` | `/api/market-prices` | Read | market route | None | Demo market price cards. |
| `POST` | `/api/market-prices/refresh` | Manual/legacy write | market route | Writes demo market data | Demo refresh only. |

## Legacy Procurement Workflow Routes

These routes remain for compatibility/manual demo workflow surfaces. They are not invoked by AI autonomous actions.

| Method | Path | Class | Source | Mutation |
|---|---|---|---|---|
| `GET` | `/api/purchase-requests` | Read | legacy workflow route | None |
| `POST` | `/api/purchase-requests` | Manual/legacy write | workflow domain | Creates demo PR |
| `PATCH` | `/api/purchase-requests/:pr/status` | Manual/legacy write | workflow domain | Changes demo PR status |
| `POST` | `/api/purchase-requests/:pr/convert-to-po` | Manual/legacy write | workflow domain | Creates demo PO |
| `GET` | `/api/rfqs` | Read | legacy workflow route | None |
| `POST` | `/api/rfqs` | Manual/legacy write | workflow domain | Creates demo RFQ |
| `PATCH` | `/api/rfqs/:id/status` | Manual/legacy write | workflow domain | Changes demo RFQ status |
| `GET` | `/api/purchase-orders` | Read | legacy workflow route | None |
| `POST` | `/api/purchase-orders` | Manual/legacy write | workflow domain | Creates demo PO |
| `PATCH` | `/api/purchase-orders/:po/status` | Manual/legacy write | workflow domain | Changes demo PO status |
| `GET` | `/api/receiving-docs` | Read | legacy receiving route | None |
| `POST` | `/api/receiving-docs` | Manual/legacy write | receiving workflow | Creates demo GRN |
| `PATCH` | `/api/receiving-docs/:grn` | Manual/legacy write | receiving workflow | Updates/posts demo GRN |

## Safety Notes

- Default persistence is JSON/demo data.
- See [Route mutation classification](route-mutation-classification-v1.md) for the complete database-mode v1 guard. In explicit database mode, read-only and preview-only routes remain available while legacy mutation routes are blocked until migrated.
- External AI provider access is disabled by default.
- Action drafts are preview-only.
- No full finance/GL/payment/tax execution exists.
- Future database adapters should preserve these contracts before replacing JSON behavior.
