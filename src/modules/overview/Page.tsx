import React, { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertOctagon,
  AlertTriangle,
  ClipboardList,
  DollarSign,
  FileCheck2,
  FileSpreadsheet,
  Loader2,
  Package,
  PackageCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { fmt } from "../../lib/format";
import { A, AppleTooltip, Card, KpiCard, SectionHeader } from "../../components/ui";
import { AI_INSIGHTS } from "../ai-assistant/ai-insights";
import type { PurchaseOrder, PurchaseRequest, ReceivingDoc, RfqRecord } from "../../types/scm";
import { inventoryItems, purchaseOrders, receivingDocs, RFQS, PORTAL_SUPPLIERS, salesData } from "../../data/demo-data";
import { inventoryPlan } from "../../domain/inventory/planning";

type SupplierPerformance = typeof PORTAL_SUPPLIERS[number] & {
  category?: string;
  received?: number;
  passed?: number;
  failed?: number;
  exceptions?: number;
  rejectRate?: number;
  score?: number;
  risk?: string;
  lastIssue?: string;
};

type SopCycle = {
  id?: string;
  cycle: string;
  version: number;
  status: "草案" | "待审批" | "已发布" | "已驳回";
  demandPlan: {
    forecastVersions: number;
    totalMonthlyDemand: number;
    highRiskSku: number;
    source: string;
  };
  supplyPlan: {
    plannedQty: number;
    plannedAmount: number;
    exceptionCount: number;
    urgentCount: number;
    openPoAmount: number;
    pendingPrAmount: number;
  };
  financialConstraint: {
    budgetLimit: number;
    totalCommitment: number;
    constrainedAmount: number;
    budgetUsagePct: number;
    decision: string;
  };
  consensus: {
    recommendation: string;
    approvers: string[];
    decisions: { type: string; title: string; amount: number; action: string }[];
  };
  latestPublished?: SopCycle | null;
  approvers?: string[];
  approvedBy?: string;
  createdAt?: string;
};




function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    正常:   { color: A.green,  bg: "#f0faf4" },
    预警:   { color: A.orange, bg: "#fff8f0" },
    不足:   { color: A.red,    bg: "#fff1f0" },
    关注:   { color: A.orange, bg: "#fff8f0" },
    高风险: { color: A.red,    bg: "#fff1f0" },
    草稿:   { color: A.gray1,  bg: "#f2f2f7" },
    已确认: { color: A.blue,   bg: "#eff6ff" },
    拣货中: { color: A.orange, bg: "#fff8f0" },
    已发货: { color: A.purple, bg: "#faf3ff" },
    已交付: { color: A.green,  bg: "#f0faf4" },
    已关闭: { color: A.gray1,  bg: "#f2f2f7" },
    待审批: { color: A.orange, bg: "#fff8f0" },
    已审批: { color: A.blue,   bg: "#eff6ff" },
    已收货: { color: A.purple, bg: "#faf3ff" },
    已结案: { color: A.green,  bg: "#f0faf4" },
    生效中: { color: A.green,  bg: "#f0faf4" },
    待生效: { color: A.blue,   bg: "#eff6ff" },
    已停用: { color: A.gray1,  bg: "#f2f2f7" },
  };
  const s = map[status] ?? { color: A.gray1, bg: "#f2f2f7" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: s.color, background: s.bg }}>
      {status}
    </span>
  );
}

function overviewReplenishmentActions() {
  return inventoryItems
    .filter((item) => item.status !== "正常")
    .map((item) => {
      const plan = inventoryPlan(item);
      const shortage = Math.max(0, item.min - item.qty);
      return {
        ...item,
        shortage,
        suggestedQty: plan.suggestedQty,
        amount: plan.amount,
        supplier: plan.supplier,
        buyer: plan.buyer,
        action: plan.action,
        daysCover: plan.daysCover,
        reorderPoint: plan.reorderPoint,
      };
    })
    .sort((a, b) => {
      const score = (row: { status: string; amount: number; shortage: number }) =>
        (row.status === "不足" ? 100000000 : 0) + row.amount + row.shortage * 1000;
      return score(b) - score(a);
    });
}

