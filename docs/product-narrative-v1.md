# Product Narrative v1

## Positioning

FlowChain is an AI-assisted supply chain and supplier management platform for SMEs. It helps teams that currently rely on Excel, email, WeChat, and manual approvals move toward structured procurement, inventory, supplier, and finance-collaboration visibility.

FlowChain is not a full ERP, not a SAP or Oracle replacement, not a full finance/GL system, not a payment execution system, not a tax filing system, and not a fully autonomous AI system.

## Target Users

FlowChain is designed for SME supply chain teams where buyers, planners, warehouse staff, supplier managers, and finance collaborators need a shared operating picture without adopting a heavy enterprise ERP stack upfront.

Typical users include:

- procurement managers tracking PR, RFQ, PO, GRN, and invoice evidence;
- inventory planners monitoring low stock, exceptions, and replenishment needs;
- supplier managers reviewing supplier follow-up and operational risk;
- finance collaborators checking invoice and three-way-match visibility;
- leadership reviewing daily supply chain priorities.

## Pain Points

SME supply chain work is often fragmented:

- procurement data is scattered across spreadsheets, email, chat, and local files;
- supplier visibility is weak, especially around overdue orders, RFQ response status, and exception follow-up;
- inventory risk is not connected clearly to procurement actions;
- PR/RFQ/PO/GRN/invoice flow is hard to trace end to end;
- AI tools often provide generic suggestions without business evidence, audit boundaries, or user review controls.

## FlowChain Value

FlowChain packages the current UAT demo around a focused set of supply chain workflows:

- Today Cockpit gives a daily view of urgent follow-ups, inventory risks, recent documents, and recommended actions.
- Procurement/P2P visibility connects purchase requests, RFQs, purchase orders, receiving, invoices, and three-way match signals.
- Inventory risk surfaces low stock, shortages, movements, exceptions, and replenishment context.
- Supplier/SRM context links supplier master data, performance, RFQ participation, PO exposure, invoice issues, and inventory risk.
- AI Assistant answers with deterministic read-model evidence before any provider fallback.
- Draft-first actions prepare PR, RFQ, and supplier follow-up drafts for user review instead of executing autonomous writes.
- Audit and safety boundaries keep provider access opt-in, avoid secret leakage, and keep read-only AI answers resilient to audit persistence failures.

## Current UAT Scope

The current implementation is JSON/demo-data-backed and suitable for product walkthroughs, UAT scenario validation, architecture review, and interview/demo storytelling. It is intentionally not production-ready persistence.

Implemented foundations include canonical evidence links, navigation recovery, Today Cockpit read models, procurement and inventory read APIs, AI cockpit fast path, AI provider safety gate, audit latency hardening, action draft preview, and system harness tests.

## Roadmap Shape

The near-term roadmap is to keep runtime behavior stable while preparing repository boundaries for future persistence:

- lock JSON behavior with contract tests;
- add persistence mode and adapter registry;
- adapt ActionDraft and AuditLog first;
- adapt Master Data reads;
- adapt Procurement and Inventory reads;
- then consider ORM/database implementation in a later phase.
