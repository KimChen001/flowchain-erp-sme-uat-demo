# Inventory Read API Foundation v1

## Purpose

This is an internal technical and product note for moving Inventory toward an API-first source-of-truth pattern. It is not customer-facing. The goal is to make inventory read data reusable by backend APIs, global search, AI evidence, planning, and workbench UI without changing stock posting, receiving, or persistence behavior.

## Current State

Inventory UI currently has rich tables and workbench views for stock overview, lots, serials, transfers, cycle count, transaction ledger, exception documents, and bin maps. Recent table polish improved transaction and exception table readability, including one-line SKU, source document, status, owner, and action cells.

Global search already supports inventory and low-stock records. Master Data and SRM supplier identity have already moved toward API-first reads through backend read models and REST endpoints. Inventory is still not fully exposed through a clean read API layer, even though it is a core source for low-stock search, replenishment planning, inventory risk, supplier operational query, AI Assistant evidence, and Today Cockpit actions. Inventory should be the next source-of-truth cleanup candidate.

## Target API-First Pattern

```text
Backend read model -> REST API -> frontend API-first snapshot -> local fallback only if API fails
```

The backend read model should normalize runtime inventory data into stable records. The REST API should expose read-only collections and detail lookups. The frontend should prefer API snapshots and use local constants only as a resilience fallback or where backend parity is not available yet.

## Read-Only Inventory Scope

V1 exposes read-only endpoints for:

- inventory items and stock overview
- item detail by SKU
- lots and batches
- serials
- inventory movements and transaction ledger
- inventory exception documents
- inventory summary and KPI snapshot

Available fields are normalized from current backend runtime data. When a field is not present, the read model returns the best available value, an empty value, or an empty collection instead of inventing misleading facts.

## Non-Goals

- no database migration
- no inventory write API
- no stock posting mutation
- no PR generation change
- no QC or receiving mutation change
- no real AI provider
- no persistence rewrite
- no modification to `data/scm-demo.json`

## Future Usage

Future consumers should be able to reuse the inventory read model or REST endpoints:

- Global Search
- AI Assistant operational cards
- Today Cockpit action queue
- Replenishment and MRP
- Supplier operational summary
- Reports and Data Management

## Added API Surface

The v1 route set is read-only:

- `GET /api/inventory/items`
- `GET /api/inventory/items/:sku`
- `GET /api/inventory/lots`
- `GET /api/inventory/serials`
- `GET /api/inventory/movements`
- `GET /api/inventory/exceptions`
- `GET /api/inventory/summary`

Collection endpoints support low-risk filters: `q`, `status`, `warehouse`, `risk`, and `limit`. Unknown item detail returns a neutral 404 response.

## Frontend API-First Status

The Inventory module now has `src/modules/inventory/api.ts` as its API client. Stock item snapshots, lots, serials, transaction ledger rows, exception document rows, and the summary snapshot attempt API reads first. If an API read fails or a detail collection is not yet represented in runtime data, the UI falls back to the existing local read model without showing technical fallback wording in the product UI.

The movement ledger keeps its existing filters, export, detail modal, and table readability fixes. Exception documents keep their existing filters, export, detail modal, and local-only status actions; no backend write path was added.

## Current Coverage And Missing Fields

Inventory items are backed by runtime `products` and expose stock overview fields such as SKU, item name, category, warehouse reference, available quantity, safety stock, status, and risk level.

Movement rows are backed by runtime `inventoryMovements` when available. The frontend keeps its local transaction ledger as a resilience source because the current runtime may contain no movement rows before receiving or workflow activity creates them.

Lots and serials are supported by the API shape, but current runtime data does not yet contain persisted lot or serial collections. The frontend keeps existing local lot and serial views until those collections have backend parity.

Exception documents are exposed from explicit runtime exception rows when present, or derived read-only from inventory movement records with adjustment, transfer, cycle-count, or review statuses.

## Search And AI Consolidation

Global Search now reuses the inventory item read model for inventory records instead of duplicating product normalization. AI inventory status and supplier inventory risk summaries also reuse the read model for read-only evidence while keeping existing card schemas and presentation rules stable.

## Future Work

- database persistence
- inventory write API
- receiving stock posting integration beyond current runtime movement creation
- inventory transactions from real GRN posting as a durable ledger
- persisted lots and serials
- AI inventory evidence consolidation across search, supplier summary, and item status
- broader report and data-management read endpoints
