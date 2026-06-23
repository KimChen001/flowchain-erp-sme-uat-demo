# AI Chat Copilot v1 Plan

## Purpose

AI Chat Copilot is a core FlowChain differentiator, not a minor add-on. It should help SME users ask natural-language or keyword-based operational questions, retrieve evidence, understand exceptions, prepare reviewable drafts, and decide the next action without losing control of the business process.

This planning document defines the v1 product and backend scope for AI Chat Copilot. It does not introduce implementation code, frontend changes, or autonomous execution behavior.

## Product Positioning

FlowChain AI Chat Copilot helps SME users interact with supply chain operations through natural language. It can answer supplier, inventory, procurement, and finance collaboration questions; retrieve supporting evidence; explain exceptions; prepare business document drafts; and guide users to the next action while keeping users in control.

It is not a generic chatbot.

It is not a fully autonomous execution engine.

It is not a replacement for deterministic backend business rules.

It should be grounded in structured business objects, source documents, audit logs, and master data.

## Core Capability Areas

### A. Status Query

AI Chat Copilot should answer operational status questions with concise, structured outputs.

Examples:

- "What is the current status of supplier ABC?"
- "Which inventory items are at risk today?"
- "Which purchase orders are overdue?"
- "What is the current stock position for item A100?"

Expected output:

- concise summary
- structured status card
- key metrics
- related evidence
- recommended next actions

### B. Evidence Retrieval

AI answers should be evidence-backed instead of generic text. The assistant should be able to surface the source objects behind a status or explanation.

Examples:

- related PO
- related GRN
- inventory movement ledger
- supplier score snapshot
- inventory exception document
- invoice / three-way match evidence

Evidence should be tied to concrete records, timestamps, and source references where available.

### C. Exception Explanation

AI Chat Copilot should explain why a business state changed or why a risk exists.

Examples:

- explain shortage risk
- explain inventory change
- explain supplier risk increase
- explain overdue PO impact
- explain three-way match difference
- explain unresolved inventory exception

The explanation should connect observed facts to underlying source records and not rely on free-text speculation.

### D. Draft Preparation

AI Chat Copilot should prepare reviewable drafts from natural language or keywords. Drafting is one skill inside the broader copilot experience, not the whole product.

Examples:

- PR draft from natural language or keywords
- RFQ / quotation request draft
- supplier quotation comparison note
- inventory exception draft

Important:

- AI should prepare reviewable drafts only.
- AI should not submit, approve, post, issue, pay, or adjust inventory automatically.
- Users must do final review and modification before save or submit.

### E. Guided Actions

AI responses should guide users to the next useful action with clear entry points into the relevant module or document.

Examples:

- View supplier
- View open POs
- Review evidence
- Prepare PR draft
- Prepare RFQ draft
- Open inventory movement ledger
- Open exception document

Guided actions should support deep links to related modules, not replace them.

## Example User Journeys

### Example 1: Supplier Status Query

User:

- "现在 ABC Supplier 状态怎么样？"

Expected AI behavior:

- find supplier
- retrieve supplier profile
- retrieve score / risk snapshot
- retrieve open PO count
- retrieve overdue PO count
- retrieve recent quality or delivery issues
- return Supplier Status Card + Evidence Card + Recommended Actions

### Example 2: Inventory Status Query

User:

- "今天库存有什么风险？"

Expected AI behavior:

- retrieve inventory risk signals
- identify shortage or excess risks
- link to item master and inventory movement evidence
- return Inventory Risk Summary Card + suggested actions

### Example 3: Procurement Exception Query

User:

- "今天有哪些采购问题需要处理？"

Expected AI behavior:

- retrieve overdue PO
- retrieve pending RFQ / PR issues
- retrieve receiving or invoice match exceptions if available
- rank issues by urgency
- return Procurement Exception Card + guided action cards

### Example 4: PR Draft Preparation

User:

- "帮我生成一个 PR，买 500 个 motor，下周五前要。"

