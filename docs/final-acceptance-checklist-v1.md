# FlowChain Final Acceptance Checklist

This checklist is the final acceptance guide for the current productized stage. It validates current product behavior and boundaries without claiming full commercial operating readiness.

## Product Surfaces

- [ ] 首页可见今日行动。
- [ ] 首页可见 AI 建议。
- [ ] 首页可见 PO 看板。
- [ ] 首页可见库存管理。
- [ ] 首页可见供应商状态。
- [ ] 首页可见财务协同。
- [ ] 首页可见核心业务链。
- [ ] 数据接入与质量可见，并展示当前工作区数据、来源证据、字段映射和数据限制。
- [ ] 角色权限、业务审计、工作区边界可见。
- [ ] ActionDraftReviewShell 可打开，并展示草稿预览、人工复核和边界说明。

## AI Assistant Acceptance

- [ ] AI 助手可回答“今天最需要处理什么？”。
- [ ] AI 助手可回答“今天有哪些收货异常？”。
- [ ] AI 助手可回答“哪些库存项目需要关注？”。
- [ ] AI 助手可回答“这个 PO 为什么优先？”。
- [ ] AI 助手可回答“这条核心业务链有什么证据？”。
- [ ] AI 助手可回答“这条链路哪里证据不足？”。
- [ ] AI 助手可回答“打开这条链路的人工复核草稿。”。
- [ ] 每个回答包含结论、关键证据、业务影响、建议动作、可点击跳转、数据限制和人工复核边界。

## Core Chain Acceptance

- [ ] 核心业务链可下钻。
- [ ] 主链证据展示销售需求、SKU 库存风险、PR / PO、收货 / GRN、发票 / 财务协同。
- [ ] 证据不足时展示数据限制，不假造关系。
- [ ] 人工复核草稿可从链路问题进入。

## Safety and Language Acceptance

- [ ] 可见文本无旧产品口径。
- [ ] 可见文本无技术词。
- [ ] 可见文本无危险执行承诺。
- [ ] 明确不自动审批。
- [ ] 明确不自动下单。
- [ ] 明确不提交收货。
- [ ] 明确不写库存。
- [ ] 明确不写财务凭证。
- [ ] 明确不处理资金。
- [ ] 明确不修改供应商主数据。
- [ ] 明确不外发供应商邮件。
- [ ] 明确不覆盖当前工作区数据。
- [ ] 明确不形成正式业务处理。

## Regression Acceptance

- [ ] 完整测试通过。
- [ ] 浏览器验收通过。
- [ ] 构建通过。
- [ ] 保护文件未提交。
- [ ] 测试产物未提交。
