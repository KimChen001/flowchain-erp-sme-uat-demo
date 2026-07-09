# FlowChain ERP Transformation Roadmap v1

本文件是 FlowChain 升级为"ERP / 进销存协同平台"的总体改造规划。
配套评估结论见对话记录;本文件只记录方向、阶段、依赖与红线,不含逐行实现。

## 指导原则

1. 名实相符优先:文案说"能提交",底层就必须真能写。不先改文案再补能力。
2. 进销存单据流是主心智:采购单→入库单→发票→付款 / 销售单→出库单→收款。
3. AI / 草稿是加速器不是主角:护栏保留,入口收敛,文案降调。
4. 每个 PR 独立可交付、测试全绿、可回滚。
5. 顺序 = 先立骨架(秩序)→ 再通血脉(写入)→ 再长肌肉(模型)→ 最后修表皮(打印/模板)。

## 现状关键事实(评估结论摘要)

- 信息架构已接近完整 ERP,采购侧单据闭环最完整(PO/GRN/发票/三单匹配/退货/对账)。
- `src/components/document/DocumentShell.tsx` 已是可复用单据模板底座,被 7 个模块采用。
- 销售侧从类型层缺席:`scm.ts` 无 `SalesOrder/Customer/Receivable` 一等类型,只有 `sales-demand` 只读读模型。
- 库存是数量账不是金额账:`InventoryMovement` 无成本/计价字段。
- 财务只有应付,无应收,是单边闭环。
- 写入机理:后端有真实写端点(如 `POST /api/purchase-orders` → `writeDb`);
  `demo` 模式 `writable=true` 但写 `data/scm-demo.json`;`user` 正式模式 `writable=false`(倒置)。
  前端 UI 以草稿预览为主,不调用真实写端点。
- 测试 `server/domain/product-terminology-governance.test.mjs` 硬锁旧定位文案("轻量/lightweight")。

## 阶段总览

- 阶段 0 定位与文案翻转(独立,先做)
- 阶段 1 信息架构收敛(秩序线)
- 阶段 2 草稿/审批中心合并(秩序线)
- 阶段 3 打通写入主线(能力线,ERP 分水岭)
- 阶段 4 补齐销售侧模型
- 阶段 5 库存计价 + 应收闭环
- 阶段 6 单据模板 + 打印预览 + 字段配置

依赖:0/1/2 可先行(低风险);3 是分水岭;4 依赖 3;5 依赖 4;6 收尾。

## 红线(全程不变)

- 不碰 `data/scm-demo.json`(正式写入走 Prisma,demo JSON 仅只读种子)。
- 不碰 `src/design-preview/`。
- 不 `git add .`、不 push,除非明确要求。
- 每个改文案/导航的 PR 连带更新对应 node test + browser spec,保持 `npm test` + `typecheck` 全绿。
- AI 安全护栏文案(review-first / 人工复核)保留,只降调不删除。

## 建议节奏

- 第 1 波(秩序):阶段 0 + 1 + 2。
- 第 2 波(写入):阶段 3。
- 第 3 波(模型):阶段 4 + 5。
- 第 4 波(体验):阶段 6。
