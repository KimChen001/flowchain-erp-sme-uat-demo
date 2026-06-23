# ERPNext Reference Notes for FlowChain

## Purpose

This is an internal architecture reference note for FlowChain. ERPNext is being studied as a mature business-system reference for document-oriented business modeling, document lifecycle design, procurement and inventory traceability, supplier performance concepts, and master data structure.

This note does not authorize expanding FlowChain into a full ERP. FlowChain remains an AI-assisted supply chain and supplier management platform for SMEs, with a frozen frontend scope and a planned backend foundation that should support the current product boundaries.

The goal is to learn from ERPNext's structural design, not to copy its full product breadth, accounting architecture, or framework-level customization model.

## ERPNext Design Patterns Worth Studying

### Document-Centric Business Modeling

ERPNext models business operations as named documents with stable identifiers, statuses, lifecycle hooks, linked parties, linked master data, and child rows. A purchase flow is not just a set of screens; it is a chain of documents such as Material Request, Request for Quotation, Supplier Quotation, Purchase Order, Purchase Receipt, and Purchase Invoice.

For FlowChain, the important lesson is that each business event should become a durable business object, not a transient UI state. PRs, RFQs, POs, receiving records, inventory movements, exception documents, supplier score snapshots, and reconciliation records should all have clear identity, ownership, status, line items, source references, and audit history.

### Structured Master Data

ERPNext relies heavily on structured master data such as Item, Supplier, Warehouse, Payment Terms Template, price lists, tax templates, and settings. These records are used to populate transactional documents and reduce repeated manual entry.

For FlowChain, Master Data should remain the canonical source for items, suppliers, warehouses and bins, tax codes, and payment terms. Backend implementation should start here because transactional APIs depend on stable item, supplier, warehouse, tax, and payment-term references.

### Transaction Documents With Line Items

ERPNext's buying and stock documents use child tables for item lines. For example, request, quotation, order, and receipt documents each have item rows that carry item code, quantity, warehouse, and source-document references.

FlowChain should keep the same modeling discipline. A PR header alone is not enough; the business meaning sits in line rows: SKU, required quantity, promised date, supplier, warehouse, receiving quantity, invoice quantity, match variance, and exception reason. Line-level source links are essential for AI explanation, audit, and traceability.

### Document Lifecycle Controls

ERPNext uses document lifecycle states and hooks such as draft, submit, cancel, validate, on submit, and on cancel. It also computes operational statuses from the underlying document state, such as ordered, received, billed, closed, or cancelled.

FlowChain does not need to copy ERPNext's framework mechanics, but it should adopt lifecycle thinking:

- Draft: created but not yet committed to operational history.
- Review: ready for user validation or approval.
- Submitted or posted: accepted as a business event.
- Cancelled or reversed: explicitly closed with a traceable reason.
- Closed: operationally complete, with no further action expected.

The key principle is that status should be computed from business facts where practical, not manually overwritten without evidence.

### Linked Source Documents

ERPNext preserves source links across the buying chain. RFQ item rows can reference material request rows, supplier quotation rows can reference RFQ or material request rows, PO item rows can reference supplier quotation or material request rows, and purchase receipt item rows can reference PO and material request rows.

FlowChain should adopt this source-document model. A user should be able to ask why a PO exists, which PR or replenishment signal created it, which supplier quotation supported it, which receiving document closed it, and which invoice or reconciliation exception remains open.

### Stock Ledger And Movement Traceability

ERPNext's Stock Ledger Entry is a consolidated record of inventory movement. It records item, warehouse, posting date and time, voucher type, voucher number, quantity movement, resulting quantity, and valuation-related fields.

FlowChain should treat Inventory Movement Ledger as a core traceability model. It answers: "What changed?" Every inventory movement should point back to a source document or business event, such as receiving, transfer, count adjustment, exception closure, or manual correction.

### Procurement Chain

ERPNext's buying workspace makes the procurement chain explicit: Material Request, Request for Quotation, Supplier Quotation, Purchase Order, Purchase Receipt, and invoice-related documents. This provides a clean mental model for status, exception handling, and downstream reporting.

FlowChain should keep the same backbone within its narrower P2P scope:

- Need signal or replenishment request.
- PR review.
- RFQ and quote comparison where needed.
- PO creation and supplier commitment.
- GRN or receiving collaboration.
- Invoice collaboration and three-way match.
- Return, credit, or reconciliation follow-up.

### Supplier Scorecard And Performance Concepts

ERPNext includes supplier scorecard structures such as scorecard criteria, scoring variables, scoring standings, scoring periods, weights, formulas, and actions such as warnings or prevention rules.

FlowChain should not copy the enforcement-heavy behavior directly, but it should study the structure: scoring dimensions, rule versions, evidence variables, period snapshots, standing thresholds, and supplier-level score history. This maps well to FlowChain's SRM scoring snapshot and scoring rules workbench.

