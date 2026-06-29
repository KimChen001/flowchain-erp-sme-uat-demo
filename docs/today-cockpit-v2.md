# Today Cockpit v2

Today Cockpit v2 is a read-only workbench aggregation for the overview screen. It combines existing procurement and inventory read models into a single deterministic response for executive triage cards, follow-ups, inventory risks, recent documents, recent movements, recommended actions, and evidence links.

## Endpoint

- `GET /api/today-cockpit`

The endpoint returns the cockpit payload directly at the top level:

- `summary`
- `cards`
- `followups`
- `inventoryRisks`
- `recentDocuments`
- `recentMovements`
- `recommendedActions`
- `evidence`

## Data Sources

- Procurement documents, summary, follow-ups, links, and evidence are derived from `server/domain/procurement-read-model.mjs`.
- Inventory items, movements, exceptions, and summary are derived from `server/domain/inventory-read.mjs`.
- No write APIs, database migrations, or external AI providers are used.

## Evidence Routing

Procurement document evidence uses canonical read routes:

- `/api/procurement/documents/:type/:id`

Inventory evidence uses existing inventory read collections and item detail routes when a SKU exists:

- `/api/inventory/items/:sku`
- `/api/inventory/movements`
- `/api/inventory/exceptions`

The frontend treats these as evidence references and navigates to existing workbench modules instead of issuing autonomous write actions.

## Frontend Contract

The overview page consumes `GET /api/today-cockpit` through `src/modules/overview/todayCockpit.ts`. The v2 panel renders:

- KPI cards with severity chips and full currency formatting.
- Procurement follow-ups sourced from the backend read model.
- Inventory risk cards with SKU, warehouse, available quantity, reorder point, safety stock, and next action.
- Recent procurement documents with canonical document type labels.
- Deterministic recommended next actions.

The existing overview workbench remains in place below the v2 panel for compatibility.
