# Backend Phase 1/2 Technical Design

## Purpose

This is a backend technical design document, not an implementation task. It translates the existing Backend Foundation v1 plan, ERPNext reference notes, and AI Chat Copilot v1 plan into a safe implementation-oriented roadmap.

The goal is to prepare an incremental Backend Foundation v1 path. The backend should evolve from the current JSON-backed Node API rather than be rewritten from scratch.

This design supports AI Chat Copilot by creating reliable user and tenant context, auditability, structured business objects, and tool-ready APIs. These foundations help the assistant answer supplier, inventory, and procurement questions with evidence; prepare reviewable PR and RFQ drafts; detect missing fields; return confidence summaries; and guide users to related modules while keeping users in control.

This document does not add frontend scope, application routes, UI cards, workflows, or implementation code.

## Current Backend Baseline

The current backend is a custom Node HTTP API under `server/`.

Observed structure:

- `server/index.mjs` starts the server.
- `server/scm-api.mjs` re-exports the server factory from `server/routes/scm-legacy.routes.mjs`.
- `server/routes/scm-legacy.routes.mjs` owns the HTTP server, static file serving, JSON data file access, route context construction, and several shared helper functions.
- `server/repositories/json-db.mjs` reads and writes the full JSON-backed data store.
- `server/routes/*.routes.mjs` contains route handlers for AI chat, audit log, procurement, RFQ, receiving, inventory movements, supplier performance, supplier recommendations, MRP, SOP, and market data.
- `server/domain/workflow.mjs` contains the active workflow and audit helper logic for PR, PO, RFQ, and receiving document transitions.
- `server/domain/workflow.test.mjs` currently covers workflow transitions and audit entry counts.
- Several domain and service files currently export placeholders. Implementation should confirm whether those files should become extraction targets before moving logic out of route files.

Current data approach:

- The API reads from and writes to a local JSON data file through `createJsonDb`.
- Most writes update the in-memory object loaded for the request and then persist the whole JSON object.
- This design should preserve that approach for Phase 1/2 and Phase 2/2. No database migration is required in these phases.

Current auth-related endpoints:

- `POST /api/auth/login` is implemented in the legacy route aggregator.
- `GET /api/auth/me` is implemented in the legacy route aggregator and returns the public user for a bearer token.
- `server/routes/auth.routes.mjs` exists but currently exports an empty module.

Current audit endpoint:

- `GET /api/audit-log` is implemented in `server/routes/audit-log.routes.mjs`.
- It reads the existing `auditLog` array and supports optional `entityType`, `entityId`, and `limit` query filters.
- The current audit shape is lighter than the target shape in this document. Implementation should evolve it compatibly.

Current AI Chat endpoint:

- `POST /api/ai/chat` is implemented in `server/routes/ai.routes.mjs`.
- It accepts a question, builds context from existing JSON-backed objects, calls the configured AI provider when available, falls back to a local response when needed, adds timing/provider metadata, calculates a confidence object, records an event, and returns the result.
- The current response is primarily text plus metadata and confidence. Structured response cards should be introduced incrementally without breaking existing consumers.

Current procurement, inventory, RFQ, and receiving endpoints:

- `GET /api/purchase-requests`
- `POST /api/purchase-requests`
- `PATCH /api/purchase-requests/:id/status`
- `POST /api/purchase-requests/:id/convert-to-po`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `PATCH /api/purchase-orders/:id/status`
- `GET /api/rfqs`
- `POST /api/rfqs`
- `PATCH /api/rfqs/:id/status`
- `GET /api/receiving-docs`
- `POST /api/receiving-docs`
- `PATCH /api/receiving-docs/:id`
- `GET /api/inventory-movements`

Related read endpoints:

- `GET /api/supplier-performance`
- `GET /api/supplier-recommendations`
- `GET /api/mrp-plan`
- `GET /api/sop-cycle`
- `POST /api/sop-cycle`
- `GET /api/forecast-plans`
- `POST /api/forecast-plans`
- `GET /api/health`

