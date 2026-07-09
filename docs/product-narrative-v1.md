# Product Narrative v1

## Positioning

FlowChain is an ERP and inventory-purchase-sales (进销存) collaboration platform for SMEs.

FlowChain 是面向中小企业的 ERP 进销存协同平台。系统以工作区数据为基础，统一支撑采购、收货、库存、销售需求、供应商协同与发票匹配，并在关键动作执行前提供证据链和人工复核。

FlowChain concentrates on the inventory-purchase-sales (进销存) ERP core plus supplier collaboration and finance matching; general ledger, HR/payroll, CRM, bank/payment execution, and tax filing are handled by integrating specialist systems rather than rebuilt inside FlowChain.

## Target Users

FlowChain is designed for SME operations teams where planners, buyers, warehouse staff, supplier managers, sales-demand coordinators, and finance collaborators need a shared operating picture on a right-sized ERP built for their scale.

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
- Sales Demand connects customer order demand to inventory availability and procurement evidence.
- Inventory Allocation / Availability will explain available, reserved, in-transit, and shortage quantities.
- Demand-to-Procurement Links connect sales demand, shortages, purchase requests, RFQs, purchase orders, receiving, and invoice exceptions.
- Procurement/P2P visibility connects purchase requests, RFQs, purchase orders, receiving, invoices, and three-way match signals.
- Supplier/SRM context links supplier master data, performance, RFQ participation, PO exposure, invoice issues, and inventory risk.
- AI Assistant answers with deterministic read-model evidence before any provider path.
- Draft-first actions prepare PR, RFQ, supplier follow-up, and exception case drafts for user review instead of executing autonomous writes.

## Current Product State

FlowChain 已形成采购、库存、销售需求、供应商协同与发票匹配的进销存业务闭环。当前状态服务于产品沟通、内部验收和后续开发对齐。

当前核心入口包括今日行动、AI 建议、AI 助手、核心业务链、数据接入与质量、角色权限、业务审计、工作区边界和人工复核草稿。

当前产品边界是证据解释、草稿预览和人工复核。系统不自动审批、不自动下单、不提交收货、不外发、不写库存、不写财务凭证、不处理资金、不修改供应商主数据、不覆盖当前工作区数据、不形成正式业务处理。

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
