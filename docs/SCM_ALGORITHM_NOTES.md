# FlowChain 算法路线笔记

Last updated: 2026-06-12

## AI 解释与置信度

- 当前已实现分维度规则校准置信度：预测、库存/MRP、供应商、外部市场分别计算 score/level，再按用户问题意图加权生成总置信度。
- 下一步应把维度置信度写入 PR/PO 审批快照，并补充 rolling backtest / conformal prediction 的真实覆盖率校准。
- 预测类问题优先使用 rolling backtest、MAPE/WMAPE、tracking signal、prediction interval coverage。
- 采购/库存动作类问题应显示约束来源：MOQ、批量倍数、提前期、在途、已分配、安全库存、供应商产能。

## 可引入的开源算法

- Nixtla StatsForecast：适合批量 SKU 统计预测，包含 ARIMA/ETS/Theta 和 Croston 系列；Croston/SBA/TSB 可用于低频、间歇需求 SKU。
- MAPIE / conformal prediction：适合在小数据或非正态误差下做预测区间校准，输出可解释覆盖率。
- OR-Tools / MILP：适合后续做采购拆单、供应商产能、预算约束、运输约束下的优化。
- sktime / Darts：适合模型基准和概率预测实验，但生产接入要控制依赖体积和运行时。

## 供应链研究启发

- MIT CTL 方向强调供应链 AI 要建立在一致、可信、实时的数据基础上，而不是让模型独立做决策。
- EJOR 相关综述指出 forecasting 和 inventory control 不能割裂；预测结果必须继续转成 replenishment decision，评价也应看库存和服务水平结果。
- 对本项目而言，AI insight 不应只解释“预测值”，更要解释“为什么建议采购、为什么现在释放、为什么选择该供应商、哪些数据需要人工确认”。

## FlowChain 下一步落地顺序

1. 在预测页增加 rolling backtest coverage 和 conformal interval。
2. 对间歇需求 SKU 自动切换 Croston/SBA/TSB。
3. 将 forecast / inventory / supplier / external 四个置信度维度写入 PR/PO 审批说明。
4. 每条 AI 建议结构化输出 SKU、库存、缺口、金额、供应商、时间窗口和需要人工确认的数据字段。
5. 用 OR 优化供应商拆单：预算、产能、交期、风险和最小订单量共同约束。