### Settings And Defaults

ERPNext uses settings and defaults to reduce manual data entry, such as default warehouses, price lists, payment terms, tolerances, and buying or stock settings.

FlowChain should adopt carefully scoped defaults from Master Data. Defaults should help draft PRs, RFQs, POs, receiving records, and invoice collaboration records, but they should remain transparent and reviewable.

## FlowChain Mapping

| ERPNext concept | FlowChain mapping | Design note |
| --- | --- | --- |
| Material Request / Purchase Request | PR / replenishment request | Keep as the earliest structured demand signal for procurement or replenishment. |
| Request for Quotation | RFQ / quotation request | Use when supplier comparison or quote collection is needed. |
| Supplier Quotation | Supplier quotation / quote comparison | Store supplier response lines and link them back to RFQ or PR lines. |
| Purchase Order | PO | Preserve supplier, item lines, schedule, warehouse, pricing, and source references. |
| Purchase Receipt | GRN / receiving collaboration | Record received quantities, variances, quality holds, and PO references. |
| Stock Ledger Entry | Inventory Movement Ledger | Record what changed in inventory with source document references. |
| Stock Reconciliation | Inventory Exception Documents / adjustment closure | Use exception documents to explain why inventory changed and how the issue was closed. |
| Supplier Scorecard | SRM scoring snapshot | Keep score, dimension evidence, rule version, and recommended next action. |
| Item / Warehouse / Supplier / Payment Terms | Master Data | Keep as canonical records used by all transactional documents. |

The strongest mapping is between ERPNext's document chain and FlowChain's current module boundaries. FlowChain should preserve the chain without inheriting ERPNext's full accounting, sales, HR, manufacturing, project, or point-of-sale scope.

## What FlowChain Should Adopt

FlowChain should adopt business document thinking. Each meaningful operational event should become a structured business object with an owner, status, evidence, source references, and audit attribution.

FlowChain should adopt master data first. Backend persistence should start with canonical items, suppliers, warehouses and bins, tax codes, and payment terms before transactional APIs. Without reliable master data, AI draft generation and document validation will be brittle.

FlowChain should adopt clear line-item models. Header records should provide context, but line rows should carry item, quantity, warehouse, promised date, received quantity, invoice quantity, variance, exception, and source-link detail.

FlowChain should adopt a simple lifecycle model: draft, review, submit or post, cancel or reverse, and close. The implementation should stay lighter than ERPNext, but lifecycle transitions must be explicit and auditable.

FlowChain should adopt source-document references. PR lines should link to RFQ, quotation, PO, receiving, invoice, match, and exception records where relevant. Inventory movements should link to the document or action that caused them.

FlowChain should adopt inventory ledger traceability. The Inventory Movement Ledger should answer what changed, while Inventory Exception Documents should answer why it changed and how the exception was closed.

FlowChain should adopt auditability. User actions, AI-assisted draft generation, user edits, status changes, imports, exports, and exception closures should be attributable to an actor, timestamp, module, entity, and action.

FlowChain should adopt status computation from underlying documents. For example, PO status should reflect received and invoiced quantities, not just a manually chosen label. Exception status should reflect evidence, closure actions, and remaining variance.

FlowChain should adopt defaults from Master Data. Supplier defaults, item defaults, warehouses, payment terms, and tax codes should populate drafts where safe, with visible evidence and user review.

FlowChain should ground AI Chat in structured business objects. The AI layer should explain, draft, compare, summarize, and recommend using documented entities and relationships rather than free-text inference alone.

## What FlowChain Should Not Adopt

FlowChain should not copy ERPNext's full ERP scope. The product should not become a generic ERP suite.

FlowChain should not adopt an accounting-heavy architecture as its center of gravity. Finance remains supporting visibility for supplier invoices, payables, credits, reconciliation, settlement readiness, and tax split visibility.

FlowChain should not add GL, payment execution, payment engine behavior, tax filing, bank integration, or tax bureau integration as part of this direction.

FlowChain should not expand into full Sales/O2C, HR, payroll, CRM, POS, asset management, project management, or manufacturing-heavy scope unless separately planned and approved.

FlowChain should not copy ERPNext's full workflow engine, deep permission matrix, or no-code DocType builder. Backend Foundation v1 should use simple role context and audit attribution, not complex RBAC or workflow customization.

FlowChain should not launch a full supplier or customer portal in the first backend phase. Supplier-facing concepts can remain a future reference, but initial backend work should focus on internal operational visibility, structured documents, and auditability.

FlowChain should not use AI Chat as a replacement for deterministic backend rules. AI can prepare drafts and explanations, but validation, posting, inventory adjustments, and status transitions need explicit backend rules and user confirmation.

FlowChain should not weaken the frontend scope freeze. ERPNext is a reference for backend and business-object architecture, not a reason to add more screens, routes, KPIs, workflow branches, or UI density.

## AI Chat Copilot Implications

