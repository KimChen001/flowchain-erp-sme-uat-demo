# Database Entity Model v2

## Purpose

This document prepares FlowChain for managed persistence while preserving JSON mode as the default runtime.

FlowChain remains an AI-assisted SCM platform for SMEs. The persistence model focuses on procurement, inventory, receiving, supplier collaboration, action drafts, AI evidence, imports, and audit. It intentionally excludes full GL, payment execution, tax filing, CRM, HR, and bank integration.

## Core Entity Groups

### Master And Context

- `Tenant`: company boundary, locale, currency defaults, feature flags.
- `User`: login identity, display profile, tenant membership.
- `Role` / `Permission`: placeholder for future access control.
- `Supplier`: supplier identity, status, category, risk, score, contacts.
- `Item`: SKU, name, category, unit, preferred supplier, stocking policy.
- `Warehouse`: warehouse code, name, status, owner.
- `Location` / `Bin`: warehouse child location, zone, QA availability.
- `PaymentTerm`: code, net days, discount rules.
- `TaxCode`: code, rate, tax type, region, default flags.

### Inventory

- `InventoryBalance`: item, warehouse/bin, available, allocated, safety stock, reorder point.
- `InventoryLot`: lot/batch identity, expiry, supplier, QA state.
- `InventorySerial`: serial identity, item, warehouse/bin, lifecycle state.
- `InventoryMovement`: movement type, source document, quantity in/out/adjustment, owner, status.
- `InventoryException`: exception type, linked movement/document, quantity impact, status, owner, closure evidence.

### Procurement And P2P

- `PurchaseRequest` and `PurchaseRequestLine`.
- `Rfq` and `RfqLine`.
- `SupplierQuotation` and `SupplierQuotationLine`.
- `PurchaseOrder` and `PurchaseOrderLine`.
- `ReceivingDocument` and `ReceivingLine`.
- `SupplierInvoice` and `SupplierInvoiceLine`.
- `ThreeWayMatch`: PO/GRN/invoice matching result, variance amount/type, resolution state.
- `DocumentLink`: typed links across PR, RFQ, PO, GRN, invoice, return, and draft.
- `ProcurementFollowup`: internal or supplier-facing follow-up tasks and messages.

### AI And Audit

- `AuditLog`: append-only actor, action, entity type/id, source, reason, timestamp, metadata.
- `AiConversation`: conversation shell, tenant/user/module context.
- `AiMessage`: normalized prompt/response metadata without storing secrets by default.
- `AiEvidence`: compact business evidence references used by an AI response.
- `ActionDraft`: preview-only draft shell, source, origin evidence, payload, status.
- `ActionDraftValidation`: validation result, missing fields, warnings.
- `ActionDraftAuditTrail`: preview and future confirmation audit trail for draft lifecycle.

### Reporting And Import

- `ImportJob`: template, file name, operator, status, row counts, started/finished timestamps.
- `ImportError`: row number, field, error code, message, raw value reference.
- `ReportSnapshot`: optional future cached report payload and input filters.

## Relationship Model

- `Tenant` owns users, suppliers, items, warehouses, documents, drafts, and audit logs.
- `Supplier` links to RFQs, quotations, POs, invoices, returns, reconciliation, and followups.
- `Item` links to PR lines, RFQ lines, quotation lines, PO lines, GRN lines, inventory balances, lots, serials, and movements.
- `PurchaseRequest` can spawn RFQs or POs through `DocumentLink`.
- `RFQ` has RFQ lines and invited suppliers; awarded quotations can create POs.
- `PurchaseOrder` has PO lines and zero or more receiving documents.
- `GRN` updates PO receiving progress and later creates inventory movements after posting.
- `SupplierInvoice` links to PO and optionally GRN; `ThreeWayMatch` records variance and resolution state.
- `InventoryException` can reference movements, GRNs, returns, or action drafts.
- `ActionDraft` links to origin evidence and, after a future explicit confirmation, can link to the created/updated business record.
- `AiEvidence` stores compact references to source documents, not raw UI payloads.
- `AuditLog` references entity type/id and stays append-only.
- Today Cockpit should remain a derived read model over procurement, inventory, supplier, draft, and audit entities.

## Repository Boundary

### SupplierRepository

- Reads: list suppliers, get supplier, search suppliers, supplier performance snapshot.
- Future writes: update supplier profile, status, risk notes.
- Current adapter: JSON supplier arrays and SRM read helpers.

### ItemRepository

- Reads: list/get items, preferred supplier metadata, item category and UOM references.
- Future writes: item profile, stocking policy, default supplier, tax code.
- Current adapter: `src/data/master-data`, runtime JSON products/items.

### InventoryReadRepository

- Reads: balances, lots, serials, movements, exceptions, summary.
- Future writes: none in read repository.
- Current adapter: inventory read model helpers.

### InventoryMovementRepository

- Reads: movement detail and exception links.
- Future writes: posted GRN movement, adjustment, transfer, exception closure.
- Current adapter: receiving and inventory movement route helpers.

### ProcurementReadRepository

