# Repository Boundary v1

## Purpose

This document prepares FlowChain for future database persistence by defining repository boundaries without changing runtime behavior.

The current runtime remains JSON/demo-data-backed. No database connection, ORM package, migration file, or `DATABASE_URL` requirement is introduced in this round.

## Why Repository Boundaries Are Needed

FlowChain currently has mature read models and route handlers over JSON/demo data. Before adding a real database adapter, the project needs stable conceptual contracts so future adapters can replace storage without rewriting product behavior.

Repository boundaries should help:

- keep route handlers stable;
- keep read models testable;
- separate persistence concerns from product logic;
- preserve draft-first behavior;
- preserve AI/provider safety boundaries;
- make future database adapter work incremental.

## Current Source of Truth

Current runtime source:

- `data/scm-demo.json`
- `server/repositories/json-db.mjs`
- domain read models under `server/domain/`
- route handlers under `server/routes/`

Existing repository code:

- `server/repositories/json-db.mjs`: reads/writes the demo JSON file.
- `server/repositories/audit-log-repository.mjs`: small audit-log repository wrapper over audit foundation helpers.

## Repository Groups

### MasterDataRepository

Conceptual methods:

- `listItems(filters)`
- `getItem(idOrSku)`
- `listSuppliers(filters)`
- `getSupplier(idOrName)`
- `listWarehouses()`
- `listPaymentTerms()`
- `listTaxCodes()`

Current JSON/read-model source:

- `server/domain/master-data.mjs`
- `server/routes/master-data.routes.mjs`

Future database mapping:

- `Item`
- `Supplier`
- `Warehouse`
- `Location` / `Bin`
- `PaymentTerm`
- `TaxCode`

### InventoryReadRepository

Conceptual methods:

- `listInventoryItems(filters)`
- `getInventoryItem(idOrSku)`
- `listLots(filters)`
- `listSerials(filters)`
- `listMovements(filters)`
- `listExceptions(filters)`
- `getSummary(filters)`
- future `getEvidenceForItem(idOrSku)`

Current JSON/read-model source:

- `server/domain/inventory-read.mjs`
- `server/routes/inventory.routes.mjs`

Future database mapping:

- `InventoryBalance`
- `InventoryLot`
- `InventorySerial`
- `InventoryMovement`
- `InventoryException`

This repository is read-only. It should not post inventory, mutate stock, or close exceptions.

### ProcurementReadRepository

Conceptual methods:

- `listDocuments(filters)`
- `getDocument(type, id)`
- `listLinks(filters)`
- `listFollowups(filters)`
- `getSummary(filters)`
- future `getEvidenceForDocument(type, id)`
- future `normalizeDocumentType(type)` if needed outside the domain helper

Current JSON/read-model source:

- `server/domain/procurement-read-model.mjs`
- `server/routes/procurement-read.routes.mjs`

Future database mapping:

- `PurchaseRequest`
- `PurchaseRequestLine`
- `RFQ`
- `RFQLine`
- `SupplierQuotation`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `ReceivingDocument` / `GRN`
- `SupplierInvoice`
- `ThreeWayMatch`
- `DocumentLink`
- `Followup`

This repository is read-only. It should not create PR/RFQ/PO/GRN/invoice records.

### ActionDraftRepository

Conceptual methods:

- `getSchema()`
- `previewDraft(request)`
- `validateDraft(request)`
- future `persistDraft(draft)`
- future `getDraft(id)`
- future `confirmDraft(id)`

Current JSON/read-model source:

- `server/domain/action-draft-boundary.mjs`
- `server/domain/purchase-request-draft-preview.mjs`
- `server/domain/rfq-and-supplier-followup-draft-preview.mjs`
- `server/routes/action-drafts.routes.mjs`

Current behavior:

- preview-only;
- no persistence;
- no real PR/RFQ/PO creation;
- no supplier message sending;
- user confirmation required in future.

Future database mapping:

- `ActionDraft`
- `ActionDraftValidation`
- `ActionDraftAuditTrail`
- `DocumentLink` for future confirmed records.

### AuditLogRepository

Conceptual methods:

- `listAuditEntries(filters)`
- `recordAuditEntry(entry)`
- future `batchRecord(entries)`
- future `recordAiEventBestEffort(entry)`

Current source:

- `server/repositories/audit-log-repository.mjs`
- `server/domain/audit-foundation.mjs`
- best-effort AI audit helper inside `server/routes/ai.routes.mjs`

Current behavior:

- audit records are JSON-backed where used;
- AI audit is best-effort;
- audit persistence failure must not break read-only AI answers.

Future database mapping:

- `AuditLog`

### AiConversationRepository

Conceptual future methods:

- future `listMessages(conversationId)`
- future `recordMessage(message)`
- future `recordEvidence(evidence)`
- future `listConversations(filters)`

Current behavior:

- no durable AI conversation persistence;
- AI responses return compact evidence in the response payload;
- provider safety remains separate from persistence.

Future database mapping:

- `AiConversation`
- `AiMessage`
- `AiEvidence`

## Adapter Migration Plan

### Phase 1: Repository Contracts Only

Document conceptual contracts and keep runtime behavior unchanged.

Current round status: complete as docs-only.

### Phase 2: JSON Adapters for Read Paths

Add lightweight JSON repository wrappers that delegate to existing read models. This should avoid copying business logic.

Targets:

- MasterDataRepository;
- InventoryReadRepository;
- ProcurementReadRepository.

### Phase 3: ActionDraft / Audit Persistence Adapter

Introduce repository-backed ActionDraft and AuditLog behavior first because they are low-risk future persistence candidates and do not directly mutate procurement or inventory source documents.

Current draft behavior must remain preview-only until an explicit confirmation workflow exists.

### Phase 4: Database Adapter

Add a real database adapter only in a later explicit ORM/database task.

Rules:

- no database dependency by default;
- no `DATABASE_URL` requirement for JSON mode;
- no Prisma/Drizzle install before the ORM task;
- migration dry-run before production cutover.

### Phase 5: Route Dependency Injection

Routes can later receive repositories through:

- context object;
- route factory;
- adapter registry;
- test registry injection.

Avoid adding a global database client in route modules.

## Dependency Injection Direction

Recommended future shape:

```text
createRepositoryRegistry({ db, env, dependencies })
  -> repositories.masterData
  -> repositories.inventoryRead
  -> repositories.procurementRead
  -> repositories.actionDrafts
  -> repositories.auditLog
  -> repositories.aiConversation

routeContext.repositories = createRepositoryRegistry(...)
```

Route handlers can then prefer `ctx.repositories.*` while retaining existing read-model fallbacks during migration.

## Code Skeleton Decision

This round intentionally keeps the repository skeleton docs-only.

Reason:

- existing runtime route behavior is stable and well-covered by tests;
- future Rounds 16-20 explicitly introduce contract tests, adapter registry, ActionDraft/Audit repositories, Master Data repository, and Procurement/Inventory read repositories;
- adding broad code skeletons now would increase churn without changing behavior.

## Non-goals

- Do not install Prisma or Drizzle.
- Do not add a database connection.
- Do not add migrations.
- Do not require `DATABASE_URL`.
- Do not migrate routes broadly.
- Do not change public API behavior.
- Do not create real persistence.
- Do not mutate demo data.
