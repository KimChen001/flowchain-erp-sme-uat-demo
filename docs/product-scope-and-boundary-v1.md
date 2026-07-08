# FlowChain Product Scope and Boundary

This document defines the current product scope and boundaries for FlowChain. It is intended for product communication, internal acceptance, and development alignment.

## Current Scope

FlowChain 当前覆盖：

- 每日工作台。
- AI 建议。
- AI 助手。
- 销售需求到库存和采购影响解释。
- 库存风险。
- PR / RFQ / PO 证据。
- 收货 / GRN 证据。
- 发票差异 / 财务协同可见性。
- 供应商状态。
- 数据质量。
- 数据接入与质量。
- 角色权限可见性。
- 业务审计历史。
- 工作区边界。
- 人工复核草稿。

## Current Product Behavior

- 基于当前工作区数据展示今日行动、来源证据、数据限制和业务影响。
- 通过核心业务链连接销售需求、SKU 库存风险、采购、收货、发票和财务协同。
- 通过 AI 助手回答跨模块业务问题。
- 通过草稿预览和人工复核承接建议动作。
- 通过角色权限、业务审计和工作区边界说明可见范围与复核边界。

## Current Non-scope

FlowChain 当前不覆盖 / 不做：

- 不覆盖：完整财务总账。
- 不覆盖：真实付款。
- 不覆盖：正式审批流。
- 不做：自动下单。
- 不做：自动库存过账。
- 不做：自动发票过账。
- 不覆盖：外部供应商门户正式外发。
- 不覆盖：完整 CRM。
- 不覆盖：HR。
- 不覆盖：税务申报。
- 不覆盖：银行支付。
- 不做：主数据自动变更。

## Operating Boundaries

- 不自动审批。
- 不自动下单。
- 不提交收货。
- 不写库存。
- 不写财务凭证。
- 不处理资金。
- 不修改供应商主数据。
- 不外发供应商邮件。
- 不覆盖当前工作区数据。
- 不形成正式业务处理。

## Product Discipline

每日工作台保持入口型，核心业务链保持证据链路，AI 建议和 AI 助手保持证据优先，行动草稿保持 review-first。任何后续扩展都应先说明来源证据、数据限制、人工复核边界和是否仍属于当前轻量进销存、采购、库存和供应商协同系统范围。