- Reads: PR/RFQ/PO/GRN/invoice/3WM lists and details, document links, followups, summary.
- Future writes: none in read repository.
- Current adapters: JSON procurement read model helpers and the Round 29 DB ProcurementReadRepository.

### ActionDraftRepository

- Reads: draft by id, drafts by origin entity, draft validation state.
- Future writes: save preview draft, cancel draft, confirm draft after explicit user action.
- Current adapter: preview-only route returns transient drafts and does not persist.

### AuditLogRepository

- Reads: audit entries by entity and recent events.
- Future writes: append business audit event, append draft lifecycle event.
- Current adapter: JSON `auditLog` plus best-effort AI event logging.

### AiConversationRepository

- Reads: conversation/message history when enabled.
- Future writes: conversation metadata, sanitized message, compact evidence.
- Current adapter: no durable AI conversation persistence.

## JSON Demo Data Mapping

- `data/scm-demo.json`: runtime JSON persistence for auth user/session state, procurement documents, receiving, inventory movement, audit, forecast plans, RFQs, and AI events.
- `src/data/demo-data`: frontend seed/reference arrays for compatibility screens and static workbench modules.
- `server/repositories/json-db.mjs`: current JSON adapter boundary.
- Procurement read models map PR/RFQ/PO/GRN/invoice arrays into read rows and document links.
- Inventory read models map product/item, balance, lot, serial, movement, and exception-like arrays into stable read payloads.
- Master data APIs map item, supplier, warehouse, payment term, and tax code references into normalized rows.

Fields needing normalization:

- preserve business IDs (`PR-*`, `RFQ-*`, `PO-*`, `GRN-*`, `SKU-*`, supplier codes) as external keys;
- add internal UUIDs later for joins and tenant isolation;
- split header and line arrays for PR/RFQ/PO/GRN/invoice;
- store amounts as decimal plus currency;
- normalize supplier references by supplier id/code, not display name only;
- convert derived display fields into read-model projections rather than persisted source of truth;
- keep audit and action draft evidence as compact entity references.

## Migration Sequence

1. Phase A: keep JSON source and introduce repository interfaces over existing helpers.
2. Phase B: move read persistence for master data, inventory, and procurement into repository adapters while keeping routes stable.
3. Phase C: persist `ActionDraft`, `ActionDraftValidation`, `ActionDraftAuditTrail`, and `AuditLog` first because they are append-friendly and low-risk.
4. Phase D: migrate PR/RFQ/PO/GRN writes after explicit confirmation workflow and transaction boundaries are designed.
5. Phase E: deploy managed production database with backups, migration dry-runs, staging cutover, and rollback playbooks.

## Prisma vs Drizzle

| Area | Prisma | Drizzle |
| --- | --- | --- |
| Schema clarity | Strong declarative schema and generated client. | TypeScript-native schema close to SQL. |
| Migration ergonomics | Mature workflow, good for teams that want conventions. | Lightweight and explicit, fewer abstractions. |
| Type safety | Excellent generated model/client types. | Excellent query-level TypeScript inference. |
| Query flexibility | Comfortable CRUD, raw SQL available for complex cases. | SQL-like composition is direct and flexible. |
| Runtime fit | Heavier client/runtime, but productive. | Leaner runtime and easier to reason about in small Node services. |
| Aliyun MySQL/PostgreSQL fit | Good support for both. | Good support for both. |
| Learning cost | Lower for teams used to model-first ORM. | Lower for teams comfortable with SQL/TypeScript. |

Round 25 decision: choose Prisma for the first persistence scaffold. Prisma is selected for schema readability, generated client conventions, migration ergonomics, and PostgreSQL compatibility for Aliyun RDS-style deployment. Drizzle remains a reasonable SQL-first alternative, but it is not installed in this scaffold.

## Aliyun RDS / PolarDB Notes

- RDS MySQL is a conservative default for SME transactional workloads and broad operational familiarity.
- RDS PostgreSQL is strong if reporting, JSON fields, and relational integrity become more important.
- PolarDB is useful later if read scaling or higher managed availability is required, but it is not needed for the first persistence cutover.
- Required env variables should include database host, port, database name, user, password/secret reference, SSL mode, pool size, and migration mode.
- Use connection pooling; keep serverless-style burst behavior in mind if deployment moves to ACK or Function Compute later.
- Run migrations first in staging, then production with backups and rollback plans.
- Keep KMS/Secrets Manager for DB credentials and provider keys.
- AI provider safety remains separate. Database credentials must not imply external AI enablement.

## Risks

- Schema churn while product scope is still evolving.
- Audit volume growth and retention policy gaps.
- Action draft lifecycle ambiguity before confirmation workflow exists.
- Tenant isolation mistakes if internal IDs and tenant filters are added late.
- JSON migration risk from display-name references and derived fields.
- Later performance pressure from dashboard and Today Cockpit aggregations.

## Non-goals

- No default database runtime.
- No migration files in this round.
- No cloud deployment.
- No full finance/GL, payment execution, tax filing, CRM, HR, or bank integration.