Baseline risks and confirmations for implementation:

- Auth context is currently token-backed but not yet a product-level `/api/me` contract.
- Tenant context is not yet a first-class endpoint.
- Audit log exists and is already wired to several workflow operations, but the target audit schema needs a compatibility layer or migration strategy.
- AI confidence logic is currently route-local, while placeholder service/domain files exist for future extraction.
- Some market and external signal route content is outside this design's core backend foundation scope and should not drive product expansion.

## Backend Foundation Phase 1/2 Overview

Phase 1/2 should establish the smallest backend foundation needed for context, auditability, and controlled AI Chat integration.

Scope:

- A. Minimal user context
- B. Minimal tenant context
- C. Basic audit log foundation
- D. AI tool registry shape
- E. AI Chat response envelope shape

Phase 1/2 should not include:

- PostgreSQL migration
- full RBAC
- SSO / MFA
- full workflow engine
- supplier portal
- payment engine
- tax filing
- GL
- full ERP expansion
- frontend UI expansion

## Minimal User Context Design

Canonical endpoint:

- `GET /api/me`

Relationship to existing endpoint:

- `GET /api/auth/me` already exists and should remain compatible unless a later implementation explicitly scopes a migration.
- `/api/me` may act as the cleaner product-level context endpoint for current user, tenant, and lightweight permissions context.
- Implementation should avoid duplicating auth logic unnecessarily. It can reuse the existing token lookup path initially.

Proposed response contract:

```json
{
  "user": {
    "id": "user-buyer-001",
    "name": "Kim Chen",
    "email": "buyer@example.com",
    "role": "buyer",
    "department": "Procurement",
    "locale": "zh-CN"
  },
  "tenant": {
    "id": "tenant-flowchain-sme",
    "name": "FlowChain SME Workspace"
  },
  "permissionsContext": {
    "roleLabel": "Buyer",
    "canPrepareDrafts": true,
    "canSubmitDocuments": true,
    "canApproveDocuments": false
  }
}
```

Clarifications:

- This is not full RBAC.
- This is minimal context for UI behavior, audit attribution, tenant awareness, and AI Chat grounding.
- Backend validation remains authoritative for document transitions and writes.
- The response should be additive and should not require frontend expansion during Phase 1/2.

## Minimal Tenant Context Design

Canonical endpoint:

- `GET /api/tenants/current`

Proposed response contract:

```json
{
  "id": "tenant-flowchain-sme",
  "name": "FlowChain SME Workspace",
  "industry": "Manufacturing / Distribution",
  "currency": "USD",
  "timezone": "America/Los_Angeles",
  "defaultWarehouseId": "WH-MAIN",
  "settings": {
    "allowAiDraftPreparation": true,
    "requireUserReviewForAiDrafts": true,
    "defaultDocumentStatus": "draft"
  }
}
```

Tenant context supports:

- audit log attribution through `tenantId`
- AI Chat grounding with workspace defaults
- draft defaults such as default warehouse, currency, and review requirements
- future master data filtering
- future multi-tenant readiness without implementing full multi-tenancy now

Implementation notes:

- Phase 1/2 can return a single current tenant from configuration or a small JSON-backed tenant object.
- The endpoint should not introduce tenant administration, tenant switching, or complex permissions.

## Audit Log Foundation Design

Phase 1/2 should define a reusable audit event shape and then wire only one or two low-risk integration points initially.

Target audit event shape:

```json
{
  "id": "AUD-20260624-0001",
  "tenantId": "tenant-flowchain-sme",
  "timestamp": "2026-06-24T10:30:00.000Z",
  "actor": {
    "type": "user",
    "id": "user-buyer-001",
    "name": "Kim Chen",
    "role": "buyer"
  },
  "source": "manual",
  "module": "procurement",
  "action": "purchase_request_draft_prepared",
  "entity": {
    "type": "purchase_request",
    "id": "PR-1001"
  },
  "summary": "Purchase request draft prepared for review.",
  "before": null,
  "after": {
    "status": "draft",
    "lineCount": 1,
    "totalQuantity": 500
  },
  "metadata": {
    "aiTool": "preparePurchaseRequestDraft",
    "confidence": "medium"
  }
}
```

