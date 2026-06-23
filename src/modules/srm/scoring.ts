import { A } from "../../components/ui";
import type { SupplierSrmRow } from "../../domain/srm/helpers";

export const scoreDimensions = [
  {
    id: "compliance",
    title: "合规认证",
    weight: 20,
    owner: "SRM / 合规负责人",
    refresh: "证书类每日检查到期日并触发衰减",
    source: "供应商证照、工商状态、环保资质、海关 AEO",
    items: [
      { name: "ISO 9001", weight: 30, rule: "> 6 月 100；3-6 月 70；< 3 月 40；已过期 0" },
      { name: "营业执照", weight: 20, rule: "工商注册状态有效 100；注销或吊销 0" },
      { name: "环保资质", weight: 25, rule: "等级 A/B/C 映射 90/70/50，并叠加到期衰减" },
      { name: "海关 AEO", weight: 25, rule: "高级 100；一般 60；申请中 30；无 0" },
    ],
  },
  {
    id: "delivery",
    title: "交货准时",
    weight: 20,
    owner: "采购运营",
    refresh: "可按 GRN 入库、订单关闭等业务事件刷新评分依据",
    source: "PO 承诺日期、GRN 实际到货日期、紧急订单标记",
    items: [
      { name: "准时交货率", weight: 40, rule: "近 90 天准时行数 / 总行数 * 100" },
      { name: "平均延迟天数", weight: 25, rule: "0 天 100；1 天 90；3 天 60；7 天以上 20，区间线性插值" },
      { name: "紧急响应能力", weight: 20, rule: "紧急订单准时率单独统计" },
      { name: "短交期能力", weight: 15, rule: "交货周期低于行业均值时加分，高于均值时衰减" },
    ],
  },
  {
    id: "performance",
    title: "综合绩效",
    weight: 20,
    owner: "采购负责人",
    refresh: "PO 关闭、质检完成或客诉关闭后更新",
    source: "PO 状态、质检单、RFx / PO 回复时间、客诉工单",
    items: [
      { name: "订单完成率", weight: 30, rule: "已关闭订单 / 总下单数 * 100" },
      { name: "质量合格率", weight: 35, rule: "质检通过数 / 总质检数，95% 以上映射为 100" },
      { name: "响应速度", weight: 20, rule: "24h 内 100；48h 80；72h 60；超时 30" },
      { name: "客诉处理", weight: 15, rule: "无客诉 100；有客诉按关闭率和关闭时长扣分" },
    ],
  },
  {
    id: "rfx",
    title: "RFx 参与",
    weight: 20,
    owner: "寻源负责人",
    refresh: "每次 RFx 关闭后触发",
    source: "RFx 邀请、报价、授标记录、报价偏差",
    items: [
      { name: "报价响应率", weight: 30, rule: "实际报价数 / 邀请数 * 100" },
      { name: "报价质量", weight: 30, rule: "报价与最终成交价偏差 <5% 为 100；5-15% 为 70；>15% 为 40" },
      { name: "参与频次", weight: 20, rule: "近 12 个月 RFx 参与次数按行业均值标准化" },
      { name: "中标率", weight: 20, rule: "中标次数 / 参与次数 * 100" },
    ],
  },
  {
    id: "risk",
    title: "风险评估",
    weight: 20,
    owner: "供应风险负责人",
    refresh: "随交付异常、采购集中度和规则复核更新评分依据",
    source: "采购额占比、地区风险表、交付延迟记录；后续可接入外部风险数据",
    items: [
      { name: "财务稳定性", weight: 30, rule: "外部风险数据可作为扩展输入并映射为评分" },
      { name: "交货延迟风险", weight: 35, rule: "延迟率越高分越低，与交货准时数据反向映射" },
      { name: "供应集中度", weight: 20, rule: "采购额占比 >50% 为 20；<20% 为 90" },
      { name: "地缘政治风险", weight: 15, rule: "按供应商注册地和人工维护地区风险系数表映射" },
    ],
  },
] as const;

export function scoreStyle(score: number) {
  if (score >= 85) return { label: "正常", color: A.green, bg: "#f0faf4" };
  if (score >= 65) return { label: "注意", color: A.orange, bg: "#fff8f0" };
  return { label: "需处理", color: A.red, bg: "#fff1f0" };
}

export function supplierScoreSnapshot(row: SupplierSrmRow) {
  const certificationScore = row.supplier.certificationStatus === "已认证"
    ? 92
    : row.supplier.certificationStatus === "待复核"
      ? 72
      : 48;
  const deliveryScore = Math.round(row.onTimeRate);
  const performanceScore = Math.round(row.qualityRate * 0.42 + row.responseScore * 0.28 + Math.min(row.rating * 20, 100) * 0.3);
  const rfxScore = Math.min(100, Math.round(58 + row.rfqCount * 10 + row.activeRfqCount * 6));
  const riskAssessmentScore = Math.max(30, 100 - row.riskScore + (row.reconciliationException ? -8 : 0));
  const dimensions = [
    { id: "compliance", label: "合规认证", score: certificationScore, evidence: row.supplier.certificationStatus },
    { id: "delivery", label: "交货准时", score: deliveryScore, evidence: `准时率 ${row.onTimeRate}%` },
    { id: "performance", label: "综合绩效", score: performanceScore, evidence: `质量 ${row.qualityRate}% · 响应 ${row.responseScore}` },
    { id: "rfx", label: "RFx 参与", score: rfxScore, evidence: `${row.rfqCount} 次参与 / ${row.activeRfqCount} 个开放` },
    { id: "risk", label: "风险评估", score: riskAssessmentScore, evidence: `${row.supplier.riskStatus}风险 · 对账${row.reconciliationException ? "需复核" : "稳定"}` },
  ];
  return {
    overall: Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length),
    dimensions,
  };
}