ERPNext's document-centric design shows why FlowChain's AI Chat Copilot should be grounded in structured business objects. AI becomes more useful when it can reference a supplier, PR, RFQ, PO, GRN, invoice, inventory movement, exception document, and score snapshot directly.

AI Chat should support supplier status queries. A user should be able to ask about supplier risk, current score, open RFQs, delayed POs, invoice exceptions, certification status, and linked evidence.

AI Chat should support inventory status queries. A user should be able to ask which SKUs are at risk, what changed in inventory, which movements affected a SKU, which warehouse or bin is involved, and which exception document explains a variance.

AI Chat should support procurement exception queries. A user should be able to ask why a PO is delayed, whether a GRN variance is still open, whether an invoice mismatch is tied to receiving, and what evidence supports the next action.

AI Chat should provide evidence-backed explanations. Each answer should reference structured records, timestamps, source documents, and confidence or evidence summaries where possible.

AI Chat should prepare reviewable drafts from natural language or keywords. Suitable draft types include PR drafts, RFQ drafts, supplier quotation comparison summaries, PO draft inputs, receiving discrepancy summaries, and exception closure recommendations.

AI Chat should detect missing fields. If a draft lacks supplier, warehouse, payment terms, tax code, required date, or item master detail, the assistant should identify the gap and suggest a next step.

AI Chat should present guided action cards and deep links. Recommendations should route the user to the relevant module and document, not hide the process behind chat.

AI Chat should not directly submit, approve, post, pay, or adjust inventory without user confirmation. It should prepare drafts and recommendations, then leave final review and execution to the user and deterministic backend rules.

Backend validation should remain deterministic. AI-generated suggestions must pass the same validation rules as manually created documents.

The audit log should capture AI-assisted draft generation, the user's edits, the final user action, and the source records used to generate the recommendation.

## Backend Implications

This ERPNext reference reinforces the Backend Foundation v1 sequence:

1. Master Data API should come before advanced AI automation. AI draft quality depends on reliable items, suppliers, warehouses, tax codes, and payment terms.
2. Document APIs should preserve source links and lifecycle states. PR, RFQ, quotation, PO, GRN, invoice, reconciliation, and exception objects should expose parent and child references.
3. Inventory Movement Ledger should be treated as a core traceability model. It should not be an afterthought or derived only from UI tables.
4. Inventory Exception Documents should complement the ledger. The ledger records what changed; exception documents record why it changed, who handled it, and how it was closed.
5. Audit log should support AI-assisted actions. AI-generated drafts, user acceptance, user edits, and final actions should be attributable.
6. Template and default logic should support AI draft generation. Defaults should come from Master Data and settings, not from hidden assistant assumptions.
7. Future APIs should expose structured tools for AI Chat. The assistant should call explicit resource and draft-preparation endpoints instead of inferring business state from raw text.

Backend Foundation v1 should stay planning-led and incremental. It should not start with broad infrastructure, complex permissions, or external integrations before stable business resources exist.

## Scope Guardrails

FlowChain remains an SME-focused AI-assisted supply chain and supplier management platform. ERPNext is a reference, not a scope target.

The current frontend scope freeze should remain intact. Do not add new frontend modules, routes, cards, KPIs, tables, workflows, or UI expansions because ERPNext has a broader feature set.

Do not expand FlowChain into full ERP, CRM, HR, full Sales/O2C, GL, payment execution, tax filing, bank integration, tax bureau integration, OCR, complex RBAC, full workflow engine, or external supplier account invitation unless separately scoped.

Do not introduce customer-visible product copy or metadata using terms such as `UAT`, `demo`, `demo-only`, `sample`, `样本数据`, `演示环境`, `非生产环境`, `仅用于演示`, `不写入真实后端`, or `不生成真实库存`.

Do not restore PDF export as part of ERPNext-inspired planning. Current export scope should remain CSV and evidence-oriented unless a separate product decision changes that.

## Recommended Next Design Steps

Recommended documentation-only follow-ups:

1. `docs/ai-chat-copilot-v1-plan.md`
2. `docs/business-document-model-v1.md`
3. `docs/procurement-document-lifecycle-v1.md`
4. `docs/inventory-ledger-and-exception-model-v1.md`

These should be created only when explicitly requested. The next implementation step should still follow the backend foundation sequence: master data and auditability first, then SRM supplier profile and scoring APIs, then procurement, inventory, and finance collaboration APIs.

## Acceptance Criteria

This reference note is complete when it:

- Explains ERPNext as an architecture and business-object reference, not a scope target.
- Separates what FlowChain should adopt from what it should avoid.
- Maps ERPNext-inspired concepts to FlowChain's current supply chain and SRM scope.
- Connects structured business objects to the AI Chat Copilot direction.
- Preserves FlowChain's SME supply chain and supplier management positioning.
- Protects the frontend scope freeze and avoids application code changes.
