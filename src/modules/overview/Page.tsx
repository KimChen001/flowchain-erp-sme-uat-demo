import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  Package,
  PackageCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { fmt } from "../../lib/format";
import { A, Card, Chip, KpiCard, SectionHeader } from "../../components/ui";
import { inventoryItems, purchaseOrders, receivingDocs, RFQS, PORTAL_SUPPLIERS } from "../../data/demo-data";
import { inventoryPlan } from "../../domain/inventory/planning";
import type { PurchaseOrder, PurchaseRequest, ReceivingDoc, RfqRecord } from "../../types/scm";

type SupplierPerformance = typeof PORTAL_SUPPLIERS[number] & {
  category?: string;
  exceptions?: number;
  rejectRate?: number;
  score?: number;
  risk?: string;
  lastIssue?: string;
};

type OverviewPanelProps = {
  onNavigate: (moduleId: string) => void;
  onPrepareReplenishmentRequest: (sku: string) => void;
  onOpenAi: () => void;
};

type ActionRow = {
  priority: "高" | "中" | "低";
  title: string;
  object: string;
  evidence: string;
  module: string;
  moduleId: string;
  cta: string;
  onClick?: () => void;
};

function priorityStyle(priority: ActionRow["priority"]) {
  if (priority === "高") return { color: A.red, bg: "#fff1f0" };
  if (priority === "中") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.green, bg: "#f0faf4" };
}

function overviewReplenishmentActions() {
  return inventoryItems
    .filter((item) => item.status !== "正常")
    .map((item) => {
      const plan = inventoryPlan(item);
      return {
        ...item,
        plan,
        shortage: Math.max(0, item.min - item.qty),
      };
    })
    .sort((a, b) => {
      const score = (item: { status: string; plan: { amount: number }; shortage: number }) =>
        (item.status === "不足" ? 1_000_000 : 0) + item.plan.amount + item.shortage * 100;
      return score(b) - score(a);
    });
}

