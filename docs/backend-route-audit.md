# Backend Route Audit

## Current Route Shape

FlowChain still runs a lightweight Node HTTP server through `server/routes/scm-legacy.routes.mjs`. Route handlers are split by domain but share the same runtime JSON repository and helper context.

## Read Routes

- `/api/health`: runtime health and API availability.
- `/api/context`: active workbench context.
- `/api/search`: global business search.
- `/api/today-cockpit`: read-only overview aggregation for procurement and inventory workbench cards, evidence, and recommended next actions.
- `/api/inventory/*`: inventory item, lot, serial, movement, exception, and summary reads.
- `/api/procurement/*`: procurement document, link, follow-up, and summary reads.
- `/api/master-data/*`: supplier, item, and master-data reads.
- `/api/market/*`: market reference reads.
- `/api/ai/tools`: AI tool registry.
- `/api/action-drafts/schema`: preview-only action draft schema and supported draft types.
- `/api/purchase-requests`, `/api/rfqs`, `/api/purchase-orders`, `/api/receiving-docs`: legacy list reads for existing UI screens.

## Write Routes

- `/api/auth/login`: creates or updates user session state.
- `/api/forecast-plans`: saves forecast plans.
- `/api/purchase-requests`: creates PRs.
- `/api/purchase-requests/:id/status`: updates PR workflow status.
- `/api/purchase-requests/:id/convert-to-po`: converts approved PRs.
- `/api/rfqs`: creates RFQs.
- `/api/rfqs/:id/status`: updates RFQ state and can create a PO when awarded.
- `/api/purchase-orders`: creates POs.
- `/api/purchase-orders/:id/status`: updates PO status and lines.
- `/api/receiving-docs`: creates GRNs.
- `/api/receiving-docs/:id`: updates GRN status and can apply inventory.
- `/api/ai/chat`: answers questions and records AI events.

## Preview-only Routes

- `/api/action-drafts/preview`: validates and returns a reviewable action draft shape without calling `writeDb`, creating PR/RFQ/PO records, closing inventory exceptions, sending supplier messages, or persisting a draft.

## Boundary Observations

- Procurement read APIs are now separated from legacy write handlers.
- Today Cockpit v2 reuses procurement and inventory read models and is covered by read-only mutation tests.
- Evidence links are normalized in the frontend through `src/lib/evidenceLinks.ts`; backend read responses remain compatible.
- Action draft preview routes are intentionally separate from write routes and remain non-mutating.
- Existing AI chat and auth routes still write runtime events or user records; smoke tests against the shared local JSON file should account for that behavior.
- Inventory read APIs already follow a pure domain model pattern and provided the template for procurement read APIs.
- Search and AI still use their existing domain-specific assemblers. Procurement read-model evidence is now normalized for future reuse, but those consumers should be consolidated only after ranking, card shape, and intent tests are expanded.

## Backend Risk Register

- Runtime JSON remains both seed and persistence layer, so any route that records events can change local data.
- Legacy route context contains many helpers; accidental use of `writeDb` in new read routes should be blocked by tests and review.
- Some older health/auth wording still references environment details and should stay out of customer-facing UI.
- The database migration path needs explicit entity IDs, document links, audit events, and immutable posted-document rules before a managed database cutover.