Expected AI behavior:

- detect intent: prepare_purchase_request_draft
- match item master
- infer quantity and required date
- identify missing fields
- apply default requester / tenant context
- return reviewable PR Draft Card
- do not submit

### Example 5: RFQ / Quotation Request Draft

User:

- "帮我给三个供应商询价，item A100，数量 1000，月底前交货。"

Expected AI behavior:

- detect intent: prepare_rfq_draft
- match item
- suggest supplier candidates if available
- infer quantity and target delivery date
- identify quotation deadline as missing if not provided
- return reviewable RFQ Draft Card
- do not send to suppliers automatically

## Response Card Model

Do not implement these cards in this task. This section defines the conceptual response shapes AI Chat Copilot should use.

| Card | Purpose | Key fields | Possible actions | Mode |
| --- | --- | --- | --- | --- |
| Supplier Status Card | Summarize supplier health and active work | supplier, score, risk, open POs, overdue POs, recent issues, linked evidence | view supplier, review evidence, open POs, prepare note | Read-only |
| Inventory Status Card | Summarize item or warehouse stock state | item, on-hand, reserved, shortage risk, excess risk, location, movement summary | open item master, open movement ledger, review evidence | Read-only |
| Inventory Risk Card | Highlight inventory exceptions or risk flags | item, warehouse, risk type, severity, trigger, open exception, evidence | open exception, open movement ledger, review evidence | Read-only |
| Procurement Exception Card | Show overdue or blocked procurement work | PO, RFQ, PR, exception type, urgency, owner, age, evidence | open document, review evidence, prepare draft | Read-only |
| Evidence Card | Surface supporting source records | source type, source id, timestamp, key fields, confidence, trace path | open source document, compare sources | Read-only |
| PR Draft Card | Present a reviewable purchase request draft | item, quantity, required date, requester, warehouse, supplier hint, missing fields, evidence | edit draft, save draft, discard | Reviewable |
| RFQ Draft Card | Present a reviewable quotation request draft | item, quantity, target date, supplier list, deadline, missing fields, evidence | edit draft, save draft, discard | Reviewable |
| Missing Fields Card | Make incomplete input explicit | missing field, why it matters, suggested default or follow-up, confidence | fill field, choose default, ask for clarification | Reviewable |
| Confidence Summary Card | Show how reliable the answer or draft is | confidence level, autofill count, uncertain fields, source coverage, fallback notes | inspect evidence, refine input, continue with caution | Read-only |
| Recommended Actions Card | Guide the next step | next actions, module links, draft links, review step, blocked step | open module, review draft, view evidence | Action-oriented |

## Tool / Skill Registry Concept

AI Chat Copilot should call a small, explicit backend tool registry rather than infer business state from raw text alone.

### Suggested read-only tools

- findSupplier
- getSupplierStatus
- getSupplierPerformance
- getSupplierRiskSnapshot
- getInventoryPosition
- getInventoryRiskSummary
- getRecentInventoryMovements
- getOpenPurchaseOrders
- getOverduePurchaseOrders
- getProcurementExceptions
- getThreeWayMatchExceptions

### Suggested draft-preparation tools

- preparePurchaseRequestDraft
- prepareRfqDraft
- prepareInventoryExceptionDraft
- prepareSupplierReviewNote

### Registry rules

- `get...` tools are read-only.
- `prepare...Draft` tools create reviewable draft structures only.
- Avoid naming tools as `create...` in v1 unless they actually persist a user-approved draft.
- AI should not directly mutate business records without user approval and backend validation.

## Backend Dependencies

AI Chat Copilot depends on a small set of backend foundations rather than on a generic conversational layer.

Required dependencies:

- minimal user / tenant context
- audit log foundation
- Master Data APIs
- supplier profile / scoring snapshots
- inventory movement ledger
- procurement document lifecycle
- structured source-document references
- deterministic validation rules
- draft templates and default values