export default function OverviewPanel({ onNavigate, onPrepareReplenishmentRequest, onOpenAi }: OverviewPanelProps) {
  const [dashboardOrders, setDashboardOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [dashboardRequests, setDashboardRequests] = useState<PurchaseRequest[]>([]);
  const [dashboardRfqs, setDashboardRfqs] = useState<RfqRecord[]>(RFQS);
  const [dashboardReceiving, setDashboardReceiving] = useState<ReceivingDoc[]>(receivingDocs);
  const [dashboardSuppliers, setDashboardSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);

  useEffect(() => {
    let alive = true;
    apiJson<PurchaseOrder[]>("/api/purchase-orders").then((data) => { if (alive) setDashboardOrders(data); }).catch(() => {});
    apiJson<PurchaseRequest[]>("/api/purchase-requests").then((data) => { if (alive) setDashboardRequests(data); }).catch(() => {});
    apiJson<RfqRecord[]>("/api/rfqs").then((data) => { if (alive) setDashboardRfqs(data); }).catch(() => {});
    apiJson<ReceivingDoc[]>("/api/receiving-docs").then((data) => { if (alive) setDashboardReceiving(data); }).catch(() => {});
    apiJson<SupplierPerformance[]>("/api/supplier-performance").then((data) => { if (alive) setDashboardSuppliers(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const inventoryRiskItems = useMemo(() => overviewReplenishmentActions(), []);
  const pendingRequests = dashboardRequests.filter((item) => item.status === "待审批");
  const highPriorityRequests = pendingRequests.filter((item) => item.priority === "高");
  const pendingOrders = dashboardOrders.filter((item) => item.status === "待审批");
  const receivingRisks = dashboardReceiving.filter((item) => item.status === "待收货" || item.status === "质检中" || item.status === "异常处理");
  const openRfqs = dashboardRfqs.filter((item) => item.status === "进行中" || item.status === "比价中");
  const supplierRisks = dashboardSuppliers.filter((item) => item.flag === "整改" || Number(item.rejectRate || 0) > 5 || Number(item.exceptions || 0) > 0);
  const mrpExceptions = inventoryRiskItems.filter((item) => item.plan.suggestedQty > 0).length;
  const openPrValue = pendingRequests.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const openPoValue = dashboardOrders
    .filter((item) => !["已完成", "已取消", "已驳回"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const topRiskSku = inventoryRiskItems[0];
  const actionRows: ActionRow[] = [
    ...highPriorityRequests.slice(0, 2).map((item) => ({
      priority: "高" as const,
      title: "审批高优先级采购申请",
      object: item.pr,
      evidence: `${item.sourceSku || item.sourceName} · ${fmt(Number(item.amount || 0))} · ${item.reason || "等待审批"}`,
      module: "采购申请",
      moduleId: "purchaseRequests",
      cta: "打开 PR",
    })),
    ...(topRiskSku ? [{
      priority: "高" as const,
      title: "释放 MRP planned order",
      object: topRiskSku.sku,
      evidence: `覆盖 ${topRiskSku.plan.daysCover} 天 · 建议 ${topRiskSku.plan.suggestedQty.toLocaleString()} ${topRiskSku.plan.unit} · ${fmt(topRiskSku.plan.amount)}`,
      module: "高级计划",
      moduleId: "forecast",
      cta: "查看计划",
    }] : []),
    ...receivingRisks.slice(0, 1).map((item) => ({
      priority: item.status === "异常处理" ? "高" as const : "中" as const,
      title: "跟进待收货 GRN",
      object: item.grn,
      evidence: `${item.supplier} · ${item.status} · PO ${item.po}`,
      module: "收货",
      moduleId: "receiving",
      cta: "处理 GRN",
    })),
    ...openRfqs.slice(0, 1).map((item) => ({
      priority: "中" as const,
      title: "复核 RFQ 报价差异",
      object: item.id,
      evidence: `${item.title} · 已报价 ${item.quoted}/${item.suppliers} · 最优 ${item.bestSupplier}`,
      module: "供应商报价",
      moduleId: "rfq",
      cta: "查看 RFQ",
    })),
    ...inventoryRiskItems.slice(1, 3).map((item) => ({
      priority: item.status === "不足" ? "高" as const : "中" as const,
      title: "处理库存短缺 SKU",
      object: item.sku,
      evidence: `${item.name} · 当前 ${item.qty.toLocaleString()} / 安全 ${item.min.toLocaleString()} · ROP ${item.plan.reorderPoint}`,
      module: "库存",
      moduleId: "inventory",
      cta: "补货",
      onClick: () => onPrepareReplenishmentRequest(item.sku),
    })),
    ...supplierRisks.slice(0, 1).map((item) => ({
      priority: "中" as const,
      title: "复核供应商异常",
      object: item.name,
      evidence: `${item.flag || "需复核"} · 准时率 ${Number(item.onTime || 0).toFixed(1)}% · 质量 ${Number(item.quality || 0).toFixed(1)}%`,
      module: "供应商与绩效",
      moduleId: "procurement",
      cta: "查看供应商",
    })),
  ].slice(0, 8);

  const risks = [
    {
      level: inventoryRiskItems.some((item) => item.status === "不足") ? "高" : "中",
      object: topRiskSku?.sku || "库存池",
      title: "库存短缺",
      evidence: topRiskSku ? `${topRiskSku.name} 覆盖 ${topRiskSku.plan.daysCover} 天，低于提前期 ${topRiskSku.plan.leadTimeDays} 天` : "当前未识别短缺 SKU",
      next: "检查 MRP 建议量并准备 PR",
      moduleId: "inventory",
    },
    {
      level: supplierRisks.length ? "中" : "低",
      object: supplierRisks[0]?.name || "供应商池",
      title: "供应商延迟 / 质量",
      evidence: supplierRisks[0] ? `${supplierRisks[0].flag} · 响应 ${Number(supplierRisks[0].resp || 0).toFixed(0)} · 质量 ${Number(supplierRisks[0].quality || 0).toFixed(1)}%` : "关键供应商绩效稳定",
      next: "复核供应商绩效和备选供应商",
      moduleId: "procurement",
    },
    {
      level: "中",
      object: "SKU-00412",
      title: "预测偏差",
      evidence: "高价值电气件近期需求波动，建议检查 Tracking Signal 与服务水平",
      next: "打开高级计划查看模型依据",
      moduleId: "forecast",
    },
    {
      level: openRfqs.length ? "中" : "低",
      object: openRfqs[0]?.id || "RFQ",
      title: "价格异常",
      evidence: openRfqs[0] ? `${openRfqs[0].title} 仍在比价，最佳报价 ${openRfqs[0].bestPrice}` : "暂无未决报价风险",
      next: "复核报价差异并锁定供应商",
      moduleId: "rfq",
    },
    {
      level: "低",
      object: "LOT-260506-B12",
      title: "近效期 / 冻结库存",
      evidence: "密封圈 NBR-70 近效期，步进电机驱动板存在冻结批次",
      next: "按 FEFO 或 QA 复检处理",
      moduleId: "inventory",
    },
  ] as const;

  const kpis = [
    { label: "今日待办", value: String(actionRows.length), sub: "按优先级排序", icon: ClipboardList, color: A.blue },
    { label: "高风险事项", value: String(actionRows.filter((item) => item.priority === "高").length), sub: "需今日处理", icon: AlertTriangle, color: A.red },
    { label: "待审批 PR", value: String(pendingRequests.length), sub: fmt(openPrValue), icon: FileCheck2, color: A.orange },
    { label: "待收货 GRN", value: String(receivingRisks.length), sub: "签收/质检/异常", icon: PackageCheck, color: A.teal },
    { label: "MRP 例外", value: String(mrpExceptions), sub: "来自库存计划", icon: TrendingUp, color: A.purple },
    { label: "库存风险 SKU", value: String(inventoryRiskItems.length), sub: topRiskSku?.sku || "稳定", icon: Package, color: A.green },
  ];

  const pulse = [
    { label: "OTIF", value: "96.2%", note: "本月交付", color: A.green },
    { label: "Inventory Turnover", value: "8.4x", note: "样本加权", color: A.blue },
    { label: "Forecast Accuracy", value: "92.1%", note: "MAPE 7.9%", color: A.purple },
    { label: "Purchase Cycle", value: "6.4d", note: "PR → PO", color: A.orange },
    { label: "Supplier Score", value: "88", note: "综合评分", color: A.teal },
    { label: "Open PR Value", value: fmt(openPrValue), note: "待审批", color: A.red },
    { label: "Open PO Value", value: fmt(openPoValue), note: "未关闭", color: A.gray1 },
  ];

  const quickLinks = [
    { label: "采购申请", id: "purchaseRequests" },
    { label: "采购订单", id: "purchasing" },
    { label: "库存", id: "inventory" },
    { label: "高级计划", id: "forecast" },
    { label: "报表中心", id: "reports" },
    { label: "导入中心", id: "imports" },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>今日运营驾驶舱</h1>
              <Chip label="UAT Demo" color={A.blue} bg="#f0f6ff" />
              <Chip label="Sample Data" color={A.gray1} bg={A.gray6} />
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: A.green, background: "#f0faf4" }}>
                Last updated: 今日
              </span>
            </div>
            <p className="text-sm" style={{ color: A.sub }}>今日重点动作、运营风险、核心 KPI 与 AI 建议集中在一个工作台。</p>
          </div>
          <div className="flex items-center gap-2">
            {quickLinks.map((link) => (
              <button key={link.id} onClick={() => onNavigate(link.id)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-90"
                style={{ color: A.gray1, background: A.gray6 }}>
                {link.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-6 gap-2">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} sub={kpi.sub} icon={kpi.icon} color={kpi.color} />
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: A.label }}>今日关键动作</h2>
              <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>最多展示 8 条，先处理影响交付、现金和供应连续性的事项。</p>
            </div>
            <Chip label={`${actionRows.length} actions`} color={A.blue} bg="#f0f6ff" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["优先级", "动作", "对象", "依据", "模块", "下一步"].map((header) => (
                    <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actionRows.map((row, index) => {
                  const style = priorityStyle(row.priority);
                  return (
                    <tr key={`${row.title}-${row.object}`} className="hover:bg-blue-50/40 transition-colors"
                      style={{ borderBottom: index < actionRows.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                      <td className="px-4 py-3"><Chip label={row.priority} color={style.color} bg={style.bg} /></td>
                      <td className="px-4 py-3 font-semibold" style={{ color: A.label }}>{row.title}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: A.blue }}>{row.object}</td>
                      <td className="px-4 py-3 min-w-[260px]" style={{ color: A.sub }}>{row.evidence}</td>
                      <td className="px-4 py-3" style={{ color: A.gray1 }}>{row.module}</td>
                      <td className="px-4 py-3">
                        <button onClick={row.onClick || (() => onNavigate(row.moduleId))}
                          className="text-[11px] px-2.5 py-1 rounded-md font-medium"
                          style={{ background: style.bg, color: style.color }}>
                          {row.cta}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionHeader title="运营风险 Top Risks" />
            <div className="space-y-2">
              {risks.map((risk) => {
                const style = priorityStyle(risk.level as ActionRow["priority"]);
                return (
                  <button key={risk.title} onClick={() => onNavigate(risk.moduleId)}
                    className="w-full text-left rounded-xl p-3 transition-colors hover:bg-blue-50/60"
                    style={{ background: A.gray6 }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold" style={{ color: A.label }}>{risk.title}</div>
                      <Chip label={risk.level} color={style.color} bg={style.bg} />
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: A.blue }}>{risk.object}</div>
                    <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{risk.evidence}</div>
                    <div className="text-[10px] mt-2 font-medium" style={{ color: style.color }}>{risk.next}</div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-4">
            <SectionHeader title="AI Decision Brief"
              right={<button onClick={onOpenAi} className="text-[11px] px-2 py-1 rounded-md font-medium" style={{ background: "#f0f6ff", color: A.blue }}>打开 AI</button>} />
            <div className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: A.blue }}>
                <Sparkles size={13} /> Recommendation
              </div>
              <div className="text-sm font-semibold mt-2" style={{ color: A.label }}>
                先处理 {topRiskSku?.sku || "库存风险"} 的补货和高优先级 PR 审批
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                <div className="rounded-lg p-2" style={{ background: A.white }}>
                  <div style={{ color: A.gray2 }}>Business impact</div>
                  <div className="font-semibold mt-0.5" style={{ color: A.red }}>{fmt((topRiskSku?.plan.amount || 0) + openPrValue)}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: A.white }}>
                  <div style={{ color: A.gray2 }}>Confidence</div>
                  <div className="font-semibold mt-0.5" style={{ color: A.green }}>86% · 中高</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] leading-5" style={{ color: A.sub }}>
                Evidence used: 库存覆盖天数、ROP、待审批 PR 金额、GRN 状态、供应商绩效样本。
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => onNavigate("forecast")} className="flex-1 text-[11px] px-2 py-1.5 rounded-md font-medium text-white" style={{ background: A.blue }}>
                  查看证据
                </button>
                <button onClick={() => onNavigate("purchaseRequests")} className="flex-1 text-[11px] px-2 py-1.5 rounded-md font-medium" style={{ background: A.white, color: A.label }}>
                  打开模块
                </button>
              </div>
            </div>
            <div className="text-[10px] leading-4 mt-2" style={{ color: A.gray2 }}>
              Deterministic demo logic only. 不会自动创建 PR/RFQ/PO 或修改库存。
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionHeader title="核心运营脉搏" />
        <div className="grid grid-cols-7 gap-2">
          {pulse.map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="text-[10px] truncate" style={{ color: A.gray2 }}>{item.label}</div>
              <div className="text-base font-semibold mt-1 truncate" style={{ color: item.color }}>{item.value}</div>
              <div className="text-[10px] mt-0.5 truncate" style={{ color: A.sub }}>{item.note}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