type OperationsAction = {
  label: string;
  onClick: () => void;
  primary?: boolean;
};

function OperationsTaskCard({
  title,
  metric,
  subtitle,
  icon: Icon,
  color,
  roles,
  items,
  actions,
}: {
  title: string;
  metric: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties; className?: string }>;
  color: string;
  roles: string[];
  items: string[];
  actions: OperationsAction[];
}) {
  return (
    <Card className="p-4 flex flex-col min-h-[220px]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>
            <Icon size={15} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: A.label }}>{title}</div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: A.gray1 }}>{subtitle}</div>
          </div>
        </div>
        <div className="text-xl font-semibold tabular-nums shrink-0" style={{ color }}>{metric}</div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {roles.map((role) => (
          <span key={role} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: A.gray6, color: A.gray1 }}>
            {role}
          </span>
        ))}
      </div>

      <div className="space-y-2 flex-1">
        {items.slice(0, 4).map((item) => (
          <div key={item} className="flex items-start gap-2 text-[11px] leading-4" style={{ color: A.sub }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
            <span className="line-clamp-2">{item}</span>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[11px] leading-5 rounded-lg p-3" style={{ background: A.gray6, color: A.gray1 }}>
            暂无需要立即处理的事项。
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {actions.map((action) => (
          <button key={action.label} onClick={action.onClick}
            className="h-8 px-3 rounded-lg text-[11px] font-semibold transition-opacity hover:opacity-90"
            style={action.primary
              ? { background: color, color: A.white }
              : { background: A.gray6, color: A.label }}>
            {action.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────────────

export default function OverviewPanel({
  onNavigate,
  onPrepareReplenishmentRequest,
  onOpenAi,
}: {
  onNavigate: (moduleId: string) => void;
  onPrepareReplenishmentRequest: (sku: string) => void;
  onOpenAi: () => void;
}) {
  const replenishmentActions = overviewReplenishmentActions();
  const [sopDraft, setSopDraft] = useState<SopCycle | null>(null);
  const [sopHistory, setSopHistory] = useState<SopCycle[]>([]);
  const [publishingSop, setPublishingSop] = useState(false);
  const [dashboardOrders, setDashboardOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [dashboardRequests, setDashboardRequests] = useState<PurchaseRequest[]>([]);
  const [dashboardRfqs, setDashboardRfqs] = useState<RfqRecord[]>(RFQS);
  const [dashboardReceiving, setDashboardReceiving] = useState<ReceivingDoc[]>(receivingDocs);
  const [dashboardSuppliers, setDashboardSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);

  useEffect(() => {
    let alive = true;
    apiJson<{ draft: SopCycle; history: SopCycle[] }>("/api/sop-cycle")
      .then((data) => {
        if (!alive) return;
        setSopDraft(data.draft);
        setSopHistory(data.history || []);
      })
      .catch(() => setSopDraft(null));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    apiJson<PurchaseOrder[]>("/api/purchase-orders")
      .then((data) => { if (alive) setDashboardOrders(data); })
      .catch(() => {});
    apiJson<PurchaseRequest[]>("/api/purchase-requests")
      .then((data) => { if (alive) setDashboardRequests(data); })
      .catch(() => {});
    apiJson<RfqRecord[]>("/api/rfqs")
      .then((data) => { if (alive) setDashboardRfqs(data); })
      .catch(() => {});
    apiJson<ReceivingDoc[]>("/api/receiving-docs")
      .then((data) => { if (alive) setDashboardReceiving(data); })
      .catch(() => {});
    apiJson<SupplierPerformance[]>("/api/supplier-performance")
      .then((data) => { if (alive) setDashboardSuppliers(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function publishSopCycle() {
    if (!sopDraft) return;
    setPublishingSop(true);
    try {
      const published = await apiJson<SopCycle>("/api/sop-cycle", {
        method: "POST",
        body: JSON.stringify({ ...sopDraft, status: "已发布", approvedBy: "张磊" }),
      });
      setSopDraft({ ...published, latestPublished: published });
      setSopHistory((items) => [published, ...items].slice(0, 8));
      toast.success(`S&OP ${published.cycle} v${published.version} 已发布`, { description: published.consensus.recommendation });
    } catch (error) {
      toast.error("S&OP 发布失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    } finally {
      setPublishingSop(false);
    }
  }

  const pendingPurchaseRequests = dashboardRequests.filter((item) => item.status === "待审批");
  const pendingPurchaseOrders = dashboardOrders.filter((item) => item.status === "待审批");
  const openQuoteRequests = dashboardRfqs.filter((item) => item.status === "进行中" || item.status === "比价中");
  const pendingReceivingNotes = dashboardReceiving.filter((item) => item.status === "待收货" || item.status === "质检中" || item.status === "异常处理");
  const supplierExceptions = dashboardSuppliers.filter((item) => item.flag === "整改" || Number(item.rejectRate || 0) > 6 || Number(item.exceptions || 0) > 0);
  const slowMovingStock = inventoryItems
    .filter((item) => item.qty > item.max * 0.75 || item.turnover < 4)
    .sort((a, b) => (b.qty / b.max) - (a.qty / a.max));
  const inventoryRiskItems = replenishmentActions.slice(0, 4);
  const firstRiskSku = inventoryRiskItems[0]?.sku;
  const dailyTaskCount = inventoryRiskItems.length + pendingPurchaseRequests.length + pendingPurchaseOrders.length + openQuoteRequests.length + pendingReceivingNotes.length + supplierExceptions.length;
  const inventoryCapital = inventoryItems.reduce((sum, item) => {
    const plan = inventoryPlan(item);
    return sum + item.qty * Number(plan.unitPrice || 0);
  }, 0);
  const operationsCards = [
    {
      title: "今日重点事项",
      metric: String(dailyTaskCount),
      subtitle: "先处理会影响交付和现金的事项",
      icon: ClipboardList,
      color: A.blue,
      roles: ["老板", "运营"],
      items: [
        `${inventoryRiskItems.length} 个库存风险需要确认是否补货`,
        `${pendingPurchaseRequests.length} 张采购申请等待审批`,
        `${pendingPurchaseOrders.length} 张采购订单等待批准`,
        `${pendingReceivingNotes.length} 张收货单需要签收或质检`,
      ],
      actions: [
        { label: "查看采购申请", onClick: () => onNavigate("purchaseRequests"), primary: true },
        { label: "看库存风险", onClick: () => onNavigate("inventory") },
      ],
    },
    {
      title: "库存风险",
      metric: String(inventoryRiskItems.length),
      subtitle: "低库存和可能断货的物料",
      icon: AlertTriangle,
      color: A.orange,
      roles: ["仓库", "计划"],
      items: inventoryRiskItems.map((item) => `${item.sku} ${item.name}：建议采购 ${item.suggestedQty.toLocaleString()}，预计 ${fmt(item.amount)}`),
      actions: [
        { label: "创建 PR", onClick: () => firstRiskSku ? onPrepareReplenishmentRequest(firstRiskSku) : onNavigate("inventory"), primary: true },
        { label: "查看库存", onClick: () => onNavigate("inventory") },
      ],
    },
    {
      title: "采购待审批",
      metric: String(pendingPurchaseRequests.length + pendingPurchaseOrders.length),
      subtitle: "需要经理或老板决定",
      icon: FileCheck2,
      color: A.green,
      roles: ["老板", "审批人"],
      items: [
        ...pendingPurchaseRequests.slice(0, 2).map((item) => `${item.pr}：${item.sourceSku || item.sourceName || "采购申请"} · ${fmt(Number(item.amount || 0))}`),
        ...pendingPurchaseOrders.slice(0, 2).map((item) => `${item.po}：${item.supplier} · ${fmt(item.amount)}`),
      ],
      actions: [
        { label: "Review PR", onClick: () => onNavigate("purchaseRequests"), primary: true },
        { label: "Approve PO", onClick: () => onNavigate("purchasing") },
      ],
    },
    {
      title: "供应商报价请求",
      metric: String(openQuoteRequests.length),
      subtitle: "需要比价或选择供应商",
      icon: FileSpreadsheet,
      color: A.purple,
      roles: ["采购"],
      items: openQuoteRequests.slice(0, 4).map((item) => `${item.id}：${item.title} · 已报价 ${item.quoted}/${item.suppliers}`),
      actions: [
        { label: "Request Quote", onClick: () => onNavigate("rfq"), primary: true },
        { label: "查看报价", onClick: () => onNavigate("rfq") },
      ],
    },
    {
      title: "待收货 / 质检",
      metric: String(pendingReceivingNotes.length),
      subtitle: "今天仓库要处理的收货单",
      icon: PackageCheck,
      color: A.teal,
      roles: ["仓库", "质检"],
      items: pendingReceivingNotes.slice(0, 4).map((item) => `${item.grn}：${item.supplier} · ${item.status === "质检中" ? "等待质检" : item.status === "异常处理" ? "有异常需跟进" : "等待签收"}`),
      actions: [
        { label: "Receive Goods", onClick: () => onNavigate("receiving"), primary: true },
        { label: "查看收货", onClick: () => onNavigate("receiving") },
      ],
    },
    {
      title: "供应商异常",
      metric: String(supplierExceptions.length),
      subtitle: "质量、拒收或交付风险",
      icon: AlertOctagon,
      color: A.red,
      roles: ["采购", "老板"],
      items: supplierExceptions.slice(0, 4).map((item) => `${item.name}：${item.flag || "需复核"} · 拒收率 ${Number(item.rejectRate || 0).toFixed(1)}%`),
      actions: [
        { label: "View Supplier", onClick: () => onNavigate("procurement"), primary: true },
        { label: "看绩效", onClick: () => onNavigate("procurement") },
      ],
    },
    {
      title: "AI 采购建议",
      metric: "AI",
      subtitle: "把复杂计划解释成下一步动作",
      icon: Sparkles,
      color: A.indigo,
      roles: ["老板", "计划", "采购"],
      items: AI_INSIGHTS.overview.slice(0, 3).map((item) => `${item.title}：${item.metric || "查看原因"}`),
      actions: [
        { label: "View Reasoning", onClick: onOpenAi, primary: true },
        { label: "高级计划", onClick: () => onNavigate("forecast") },
      ],
    },
    {
      title: "库存占用资金",
      metric: fmt(inventoryCapital),
      subtitle: "关注慢动和过量库存",
      icon: Wallet,
      color: A.gray1,
      roles: ["老板", "财务"],
      items: slowMovingStock.slice(0, 4).map((item) => `${item.name}：库存 ${item.qty.toLocaleString()}，周转 ${item.turnover}x`),
      actions: [
        { label: "查看库存", onClick: () => onNavigate("inventory"), primary: true },
        { label: "看绩效", onClick: () => onNavigate("sales") },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>SME Daily Operations</div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: A.label }}>今天先处理这些事</h1>
          <p className="text-sm mt-1" style={{ color: A.sub }}>把库存、采购、报价、收货和供应商异常集中到一个日常工作台。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["老板", "采购", "仓库", "财务", "计划"].map((role) => (
            <span key={role} className="text-[11px] px-2.5 py-1 rounded-lg font-medium" style={{ background: A.white, color: A.gray1, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)" }}>
              {role}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {operationsCards.map((card) => (
          <OperationsTaskCard key={card.title} {...card} />
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="本月营收" value="¥8,760万" sub="5月 MTD" delta="+6.2%" positive icon={DollarSign} color={A.blue} />
        <KpiCard label="库存总值" value="¥2.34亿" sub="8,412 活跃 SKU" delta="-1.8%" positive={false} icon={Package} color={A.purple} />
        <KpiCard label="本月订单" value="612" sub="完成率 96.4%" delta="+11.7%" positive icon={ShoppingCart} color={A.green} />
        <KpiCard label="采购支出" value="¥3,412万" sub="预算 ¥3,600万" delta="+4.1%" positive={false} icon={Truck} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>月度供需计划（高级）</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>
              {sopDraft ? `${sopDraft.cycle} · v${sopDraft.version} · ${sopDraft.status}` : "正在读取预测、供应和财务约束"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sopHistory[0] && (
              <span className="text-[11px] px-2.5 py-1 rounded-md font-medium" style={{ background: "#f0faf4", color: A.green }}>
                最新发布 {sopHistory[0].cycle} v{sopHistory[0].version}
              </span>
            )}
            <button onClick={publishSopCycle} disabled={!sopDraft || publishingSop}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:cursor-not-allowed"
              style={{ background: sopDraft ? A.blue : A.gray3, opacity: publishingSop ? 0.72 : 1 }}>
              {publishingSop ? <Loader2 size={12} className="animate-spin" /> : <FileCheck2 size={12} />}
              发布本期共识
            </button>
          </div>
        </div>
        {sopDraft ? (
          <div className="grid grid-cols-4 gap-0">
            {[
              { label: "需求计划", value: `${sopDraft.demandPlan.totalMonthlyDemand.toLocaleString()} /月`, sub: `${sopDraft.demandPlan.highRiskSku} 个高风险 SKU · ${sopDraft.demandPlan.source}`, color: A.blue },
              { label: "供应计划", value: fmt(sopDraft.supplyPlan.plannedAmount), sub: `${sopDraft.supplyPlan.urgentCount} 加急 · ${sopDraft.supplyPlan.exceptionCount} 例外`, color: sopDraft.supplyPlan.urgentCount > 0 ? A.red : A.green },
              { label: "财务约束", value: `${sopDraft.financialConstraint.budgetUsagePct}%`, sub: sopDraft.financialConstraint.decision, color: sopDraft.financialConstraint.constrainedAmount > 0 ? A.orange : A.green },
              { label: "审批角色", value: sopDraft.consensus.approvers.join(" / "), sub: sopDraft.consensus.recommendation, color: A.purple },
            ].map((item, idx) => (
              <div key={item.label} className="p-4" style={{ borderRight: idx < 3 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                <div className="text-[10px] font-semibold" style={{ color: A.gray2 }}>{item.label}</div>
                <div className="text-sm font-semibold mt-1 truncate" style={{ color: item.color }}>{item.value}</div>
                <div className="text-[10px] leading-4 mt-1 line-clamp-2" style={{ color: A.sub }}>{item.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs" style={{ color: A.gray2 }}>S&OP API 暂不可用，首页其余模块仍可使用。</div>
        )}
        {sopDraft?.consensus.decisions?.length ? (
          <div className="px-5 py-3 flex gap-2 overflow-x-auto" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            {sopDraft.consensus.decisions.slice(0, 4).map((decision) => (
              <div key={`${decision.type}-${decision.title}`} className="shrink-0 rounded-lg px-3 py-2 min-w-[210px]" style={{ background: A.gray6 }}>
                <div className="text-[10px] font-semibold" style={{ color: decision.type === "加急" ? A.red : A.blue }}>{decision.type}</div>
                <div className="text-xs font-semibold mt-0.5 truncate" style={{ color: A.label }}>{decision.title}</div>
                <div className="text-[10px] mt-0.5 truncate" style={{ color: A.sub }}>{decision.action}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Main chart + alerts */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="全年营收趋势"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: A.blue }} /><span style={{ color: A.gray1 }}>营收 (左轴)</span></span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 rounded" style={{ background: A.green }} /><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: A.green, marginLeft: -2 }} /><span style={{ color: A.gray1 }}>毛利率 (右轴)</span></span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={salesData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={A.blue} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={A.blue} stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" horizontal vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v / 1e4}万`} width={52} domain={[0, "dataMax + 1000000"]} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: A.green, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} domain={[20, 42]} width={40} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }} />
              <Bar  yAxisId="l" dataKey="revenue" name="营收" fill="url(#barRev)" radius={[6, 6, 0, 0]} barSize={18} />
              <Line yAxisId="r" type="monotone" dataKey="margin" name="毛利率" stroke={A.green} strokeWidth={2}
                dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.green }}
                activeDot={{ r: 5, fill: A.green, stroke: A.white, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 flex items-center justify-between text-[10px]" style={{ color: A.gray1 }}>
            <span>柱状 = 月度营收 (单位: 万元)</span>
            <span>折线 = 综合毛利率 (%)</span>
          </div>
        </Card>

        <Card className="p-5 flex flex-col">
          <SectionHeader title="库存预警" />
          <div className="flex-1 space-y-0">
            {inventoryItems.filter((i) => i.status !== "正常").map((item, idx) => (
              <div key={item.sku} className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: idx < inventoryItems.filter(i => i.status !== "正常").length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: item.status === "不足" ? A.red : A.orange }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: A.label }}>{item.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.gray2 }}>
                    {item.qty.toLocaleString()} / {item.min.toLocaleString()} · {item.location}
                  </div>
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>补货控制塔</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>按库存缺口、建议采购量和供应商动作组织的执行队列</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#fff8f0", color: A.orange }}>
            {replenishmentActions.length} 个待处理
          </span>
        </div>
        <div className="grid grid-cols-4 gap-0">
          {replenishmentActions.map((item, idx) => (
            <div key={item.sku} className="p-4"
              style={{
                borderRight: idx < replenishmentActions.length - 1 ? "0.5px solid rgba(0,0,0,0.06)" : "none",
              }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold" style={{ color: A.blue }}>{item.sku}</div>
                  <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{item.name}</div>
                </div>
                <StatusPill status={item.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>缺口</div>
                  <div className="text-xs font-semibold" style={{ color: item.shortage > 0 ? A.red : A.green }}>
                    {item.shortage.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-2" style={{ background: A.gray6 }}>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>建议量</div>
                  <div className="text-xs font-semibold" style={{ color: A.label }}>{item.suggestedQty.toLocaleString()}</div>
                </div>
              </div>
              <div className="mt-3 text-[11px] leading-5" style={{ color: A.sub }}>
                {item.supplier} · {item.buyer} · {fmt(item.amount)}
              </div>
              <div className="mt-2 text-[11px] font-semibold" style={{ color: item.status === "不足" ? A.red : A.orange }}>
                {item.action}
              </div>
              <div className="flex gap-1.5 mt-3">
                <button onClick={() => onNavigate("forecast")}
                  className="flex-1 h-7 rounded-md text-[11px] font-medium"
                  style={{ background: "#f0f6ff", color: A.blue }}>
                  看预测
                </button>
                <button onClick={() => onPrepareReplenishmentRequest(item.sku)}
                  className="flex-1 h-7 rounded-md text-[11px] font-medium text-white"
                  style={{ background: item.status === "不足" ? A.red : A.orange }}>
                  申请补货
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Health metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "供应链健康指数", value: 78,   suffix: "",  max: 100, color: A.blue,   note: "较上月 +3"      },
          { label: "订单履约率",     value: 96.4, suffix: "%", max: 100, color: A.green,  note: "目标 ≥ 95%"    },
          { label: "采购预算执行率", value: 94.8, suffix: "%", max: 100, color: A.orange, note: "12月 / 预算达成" },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="text-xs" style={{ color: A.sub }}>{m.label}</div>
                <div className="text-3xl font-semibold tracking-tight mt-0.5" style={{ color: A.label }}>
                  {m.value}<span className="text-lg" style={{ color: A.gray2 }}>{m.suffix}</span>
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(m.value / m.max) * 100}%`, background: m.color }} />
            </div>
            <div className="text-[11px] mt-2" style={{ color: A.gray2 }}>{m.note}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Sales · ERP Data ─────────────────────────────────────────────────────────