This plan aligns with `docs/backend-foundation-v1-plan.md` and `docs/erpnext-reference-notes-for-flowchain.md`. The backend foundation document establishes the persistence and audit direction. The ERPNext reference notes explain why FlowChain should model durable business documents, source links, and lifecycle states instead of treating chat as free-form text.

## AI Draft Behavior

Draft generation should behave like assisted business form preparation, not autonomous execution.

Expected behavior:

- extract fields from natural language or keywords
- match against master data
- apply default values where reliable
- mark missing fields
- mark low-confidence matches
- show evidence or source for autofill when practical
- allow user review and modification
- do not auto-submit
- do not auto-approve
- do not auto-post
- do not auto-send externally

The assistant should be useful when input is incomplete, but it should make uncertainty visible rather than hiding it.

## Governance and Auditability

AI-assisted actions should be auditable.

Audit examples:

- AI generated PR draft from chat
- AI matched item master with confidence level
- AI suggested supplier candidates
- user edited quantity
- user saved draft
- user submitted draft after review

Clarifications:

- audit log should record final user actions
- AI suggestion history should be traceable where practical
- backend validation remains authoritative

## Non-Goals For v1

AI Chat Copilot v1 does not include:

- autonomous PO creation
- automatic supplier selection without review
- automatic RFQ sending
- automatic contract generation
- automatic inventory adjustment
- automatic GRN posting
- automatic approval
- payment execution
- tax filing
- bank integration
- GL posting
- external supplier portal execution
- full workflow engine
- complex RBAC
- generic enterprise chatbot scope
- full ERP expansion

## Implementation Sequencing

### Phase 1: Read-only AI status query

Start with safe, read-only answers that summarize current business state.

Scope:

- supplier status
- inventory status
- procurement exception summary
- overdue PO summary

### Phase 2: Evidence-backed explanation

Add explanations that connect observed status to source documents and movement history.

Scope:

- supplier risk explanation
- inventory movement explanation
- shortage risk explanation
- procurement exception explanation

### Phase 3: Reviewable draft preparation

Add draft-preparation skills that assemble reviewable business documents from user intent.

Scope:

- PR draft
- RFQ / quotation request draft
- inventory exception draft

### Phase 4: Guided action cards

Add structured follow-through that points users to the right module or document.

Scope:

- deep links
- review evidence
- prepare draft
- save draft only after user confirmation

### Phase 5: Controlled execution after user approval

Only after explicit user approval should backend validation and execution occur.

Scope:

- user approves
- backend validates
- backend executes
- audit log records
- no autonomous execution

## Scope Guardrails

FlowChain remains an SME-focused AI-assisted supply chain and supplier management platform. AI Chat Copilot should strengthen that product identity, not turn FlowChain into a generic ERP.

The current frontend scope freeze should remain intact. Do not add new frontend modules, routes, cards, KPIs, tables, workflows, or UI expansions in response to this plan.

AI Chat Copilot should stay grounded in structured business objects, source documents, audit logs, and master data. It should not become a replacement for deterministic business rules or a new umbrella workflow system.

## Recommended Next Design Steps

Recommended documentation-only follow-ups:

- `docs/ai-chat-tool-registry-v1.md`
- `docs/business-document-model-v1.md`
- `docs/procurement-document-lifecycle-v1.md`
- `docs/inventory-ledger-and-exception-model-v1.md`
- `docs/backend-phase-1-2-technical-design.md`

These should be created only when explicitly requested.

## Acceptance Criteria

This planning document is complete when it:

- treats AI Chat Copilot as a core FlowChain capability
- covers status query, evidence retrieval, exception explanation, draft preparation, and guided actions
- makes final user review mandatory before save or submit
- connects AI Chat Copilot to backend foundation, master data, audit log, and ERPNext-inspired business document modeling
- preserves FlowChain's SME supply chain and supplier management positioning
- avoids expanding FlowChain into a full ERP
- does not introduce implementation code