Standard fields:

- `id`
- `tenantId`
- `timestamp`
- `actor`
- `source`
- `module`
- `action`
- `entity`
- `summary`
- `before`
- `after`
- `metadata`

Source values:

- `manual`
- `ai_assisted`
- `system`

Initial audit action examples:

- `user_context_loaded`
- `tenant_context_loaded`
- `ai_chat_requested`
- `ai_tool_invoked`
- `ai_draft_prepared`
- `document_draft_saved`
- `document_status_changed`
- `inventory_movement_recorded`
- `grn_posted`

Compatibility with current audit log:

- Existing workflow audit entries use fields such as `auditId`, `entityType`, `entityId`, `fromStatus`, `toStatus`, `reason`, and `metadata`.
- Phase 1/2 should avoid breaking `GET /api/audit-log`.
- A future implementation can introduce a normalization helper that writes the richer shape while still returning existing fields where needed.

Initial wiring recommendation:

- Create the audit foundation helper and repository first.
- Wire `GET /api/me` and `GET /api/tenants/current` or `POST /api/ai/chat` as the first low-risk audit points.
- Do not attempt to retrofit every existing action in one commit.

## AI Tool Registry Shape

AI Chat Copilot should have a controlled backend tool registry. This is not an autonomous execution engine. It is a defined list of backend capabilities that AI Chat may call or reference.

Suggested tool definition fields:

- `name`
- `module`
- `mode`
- `description`
- `inputSchema`
- `outputCardTypes`
- `requiresUserReview`
- `writesBusinessData`
- `audit`

Example tool definition:

```json
{
  "name": "getSupplierStatus",
  "module": "srm",
  "mode": "read",
  "description": "Retrieve supplier status, score, risk, open PO count, and recent issues.",
  "inputSchema": {
    "supplierId": "string"
  },
  "outputCardTypes": ["supplier_status", "evidence", "recommended_actions"],
  "requiresUserReview": false,
  "writesBusinessData": false,
  "audit": {
    "recordInvocation": true,
    "action": "ai_tool_invoked"
  }
}
```

Suggested Phase 1/2 read-only entries:

- `findSupplier`
- `getSupplierStatus`
- `getInventoryPosition`
- `getInventoryRiskSummary`
- `getOpenPurchaseOrders`
- `getOverduePurchaseOrders`
- `getProcurementExceptions`

Suggested Phase 1/2 draft-preparation entries:

- `preparePurchaseRequestDraft`
- `prepareRfqDraft`
- `prepareInventoryExceptionDraft`

Registry rules:

- `get...` tools are read-only.
- `prepare...Draft` tools prepare reviewable draft structures only.
- Avoid naming tools `create...` in v1 unless they actually persist a user-approved draft.
- AI should not directly mutate business records without user approval and backend validation.
- Each tool should declare whether invocation should be audited.

## AI Chat Response Envelope Design

Future AI Chat responses should support natural-language text and structured cards together.

Example response envelope:

```json
{
  "message": "ABC Supplier is active, but delivery risk increased recently.",
  "intent": {
    "name": "supplier_status_query",
    "confidence": 0.86
  },
  "cards": [
    {
      "type": "supplier_status",
      "title": "ABC Supplier Status",
      "data": {
        "supplierId": "SUP-001",
        "status": "active",
        "score": "B+",
        "risk": "medium",
        "openPoCount": 6,
        "overduePoCount": 2
      }
    },
    {
      "type": "recommended_actions",
      "actions": [
        {
          "label": "View open POs",
          "kind": "deep_link",
          "target": "/procurement/purchase-orders?supplier=SUP-001"
        }
      ]
    }
  ],
  "evidence": [
    {
      "type": "purchase_order",
      "id": "PO-1024",
      "summary": "Delayed by 5 days"
    }
  ],
  "auditId": "AUD-20260624-0001"
}
```

