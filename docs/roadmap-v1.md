# Roadmap v1

## Product Direction

FlowChain is an AI-assisted inventory, sales-demand, procurement, and supplier operations platform for SMEs. The roadmap keeps the product focused on evidence-backed operations workflows rather than full ERP replacement.

## Phase 0 Product Positioning and Language Governance

- Reposition FlowChain around SME inventory, sales-demand, procurement, supplier operations, and finance-collaboration exceptions.
- Standardize user-visible copy in simplified Chinese for China SME users.
- Keep internal enums, adapter names, and draft types out of visible UI.
- Document allowed business abbreviations such as SKU, MRP, RFQ, PO, PR, and GRN with Chinese meaning.

## Phase 1 Sales Demand Lite

- Add lightweight sales demand and customer order visibility.
- Keep scope limited to demand evidence and customer order signals.
- Current foundation: read-only customer order list, delivery risk summary, SKU impact, PO-to-sales impact, Today Cockpit sales risk card, global search target, and deterministic AI answers.
- Do not build a full CRM or customer lifecycle suite.

## Phase 2 Inventory Allocation

- Explain available quantity, reserved quantity, in-transit quantity, and shortage quantity.
- Connect stock risk to demand and procurement evidence.
- Current implementation scope: Inventory Allocation / Availability / Available to Promise / Reservation Preview foundation.
- Make allocation evidence explicit across customer orders, inventory item availability, open PO receipts, suppliers, receiving records, and shortage reasons.
- Provide generic internal notification draft product slots without external sending.
- Do not build complex WMS execution.

## Phase 3 Demand-to-Procurement Evidence Chain

- Link sales demand, shortage signals, PR, RFQ, PO, GRN, supplier, and invoice exception evidence.
- Make evidence navigation and recovery paths stable for daily operations.
- Keep relationship and evidence resolvers read-only.
- Next focus after Phase 2: Demand-to-Procurement Evidence Chain.

## Phase 4 AI Control Tower v2

- Improve Today Cockpit and AI Assistant evidence quality.
- Keep providers disabled by default.
- Keep all AI answers evidence-backed and non-mutating.

## Phase 5 Review-first Action Workflow

- Expand review-first drafts for procurement, supplier follow-up, exception case, and notification workflows.
- Require user confirmation for any future safe write.
- Do not allow autonomous AI execution.

## Phase 6 DB Persistence, Tenant Isolation, RBAC, Audit

- Introduce database-backed persistence behind repository adapters.
- Add tenant isolation, user roles, permissions, and audit logs.
- Keep local JSON-backed behavior available for development until explicitly replaced.

## Phase 7 Collaboration Notification Draft Adapters

- Prepare notification drafts and task handoff payloads.
- Do not send real external messages by default.
- Keep user review and confirmation in the loop.
- Future adapter candidates: Email, Slack, Microsoft Teams, DingTalk, WeCom, Feishu.

## Phase 8 Deployment and Launch Hardening

- Harden build, deployment, configuration, monitoring, error handling, and security.
- Keep production-readiness claims tied to implemented infrastructure.

## Non-goals

- Not a full ERP replacement.
- No full finance/GL.
- No HR/payroll.
- No CRM/customer lifecycle suite.
- No bank/payment execution.
- No tax filing.
- No autonomous AI execution.
