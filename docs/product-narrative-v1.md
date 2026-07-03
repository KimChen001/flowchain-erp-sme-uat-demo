# Product Narrative v1

## Positioning

FlowChain is an AI-assisted inventory, sales-demand, procurement, and supplier operations platform for SMEs.

FlowChain 是面向中小企业的 AI 进销存与供应链协同工作台，帮助团队围绕销售需求、库存、采购、收货、供应商和发票协同异常，识别交付风险、解释供需缺口、生成可复核动作，并形成可追踪的异常处理闭环。

FlowChain is not a full ERP replacement, not a full finance/GL system, not an HR/payroll system, not a CRM/customer lifecycle suite, not a bank/payment execution system, not a tax filing system, and not an autonomous AI execution platform.

## Target Users

FlowChain is designed for SME operations teams where planners, buyers, warehouse staff, supplier managers, sales-demand coordinators, and finance collaborators need a shared operating picture without adopting a heavy enterprise ERP stack upfront.

Typical users include:

- planners reviewing sales demand, inventory availability, and material requirement gaps;
- buyers tracking PR, RFQ, PO, GRN, and invoice evidence;
- inventory teams monitoring available stock, reserved stock, in-transit quantities, and shortages;
- supplier managers reviewing supplier follow-up and operational risk;
- finance collaborators checking invoice and three-way-match exceptions;
- leadership reviewing daily supply chain priorities and exception closure progress.

## Pain Points

SME operations work is often fragmented:

- sales demand, inventory, procurement, and supplier evidence are scattered across spreadsheets, email, chat, and local files;
- inventory risk is not connected clearly to procurement actions;
- PR/RFQ/PO/GRN/invoice flow is hard to trace end to end;
- supplier visibility is weak around overdue orders, RFQ response status, and exception follow-up;
- finance-collaboration exceptions are visible late, after procurement and receiving decisions have already moved on;
- AI tools often provide generic suggestions without business evidence, audit boundaries, or user review controls.

## FlowChain Value

FlowChain packages a focused operations workflow:

- Today Cockpit gives a daily view of urgent follow-ups, inventory risks, recent documents, and recommended review-first actions.
- Sales Demand Lite will connect lightweight customer order demand to inventory availability and procurement evidence.
- Inventory Allocation / Availability will explain available, reserved, in-transit, and shortage quantities.
- Demand-to-Procurement Links connect sales demand, shortages, purchase requests, RFQs, purchase orders, receiving, and invoice exceptions.
- Procurement/P2P visibility connects purchase requests, RFQs, purchase orders, receiving, invoices, and three-way match signals.
- Supplier/SRM context links supplier master data, performance, RFQ participation, PO exposure, invoice issues, and inventory risk.
- AI Assistant answers with deterministic read-model evidence before any provider path.
- Draft-first actions prepare PR, RFQ, supplier follow-up, and exception case drafts for user review instead of executing autonomous writes.

## Current Development Scope

The current implementation is a local JSON-backed development project suitable for product walkthroughs, workflow validation, architecture review, and repeatable local testing. It is intentionally not production-ready persistence.

Implemented foundations include canonical evidence links, navigation recovery, Today Cockpit read models, procurement and inventory read APIs, AI cockpit fast path, AI provider safety gate, audit latency hardening, action draft preview, exception case workflow controls, and system harness tests.

## Roadmap Shape

- Phase 0 Product positioning and language governance
- Phase 1 Sales Demand Lite
- Phase 2 Inventory Allocation
- Phase 3 Demand-to-Procurement Evidence Chain
- Phase 4 AI Control Tower v2
- Phase 5 Review-first Action Workflow
- Phase 6 DB persistence, tenant isolation, RBAC, audit
- Phase 7 DingTalk / WeCom notification draft adapter
- Phase 8 deployment and launch hardening