Design rules:

- Existing `POST /api/ai/chat` behavior should not be broken.
- Structured cards can be introduced incrementally.
- `message` and `cards` should coexist.
- Existing provider, timing, and confidence metadata may remain while the envelope evolves.
- Frontend consumption can come later and should not be introduced by this backend design task.

## Backend Foundation Phase 2/2 Overview

Phase 2/2 should happen after Phase 1/2 is designed and implemented.

Scope:

- A. Master Data read-only APIs
- B. Lightweight business document model conventions
- C. Inventory movement ledger standardization
- D. AI Chat read-only status query implementation
- E. Reviewable draft preparation contract

Phase 2/2 should continue the JSON-backed incremental approach unless a separate database migration task is approved.

## Master Data API Design

Master Data should be introduced as read-only APIs first.

Recommended endpoints:

- `GET /api/master-data/items`
- `GET /api/master-data/items/:id`
- `GET /api/master-data/suppliers`
- `GET /api/master-data/suppliers/:id`
- `GET /api/master-data/warehouses`
- `GET /api/master-data/payment-terms`
- `GET /api/master-data/tax-codes`

Why Master Data comes before advanced AI:

- AI Chat needs stable item, supplier, warehouse, payment terms, and tax code references.
- Draft preparation should match master data instead of guessing.
- Procurement and inventory documents should reference canonical IDs.
- Evidence cards and audit entries are more useful when they point to stable business objects.

Example item contract:

```json
{
  "id": "ITEM-A100",
  "sku": "A100",
  "name": "Motor A100",
  "category": "Components",
  "baseUom": "pcs",
  "defaultWarehouseId": "WH-MAIN",
  "preferredSupplierId": "SUP-001",
  "leadTimeDays": 7,
  "moq": 100,
  "batchMultiple": 50,
  "status": "active"
}
```

Example supplier contract:

```json
{
  "id": "SUP-001",
  "name": "ABC Components",
  "status": "active",
  "risk": "medium",
  "score": "B+",
  "defaultCurrency": "USD",
  "paymentTermsId": "NET30",
  "categories": ["Components", "Motors"],
  "preferred": true
}
```

Implementation notes:

- Existing JSON arrays for products and suppliers can be mapped into canonical read models first.
- Implementation should confirm exact source field names before defining durable contracts.
- Read-only endpoints should avoid changing existing procurement and inventory write paths in the same phase.

## Business Document Model Conventions

The ERPNext reference notes are useful for document-oriented thinking, but FlowChain should not copy ERPNext's full scope or framework.

Lightweight FlowChain business document convention:

- `id`
- `documentType`
- `tenantId`
- `status`
- `createdBy`
- `createdAt`
- `source`
- `lines`
- `review`
- audit references where relevant

Example:

```json
{
  "id": "PR-1001",
  "documentType": "purchase_request",
  "tenantId": "tenant-flowchain-sme",
  "status": "draft",
  "createdBy": "user-buyer-001",
  "createdAt": "2026-06-24T10:30:00.000Z",
  "source": {
    "type": "ai_chat",
    "conversationId": "CHAT-001",
    "tool": "preparePurchaseRequestDraft"
  },
  "lines": [
    {
      "lineId": "PR-1001-1",
      "itemId": "ITEM-A100",
      "quantity": 500,
      "uom": "pcs",
      "requiredDate": "2026-07-03",
      "preferredSupplierId": "SUP-001"
    }
  ],
  "review": {
    "requiresUserReview": true,
    "missingFields": ["warehouseId"],
    "confidence": {
      "itemId": "high",
      "requiredDate": "medium",
      "preferredSupplierId": "medium"
    }
  }
}
```

Clarifications:

- Do not build a generic DocType builder.
- Use document-inspired conventions only for FlowChain's scoped business objects.
- Keep document lifecycle lightweight.
- Draft, review, submit, post, cancel, reverse, and close concepts should remain explicit where needed, but not become a full workflow engine.
- User final review is mandatory before save or submit for AI-prepared drafts.

## Inventory Movement Ledger Design

Inventory Movement Ledger explains: "What changed?"

Inventory Exception Documents explain: "Why did it change and how is the exception closed?"

Proposed movement schema:

```json
{
  "id": "IM-2031",
  "tenantId": "tenant-flowchain-sme",
  "itemId": "ITEM-A100",
  "warehouseId": "WH-MAIN",
  "movementType": "demand_issue",
  "quantityChange": -300,
  "balanceBefore": 420,
  "balanceAfter": 120,
  "sourceDocument": {
    "type": "demand_issue",
    "id": "DOC-1001",
    "lineId": "DOC-1001-1"
  },
  "reason": "Demand issue for urgent requirement",
  "createdAt": "2026-06-24T10:30:00.000Z",
  "createdBy": "system"
}
```

This supports:

- AI inventory status query
- inventory change explanation
- shortage risk explanation
- auditability
- source-document traceability

Implementation notes:

- Existing `GET /api/inventory-movements` should remain compatible.
- Phase 2/2 can normalize new movement records while preserving legacy fields where needed.
- Inventory movement writes should continue to be driven by deterministic backend rules, not by AI text alone.

## AI Chat Read-Only Status Query Implementation Path

The first AI Chat implementation path should focus on read-only status queries.

### Intent: supplier_status_query

User examples:

- "现在 ABC Supplier 状态怎么样？"
- "What is the current status of supplier ABC?"

Required backend tools:

- `findSupplier`
- `getSupplierStatus`
- `getSupplierPerformance`
- `getOpenPurchaseOrders`
- `getOverduePurchaseOrders`

Expected response cards:

- Supplier Status Card
- Evidence Card
- Recommended Actions Card

Evidence sources:

- supplier master
- supplier performance snapshot
- supplier risk snapshot if available
- open purchase orders
- overdue purchase orders
- recent receiving or quality issues

Non-goals:

- automatic supplier selection
- automatic approval
- external supplier execution

### Intent: inventory_status_query

User examples:

- "今天库存有什么风险？"
- "What is the current stock position for item A100?"

Required backend tools:

- `getInventoryPosition`
- `getInventoryRiskSummary`
- `getRecentInventoryMovements`
- `getOpenPurchaseOrders`

Expected response cards:

- Inventory Status Card
- Inventory Risk Card
- Evidence Card
- Recommended Actions Card

Evidence sources:

- item master
- warehouse stock position
- inventory movement ledger
- open inbound POs
- open inventory exception documents when available

Non-goals:

- automatic inventory adjustment
- automatic posting
- automatic exception closure

### Intent: procurement_exception_query

User examples:

- "今天有哪些采购问题需要处理？"
- "Which purchase orders are overdue?"

Required backend tools:

- `getProcurementExceptions`
- `getOpenPurchaseOrders`
- `getOverduePurchaseOrders`
- `getThreeWayMatchExceptions` when available

Expected response cards:

- Procurement Exception Card
- Evidence Card
- Recommended Actions Card

Evidence sources:

- overdue POs
- pending PRs
- RFQ status
- receiving status
- invoice or three-way match evidence when available

Non-goals:

- automatic PO creation
- automatic RFQ sending
- automatic receiving posting
- automatic approval

## Reviewable Draft Preparation Contract

Draft preparation is a future Phase 2/2 or later capability. AI Chat may return a draft card from the existing `POST /api/ai/chat` endpoint, or a dedicated endpoint may be introduced later.

Suggested draft response:

```json
{
  "draftType": "purchase_request",
  "status": "ready_for_review",
  "requiresUserReview": true,
  "fields": {
    "itemId": "ITEM-A100",
    "itemLabel": "Motor A100",
    "quantity": 500,
    "requiredDate": "2026-07-03",
    "preferredSupplierId": "SUP-001",
    "priority": "urgent"
  },
  "missingFields": ["warehouseId"],
  "confidence": {
    "itemId": "high",
    "quantity": "high",
    "requiredDate": "medium",
    "preferredSupplierId": "medium"
  },
  "warnings": [
    "Required date was inferred from 'next Friday'. Please review before saving."
  ],
  "allowedActions": [
    {
      "label": "Review draft",
      "kind": "review"
    },
    {
      "label": "Save draft",
      "kind": "save_after_review"
    }
  ]
}
```

Draft rules:

- AI prepares draft structures only.
- User final review is mandatory.
- Backend validation remains authoritative.
- No auto-submit.
- No auto-approval.
- No auto-posting.
- No external sending.
- Drafts must mark missing fields and low-confidence matches.
- Drafts should show evidence or source for autofill where practical.

## Recommended Implementation Sequence

Step 1: Create this technical design document only.

Step 2: Implement Phase 1/2 minimal backend foundation:

- `GET /api/me`
- `GET /api/tenants/current`
- audit domain helper
- audit repository
- static AI tool registry definition
- tests

Step 3: Implement Master Data read-only APIs:

- items
- suppliers
- warehouses
- payment terms
- tax codes

Step 4: Implement AI Chat read-only status query:

- supplier status query
- inventory status query
- procurement exception query

Step 5: Implement reviewable draft preparation:

- PR draft
- RFQ / quotation request draft
- missing fields
- confidence summary
- user review only

Each step should be additive, compatible with existing endpoints, and backed by focused tests.

## Explicit Non-Goals

This design does not include:

- PostgreSQL migration in Phase 1/2
- full RBAC
- SSO / MFA
- workflow engine
- supplier external account invitation
- supplier portal execution
- payment execution
- tax filing
- GL
- bank integration
- tax bureau integration
- OCR
- full ERP expansion
- frontend scope expansion
- autonomous AI execution
- automatic PO creation
- automatic RFQ sending
- automatic inventory adjustment
- automatic GRN posting
- automatic approval

## Acceptance Criteria For Future Implementation

Future implementation should satisfy:

- existing API behavior remains compatible
- new endpoints are additive
- audit schema is reusable
- AI tool registry is explicit and controlled
- AI Chat response envelope supports both text and structured cards
- tests cover new endpoints and helpers
- no unrelated data file is touched
- no frontend expansion is introduced unless separately scoped
- backend validation remains authoritative
- user final review is required before AI-prepared drafts are saved or submitted

## Scope Guardrails

FlowChain remains an SME-focused AI-assisted supply chain and supplier management platform. Backend Foundation Phase 1/2 and Phase 2/2 should support current supply chain, supplier management, procurement, inventory, finance collaboration visibility, reporting, data management, and AI explanation needs without turning FlowChain into a generic ERP.

AI Chat Copilot is a core product capability, but it should not own backend business rules, approvals, persistence, posting, payment execution, or autonomous state changes.

The frontend remains in Frontend Scope Freeze / Frontend Stability Milestone. This backend design should not weaken that milestone or introduce new frontend modules, routes, cards, KPIs, tables, workflows, or UI expansions.

## Documentation Quality Requirements

This document should remain:

- implementation-oriented but not code-writing
- grounded in the current `server/` structure
- clear about additive backend evolution
- explicit about non-goals
- concise enough to guide the next backend tasks
- aligned with `docs/backend-foundation-v1-plan.md`, `docs/erpnext-reference-notes-for-flowchain.md`, and `docs/ai-chat-copilot-v1-plan.md`

This document is complete when it covers both Backend Foundation Phase 1/2 and Phase 2/2, connects backend foundation to AI Chat Copilot, reflects the inspected backend structure, protects FlowChain's SME supply chain/SRM positioning, and avoids full ERP expansion.
