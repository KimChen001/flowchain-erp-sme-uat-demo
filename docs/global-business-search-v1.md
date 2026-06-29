# Global Business Search v1

## Purpose

This is an internal technical and product note. It is not customer-facing.

Global Business Search gives FlowChain a deterministic ERP-style lookup layer before real LLM intent extraction is introduced. It helps operators resolve business objects from document numbers, supplier names, item identifiers, and operational status keywords without mutating data or relying on external AI providers.

## Target User Experience

Users can search:

- PO number.
- PR number.
- RFQ id.
- GRN id.
- Supplier invoice number.
- Supplier code or name.
- SKU or item name.
- Warehouse or bin where server-side data is available.
- Status keywords such as `待审批`, `逾期`, `差异`, and `低库存`.

Example queries:

- `PO-2026`
- `PR-1001`
- `ABC Components`
- `A100`
- `这个供应商的发票`
- `待审批 PO`
- `发票差异`
- `低库存物料`

## Scope

V1 is deterministic:

- Exact id matching.
- Contains matching.
- Known alias matching where available.
- Status keyword matching.
- No external LLM.
- No fuzzy library.
- No mutation.
- No permission system expansion.

## Searchable Entities

V1 supports these entity types when the data is available from server-side sources:

- `purchase_request`
- `rfq`
- `purchase_order`
- `receiving_doc`
- `supplier_invoice`
- `supplier`
- `item`
- `inventory_item`
- `warehouse`
- `bin`

Supplier invoices are supported by the search domain when a server-side `supplierInvoices` collection is present. The current runtime data does not expose supplier invoices as a server source, so invoice search is a follow-up until that collection or an API-backed invoice read model exists.

## Result Schema

Each result should include:

- `id`
- `type`
- `label`
- `subtitle`
- `status`
- `moduleId`
- `entityType`
- `entityId`
- `entityLabel`
- `deepLink` or navigation target where supported
- `evidence`
- `score`
- `matchedFields`

## Navigation Strategy

If detail mode supports opening by id, the frontend can navigate directly to the detail view. In V1 this is low-risk for PR, PO, and RFQ because those modules already have list/detail state.

If detail navigation is not supported yet, search navigates to the relevant module list or workbench and shows enough result context in the panel. Unsupported detail navigation should not be faked. The global route structure should stay stable.

## Relationship With AI Assistant

Global search is deterministic. The AI Assistant can later use the same resolver and index for entity grounding.

The future LLM role is to convert natural language into intent, entities, and slots. Backend search and indexing should remain the source of truth for business object resolution.

## Non-goals

- No GPT, Doubao, or DeepSeek integration.
- No database migration.
- No full permission model.
- No business mutations.
- No CRM, Sales, or Customer search.
- No customer-visible demo, UAT, sample, fallback, or static-data wording.
