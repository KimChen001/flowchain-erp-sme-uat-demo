# FlowChain Final Operating Readiness Checklist

This checklist records the current acceptance state for product communication and development alignment. It does not claim full commercial operating readiness.

| Area | Status | Evidence | Remaining boundary | Acceptance signal |
| --- | --- | --- | --- | --- |
| Daily Workbench readiness | Closed for current stage | 今日行动、PO 看板、库存管理、供应商状态、财务协同和核心业务链入口可见。 | 每日工作台保持入口型，不铺满全部主链明细。 | 首页可进入今日行动和核心业务链。 |
| AI Suggestions readiness | Closed for current stage | AI 建议显示结论、关键证据、业务影响、建议动作、数据限制和人工复核入口。 | AI 建议不形成正式业务处理。 | AI 建议详情可进入人工复核草稿。 |
| AI Assistant local evidence availability | Closed for current stage | AI 助手可回答今日重点、收货异常、库存项目、PO 优先级和核心业务链问题。 | AI 助手只基于当前工作区数据解释证据。 | 基础问题返回结构化回答，不显示不可用文案。 |
| Core Business Chain v1 readiness | Closed for current stage | 销售需求、SKU 库存风险、PR / PO、收货 / GRN、发票 / 财务协同和人工复核草稿可串联。 | 未找到对象时不假造关系，以数据限制说明。 | 核心业务链可查看主链证据并进入 AI 解释。 |
| Data Access & Quality readiness | Closed for current stage | 数据接入与质量展示来源证据、字段映射、数据限制和影响模块。 | 不自动修复，不自动覆盖当前工作区数据。 | 页面可查看数据限制并进入人工复核。 |
| Role / Audit / Workspace Boundary readiness | Closed for current stage | 角色权限、业务审计、工作区边界展示可见范围、业务历史、内部复核记录和边界。 | 不创建用户，不分配角色，不写配置，不导出正式报告。 | 三类治理页面均可进入并保持只读可见性。 |
| Review-first Action Draft readiness | Closed for current stage | ActionDraftReviewShell 显示草稿预览、来源证据、数据限制和人工复核边界。 | 不提交、不外发、不写库存、不写财务凭证、不处理资金、不修改供应商主数据。 | 可打开待复核草稿并查看边界说明。 |
| Safety Boundary readiness | Closed for current stage | 回答和草稿统一显示人工复核、草稿预览和不形成正式业务处理。 | 不自动审批、不自动下单、不提交收货。 | 安全边界测试通过。 |
| Product Terminology readiness | Closed for current stage | 产品口径保持轻量进销存、采购、库存和供应商协同系统。 | 不使用旧产品口径包装用户可见说明。 | 术语治理测试通过。 |
| Browser Regression readiness | Closed for current stage | AI 助手、核心业务链、数据接入与质量、角色权限、业务审计、工作区边界和草稿复核有浏览器验收覆盖。 | 不提交截图、追踪文件或测试产物。 | 指定浏览器验收和完整浏览器套件通过。 |
| Source Test readiness | Closed for current stage | 最终收口文档、AI 可用性、核心业务链、术语治理和运行时回答有源级测试覆盖。 | 不修改受保护数据文件。 | 源级测试和构建通过。 |

## Known limitations

- 当前版本不声明完整商业化运行能力。
- 当前版本不覆盖完整财务总账、真实付款、正式审批流、自动下单、自动库存过账、自动发票过账、外部供应商门户正式外发、完整 CRM、HR、税务申报或银行支付。
- 当前版本所有行动草稿均保持草稿预览和人工复核。
