# Product Language and Positioning v1

## Product Positioning

中文：

FlowChain 是面向中小企业的轻量进销存、采购、库存和供应商协同系统。

FlowChain 借鉴传统中小企业进销存系统的对象骨架，包括基础资料、采购、销售需求、库存、结算可见性、报表和系统管理，但不做完整 ERP 替代。产品差异化在 AI 证据链、交付风险分析、库存可承诺量、可复核动作草稿和数据限制说明。

English:

FlowChain is a lightweight inventory, purchasing, and supplier collaboration system for SMEs.

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
- 用户可见页面避免出现开发环境、调试、底层技术枚举、供应商调用或数据夹具语境；这些内容应转换为当前工作区数据、来源证据、业务记录、复核优先和草稿预览语境。

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
| Available to Promise / ATP | 可承诺量 |
| On-hand inventory | 实物库存 |
| Reserved inventory | 已预留库存 |
| Incoming supply | 在途采购 |
| Demand-supply gap | 供需缺口 |
| Projected available | 预计可用量 |
| Reservation Preview | 预留建议 / 预留影响预览 |
| Collaboration Notification Draft | 内部通知草稿 |
| Evidence Link | 证据链接 |
| Evidence Graph | 证据图谱 / 跨模块证据链 |
| Related Records | 相关业务记录 |
| Primary Evidence Path | 主证据链路 |
| Upstream / Downstream Impact | 上游 / 下游影响 |
| Delivery Impact | 交付影响 |
| Data Limitation | 数据限制 / 不确定性 |
| Control Tower | 运营控制台 / 今日风险工作台 |
| Exception Case | 异常工单 |
| Finance Collaboration | 财务协同 |
| Master Data | 基础资料 |
| Data Management | 数据接入与质量 |
| Reports Center | 报表与分析 |
| Supplier Performance + Risk | 供应商绩效与风险 |
| Workbench / Dashboard / Cockpit | 工作台 / 运营看板 / 今日风险工作台 |

## Data Wording Replacements

| Avoided visible wording pattern | Recommended visible wording |
| --- | --- |
| 开发环境或验收阶段标签 | 当前版本 / 当前工作区 |
| 数据夹具或数据集标签 | 当前工作区数据 / 当前业务数据 |
| 调试兜底标签 | 当前数据范围 / 当前配置 |
| 临时配置标签 | 占位配置 / 未启用配置 |
| 将客户订单称为非正式数据 | 当前页面基于工作区内的客户订单、库存、采购和供应商记录识别交付风险 |
| 将数据限制归因于非正式数据 | 当前工作区缺少完整历史履约或库存分配记录，因此建议人工复核 |

## Technical Naming Boundary

- 源码、测试、常量和历史脚本中可能保留技术兼容命名；这些命名不得直接进入用户可见页面、AI 回答或产品说明。
- 需要描述默认只读记录时，使用“当前工作区记录”“当前业务记录”“当前库存与采购记录”“当前客户订单与库存记录”。
- 销售需求页面和 AI 回答不得暗示会自动确认客户订单、自动出库、自动通知客户、生成发票、收款或处理税务。

## Scope Rules

- 要做轻量销售需求 / 客户订单，不做完整 CRM。
- 销售需求当前聚焦客户订单、交付风险、订单证据链；未来可扩展销售总览、库存预留建议、供需缺口、客户沟通草稿和订单导入，但不要新增空菜单。
- 要做库存可用量、预留量、在途量、缺口解释，不做复杂 WMS。
- 要做财务协同异常可见，不做完整总账、付款、税务。
- 要做通用内部通知草稿与待办入口，后续可适配企业微信、钉钉、飞书、Email、Slack 或 Microsoft Teams，不默认真实外发。
- 当前不提供供应商门户能力，不显示外部供应商账号、供应商登录、供应商自助维护资料、供应商在线确认订单或供应商在线提交发票。
- 基础资料只维护业务对象基础资料，不做报表分析。
- 数据接入与质量只做导入、映射、校验、导入历史、质量检查、缺失项和模板，不做业务审批。
- 报表与分析只做汇总、趋势、分析和导出，不编辑业务数据。

## Workbench Discipline

- 工作台 / dashboard / cockpit 只做汇总数字、pending 数量、风险数量、Top priority list、跳转入口、草稿预览入口。
- 工作台不做直接批准、直接拒绝、直接签收、直接过账、直接下发、直接发外部通知或直接创建真实业务单据。
- 工作台按钮文案优先使用：查看详情、进入复核、查看证据链、生成草稿预览、生成内部通知草稿。
- 详细复核动作必须嵌入对应业务对象详情页、详情抽屉或复核面板中，不新增独立复核中心。
- PR 的批准 / 拒绝在采购申请详情中完成；RFQ 的授标复核在 RFQ 详情中完成；PO 的变更复核在采购订单详情中完成；GRN 的异常复核在收货单详情中完成；客户订单预留建议的复核在客户订单详情中完成；供应商准入复核在供应商详情或准入详情中完成；发票差异复核在发票协同详情中完成；异常工单复核在异常工单详情中完成。
- 拒绝、要求修改和取消必须填写原因。批准可以没有原因，但可以填写备注；延期建议填写负责人或后续日期。

## UI Copy Examples

Bad:

“补货和释放动作只会打开 ActionDraft purchase_request_draft 预览。”

Good:

“系统只会生成采购申请草稿，需人工复核后才能继续处理，不会自动创建采购订单。”

Bad:

“物料需求计划使用非正式商品主数据。”

Good:

“当前物料需求计划基于工作区内的商品、库存、采购、销售需求与供应商记录生成只读计划证据，仅用于人工审阅采购建议。”

Bad:

“订单确认后自动锁库。”

Good:

“系统生成库存预留建议和预留影响预览，需人工复核后才能继续处理，不会自动锁定库存。”

Bad:

“当前使用非正式库存数据计算 ATP。”

Good:

“当前可承诺量基于工作区内的库存、销售需求和在途采购记录计算。”

Bad:

“发送钉钉通知。”

Good:

“生成内部通知草稿，后续可适配企业微信、钉钉、飞书、Email、Slack 或 Microsoft Teams；系统不会自动外发。”

Bad:

“系统已下发 WMS 并更新库存。”

Good:

“系统仅生成库存影响预览，不会自动下发 WMS，也不会自动更新库存余额。”

Bad:

“自动完成调拨签收。”

Good:

“系统生成调拨签收影响预览，需人工复核后才能进入受控流程。”

Bad:

“显示 raw entityType/documentType 关系图。”

Good:

“显示客户订单、SKU、库存可用量、采购订单、供应商和收货单之间的业务证据链。”
