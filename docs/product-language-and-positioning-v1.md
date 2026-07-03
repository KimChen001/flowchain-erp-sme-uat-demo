# Product Language and Positioning v1

## Product Positioning

中文：

FlowChain 是面向中小企业的 AI 进销存与供应链协同工作台。

English:

FlowChain is an AI-assisted inventory, sales-demand, procurement, and supplier operations platform for SMEs.

## Visible UI Language Policy

- 面向中国 SME 用户的 UI 文案默认使用简体中文。
- 技术枚举、内部 action type、repository adapter、draft type 不得直接暴露给用户。
- 可以保留行业缩写，但要有中文解释：
  - SKU = 物料编码 / 商品编码
  - MRP = 物料需求计划
  - RFQ = 询价 / 报价请求
  - PO = 采购订单
  - PR = 采购申请
  - GRN = 收货单 / 到货验收单
- 用户可见页面避免出现：
  - Demo
  - UAT
  - 演示数据
  - 示例数据
  - 样例数据
  - mock
  - fake
  - sample data
  - demo data
  - UAT data
  - fallback
  - ActionDraft
  - purchase_request_draft
  - supplier_followup_draft
  - provider fallback
  - tool_result
  - response_card
  - entityType
  - documentType
  - raw JSON

## Recommended Chinese Labels

| Internal / English term | Recommended Chinese label |
| --- | --- |
| ActionDraft | 操作草稿 / 待复核草稿 |
| purchase_request_draft | 采购申请草稿 |
| rfq_draft | 询价草稿 |
| supplier_followup_draft | 供应商跟进草稿 |
| review-first | 先复核后确认 |
| previewOnly | 仅预览 |
| user-confirmed action | 用户确认动作 |
| Sales Demand | 销售需求 |
| Customer Order | 客户订单 |
| Inventory Allocation | 库存分配 |
| Evidence Link | 证据链接 |
| Control Tower | 运营控制台 / 今日风险工作台 |
| Exception Case | 异常工单 |
| Finance Collaboration | 财务协同 |

## Data Wording Replacements

| Forbidden visible wording | Recommended visible wording |
| --- | --- |
| Demo / UAT | 当前版本 / 当前工作区 |
| 演示数据 / 示例数据 / 样例数据 | 当前工作区数据 / 当前业务数据 |
| demo data / sample data / UAT data | current workspace data / current business records |
| fallback | 当前数据范围 / 当前配置 |
| mock / fake | 占位配置 / 未启用配置 |
| 当前使用演示客户订单 | 当前页面基于工作区内的客户订单、库存、采购和供应商记录识别交付风险 |
| 由于这是演示数据 | 当前工作区缺少完整历史履约或库存分配记录，因此建议人工复核 |

## Technical Naming Boundary

- 源码、测试、常量和历史脚本中可能保留技术兼容命名；这些命名不得直接进入用户可见页面、AI 回答或产品说明。
- 需要描述默认只读记录时，使用“当前工作区记录”“当前业务记录”“当前库存与采购记录”“当前客户订单与库存记录”。
- 销售需求页面和 AI 回答不得暗示会自动确认客户订单、自动出库、自动通知客户、生成发票、收款或处理税务。

## Scope Rules

- 要做轻量销售需求 / 客户订单，不做完整 CRM。
- 要做库存可用量、预留量、在途量、缺口解释，不做复杂 WMS。
- 要做财务协同异常可见，不做完整总账、付款、税务。
- 要做钉钉/企微通知草稿与待办入口，不默认真实外发。

## UI Copy Examples

Bad:

“补货和释放动作只会打开 ActionDraft purchase_request_draft 预览。”

Good:

“系统只会生成采购申请草稿，需人工复核后才能继续处理，不会自动创建采购订单。”

Bad:

“Forecast/MRP 使用演示商品主数据。”

Good:

“当前物料需求计划基于工作区内的商品、库存、采购、销售需求与供应商记录生成只读计划证据，仅用于人工审阅采购建议。”
