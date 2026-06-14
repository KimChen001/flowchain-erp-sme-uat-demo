import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area, ComposedChart, Line, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, AlertTriangle, CheckCircle2, Clock,
  Eye, FileCheck2, GitBranch, Loader2, ShoppingCart, Sparkles, TrendingUp, Zap,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { fmt } from "../../lib/format";
import { A, AppleTooltip, Card, Chip, Field, inputStyle, KpiCard, SectionHeader, SegmentedControl } from "../../components/ui";
import type { PurchaseRequest } from "../../types/scm";
import { forecastData, FORECAST_SKUS, supplierData } from "../../data/demo-data";
import {
  METHOD_LABEL,
  demandDiagnostics,
  formatDemandSeries,
  formatEta,
  mapeGrade,
  parseDemandSeries,
  runForecast,
  xyzClass,
  zScore,
  type Method,
} from "../../domain/forecast";
import { forecastProcurementProfileForSku } from "../../domain/forecast/purchase-request";

const insightMeta = {
  risk:        { color: A.red,    bg: "#fff1f0", label: "风险预警", icon: AlertTriangle },
  opportunity: { color: A.green,  bg: "#f0faf4", label: "增长机会", icon: TrendingUp    },
  info:        { color: A.blue,   bg: "#f0f6ff", label: "分析洞察", icon: Eye           },
  action:      { color: A.orange, bg: "#fff8f0", label: "行动建议", icon: Zap           },
};

function supplierRecommendation(name: string) {
  const supplier = supplierData.find((item) => item.name === name);
  if (!supplier) {
    return {
      score: 68,
      grade: "待评估",
      note: "缺少完整供应商绩效，建议补充准时率、质量合格率和报价记录后再自动推荐。",
      color: A.orange,
    };
  }
  const gradeScore = supplier.grade === "S" ? 100 : supplier.grade === "A" ? 88 : supplier.grade === "B" ? 72 : 60;
  const trendScore = supplier.trend === "up" ? 5 : supplier.trend === "down" ? -8 : 0;
  const score = Math.round(supplier.ontime * 0.38 + supplier.quality * 0.42 + gradeScore * 0.16 + trendScore);
  const color = score >= 92 ? A.green : score >= 84 ? A.blue : score >= 74 ? A.orange : A.red;
  const grade = score >= 92 ? "优先推荐" : score >= 84 ? "可推荐" : score >= 74 ? "需复核" : "高风险";
  return {
    score,
    grade,
    color,
    note: `准时率 ${supplier.ontime}% · 质量 ${supplier.quality}% · ${supplier.grade} 级供应商 · ${supplier.trend === "up" ? "趋势改善" : supplier.trend === "down" ? "趋势下滑" : "趋势稳定"}`,
  };
}

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

// Apple-style card with clean shadow

// ??? Forecast Engine (real statistics) ???????????????????????????????????????
type SavedForecastPlan = {
  id: string;
  sku: string;
  name: string;
  unit?: string;
  method: Method;
  horizon: number;
  metrics: { mape?: number; wmape?: number; rmse?: number };
  procurementSuggestion?: {
    supplier?: string;
    quantity?: number;
    amount?: number;
    priority?: "高" | "中" | "低";
    firstStockoutMonth?: string | null;
  } | null;
  createdAt: string;
};

type MrpScheduleLine = {
  period: string;
  grossRequirement: number;
  independentDemand: number;
  dependentDemand: number;
  dependentDemandSources?: {
    parent: string;
    parentName?: string;
    top?: string;
    topName?: string;
    level?: number;
    demand: number;
    qtyPer?: number;
    scrapPct?: number;
    leadTimeOffset?: number;
  }[];
  scheduledReceipt: number;
  projectedAvailable: number;
  netRequirement: number;
  plannedReceipt: number;
  plannedRelease: number;
  plannedReleasePeriod: string;
  exception: "正常" | "加急" | "释放" | "推迟/取消";
};

type MrpPlanRow = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  supplier: string;
  unitPrice: number;
  serviceLevel: number;
  abc: string;
  xyz: string;
  onHand: number;
  allocated: number;
  safetyStock: number;
  moq: number;
  batchMultiple: number;
  leadTimePeriods: number;
  totalPlannedReceipt: number;
  firstShortagePeriod: string | null;
  maxNetRequirement: number;
  amount: number;
  exception: "正常" | "加急" | "释放" | "推迟/取消";
  bomSources?: {
    parent: string;
    parentName?: string;
    top?: string;
    topName?: string;
    level?: number;
    demand: number;
  }[];
  schedule: MrpScheduleLine[];
};

type MrpPlan = {
  generatedAt: string;
  horizon: number;
  periods: string[];
  summary: {
    skuCount: number;
    exceptionCount: number;
    urgentCount: number;
    plannedAmount: number;
    plannedQty: number;
    bomRootCount?: number;
    bomComponentCount?: number;
  };
  rows: MrpPlanRow[];
  exceptions: {
    sku: string;
    name: string;
    type: "加急" | "释放" | "推迟/取消";
    period: string;
    quantity: number;
    amount: number;
    action: string;
  }[];
};

// Generate the trailing 24 months ending at the current month (May 2026 → 24-month window 2024-06 ~ 2026-05)
const MONTHS_24 = (() => {
  const NOW_Y = 2026, NOW_M = 5;        // 2026 年 5 月作为最后一格
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const totalIdx = NOW_Y * 12 + (NOW_M - 1) - i;
    const y = Math.floor(totalIdx / 12);
    const m = (totalIdx % 12) + 1;
    out.push(`${String(y).slice(-2)}/${m}月`);
  }
  return out;
})();

// Forecast horizon labels start at 2026-06
const FUTURE_LABEL = (i: number) => {
  const totalIdx = 2026 * 12 + 5 + i;
  const y = Math.floor(totalIdx / 12);
  const m = (totalIdx % 12) + 1;
  return `${String(y).slice(-2)}/${m}月`;
};

export default function ForecastPanel() {
  const [skuIdx, setSkuIdx] = useState(0);
  const baseSku = FORECAST_SKUS[skuIdx];
  const [historyText, setHistoryText] = useState(() => formatDemandSeries(baseSku.history));
  const [useCustomHistory, setUseCustomHistory] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedForecastPlan[]>([]);
  const [mrpPlan, setMrpPlan] = useState<MrpPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [generatingRequest, setGeneratingRequest] = useState(false);
  const [lastGeneratedRequest, setLastGeneratedRequest] = useState("");
  const [method, setMethod] = useState<Method>("hw");
  const [alpha, setAlpha] = useState(0.4);
  const [beta,  setBeta]  = useState(0.15);
  const [gamma, setGamma] = useState(0.25);
  const [horizon, setHorizon] = useState(6);
  const [scenario, setScenario] = useState<"base" | "opt" | "pess">("base");
  const [promoLift, setPromoLift] = useState(0);
  const [serviceLevel, setServiceLevel] = useState<50 | 80 | 85 | 90 | 95 | 97 | 98 | 99 | 99.5>(95);
  const [leadTimeDays, setLeadTimeDays] = useState(14);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [committed, setCommitted] = useState(false);

  const parsedHistory = useMemo(() => parseDemandSeries(historyText), [historyText]);
  const effectiveHistory = useCustomHistory && parsedHistory.length >= 6 ? parsedHistory.slice(-36) : baseSku.history;
  const sku = useMemo(() => ({ ...baseSku, history: effectiveHistory }), [baseSku, effectiveHistory]);
  const diag = useMemo(() => demandDiagnostics(sku.history), [sku.history]);

  useEffect(() => {
    setHistoryText(formatDemandSeries(baseSku.history));
    setUseCustomHistory(false);
  }, [baseSku]);

  useEffect(() => {
    apiJson<SavedForecastPlan[]>("/api/forecast-plans")
      .then(setSavedPlans)
      .catch(() => setSavedPlans([]));
  }, [committed]);

  useEffect(() => {
    let alive = true;
    apiJson<MrpPlan>("/api/mrp-plan?periods=6")
      .then((data) => { if (alive) setMrpPlan(data); })
      .catch(() => setMrpPlan(null));
    return () => { alive = false; };
  }, [committed]);

  const result = useMemo(() => runForecast(sku.history, method, { alpha, beta, gamma, season: 12 }, horizon),
    [sku, method, alpha, beta, gamma, horizon]);

  // Champion vs Challenger (auto-run all methods, surface best by MAPE)
  const benchmark = useMemo(() => {
    const methods: Method[] = ["naive", "sma", "ses", "holt", "hw"];
    return methods.map((m) => {
      const r = runForecast(sku.history, m, { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }, horizon);
      return { method: m, mape: r.mape, rmse: r.rmse };
    }).sort((a, b) => a.mape - b.mape);
  }, [sku, horizon]);

  const champion = benchmark[0];
  const aiSuggestsDifferent = champion.method !== method;

  // Apply scenario & promo lift to the raw forecast
  const scenarioMult = scenario === "opt" ? 1.12 : scenario === "pess" ? 0.88 : 1.0;
  const adjustedForecast = result.forecast.map((v, i) =>
    v * scenarioMult * (1 + promoLift / 100) * (1 + (i === 1 ? 0 : 0))
  );

  // Combined chart data (history + fitted + forecast bands)
  const historyData = useMemo(() => sku.history.map((h, i) => ({
    month: MONTHS_24[i], actual: h, fitted: result.fitted[i] ?? null,
  })), [sku, result]);

  const forecastChart = useMemo(() => {
    const errStd = result.rmse;
    const lastActual = sku.history[sku.history.length - 1];
    // Anchor point: repeat last historical actual so the forecast line visually connects from "今天"
    const arr: any[] = [{
      month: MONTHS_24[MONTHS_24.length - 1],
      forecast: lastActual, lower: lastActual, upper: lastActual, bandHeight: 0,
    }];
    for (let i = 0; i < horizon; i++) {
      const f = adjustedForecast[i];
      const lo = Math.max(0, f - 1.96 * errStd);
      const hi = f + 1.96 * errStd;
      arr.push({
        month: FUTURE_LABEL(i),
        forecast: f, lower: lo, upper: hi, bandHeight: hi - lo,
      });
    }
    return arr;
  }, [sku, result, adjustedForecast, horizon]);

  // Shared Y domain so the two side-by-side charts read on the same scale
  const yDomain = useMemo(() => {
    const allVals: number[] = [];
    historyData.forEach(d => { if (d.actual != null) allVals.push(d.actual); if (d.fitted != null) allVals.push(d.fitted); });
    forecastChart.forEach(d => { allVals.push(d.upper); allVals.push(d.lower); });
    const lo = Math.min(...allVals);
    const hi = Math.max(...allVals);
    const pad = (hi - lo) * 0.1;
    return [Math.max(0, Math.floor((lo - pad) / 10) * 10), Math.ceil((hi + pad) / 10) * 10];
  }, [historyData, forecastChart]);

  // Supply-demand reconciliation (next `horizon` months)
  const reconciliation = useMemo(() => {
    let inv = sku.onHand;
    const inbound = (m: number) => m === 0 ? sku.open : 0;
    return adjustedForecast.map((demand, i) => {
      inv = inv + inbound(i) - demand;
      const gap = inv < 0 ? -inv : 0;
      const cover = demand > 0 ? (inv + demand) / demand : 0;
      return {
        month: FUTURE_LABEL(i),
        demand: Math.round(demand),
        inbound: inbound(i),
        ending: Math.round(inv),
        gap: Math.round(gap),
        cover: cover,
        risk: inv < 0 ? "高" : cover < 1.2 ? "中" : "低",
      };
    });
  }, [sku, adjustedForecast]);

  const peakGap = Math.max(0, ...reconciliation.map((r) => r.gap));
  const firstStockoutIndex = reconciliation.findIndex((r) => r.risk === "高");
  const stockoutMonths = reconciliation.filter((r) => r.risk === "高").length;
  const procurementProfile = forecastProcurementProfileForSku(sku.sku);
  const currentMrpRow = mrpPlan?.rows.find((row) => row.sku === sku.sku) ?? null;
  const safetyFactor = serviceLevel >= 98 ? 1.18 : serviceLevel >= 95 ? 1.1 : 1.05;
  const recommendedQty = peakGap > 0 ? Math.ceil(peakGap * safetyFactor) : 0;
  const recommendedAmount = recommendedQty * procurementProfile.unitPrice;
  const purchasePriority = firstStockoutIndex >= 0 && firstStockoutIndex <= 1 ? "高" : stockoutMonths > 0 ? "中" : "低";
  const executableRecommendedQty = Number(currentMrpRow?.totalPlannedReceipt || 0) > 0 ? Number(currentMrpRow?.totalPlannedReceipt || 0) : recommendedQty;
  const executableRecommendedAmount = executableRecommendedQty * procurementProfile.unitPrice;
  const executablePriority = currentMrpRow?.exception === "加急" ? "高" : purchasePriority;
  const mrpBomSourceSummary = currentMrpRow?.bomSources?.length
    ? currentMrpRow.bomSources
      .map((source) => `${source.parentName || source.parent} ${Number(source.demand || 0).toLocaleString()} ${sku.unit}`)
      .join("；")
    : "";
  const mrpScheduleEvidence = currentMrpRow?.schedule
    .filter((line) => line.dependentDemand > 0 || line.plannedReceipt > 0)
    .slice(0, 6)
    .map((line) => ({
      period: line.period,
      grossRequirement: line.grossRequirement,
      independentDemand: line.independentDemand,
      dependentDemand: line.dependentDemand,
      plannedReceipt: line.plannedReceipt,
      plannedReleasePeriod: line.plannedReleasePeriod,
      exception: line.exception,
      sources: line.dependentDemandSources || [],
    })) || [];
  const mrpBomEvidence = currentMrpRow ? {
    bomSources: currentMrpRow.bomSources || [],
    dependentDemandTotal: currentMrpRow.schedule.reduce((sum, line) => sum + Number(line.dependentDemand || 0), 0),
    grossRequirementTotal: currentMrpRow.schedule.reduce((sum, line) => sum + Number(line.grossRequirement || 0), 0),
    schedule: mrpScheduleEvidence,
  } : null;
  const supplierScore = supplierRecommendation(procurementProfile.supplier);
  const backendMrpExceptions = (mrpPlan?.exceptions || [])
    .filter((item) => item.sku === sku.sku)
    .slice(0, 2)
    .map((item) => ({
      type: `MRP ${item.type}`,
      title: `${item.period} ${item.name} 计划例外`,
      body: item.action,
      metric: `${Number(item.quantity || 0).toLocaleString()} ${sku.unit}`,
      color: item.type === "加急" ? A.red : item.type === "释放" ? A.blue : A.orange,
    }));
  const mrpExceptions = [
    ...backendMrpExceptions,
    ...(firstStockoutIndex >= 0 ? [{
      type: "加急释放",
      title: `${reconciliation[firstStockoutIndex]?.month} 出现首个净缺口`,
      body: `预计期末库存转负，需在本周释放采购申请，避免计划收货晚于需求窗口。`,
      metric: `${recommendedQty.toLocaleString()} ${sku.unit}`,
      color: A.red,
    }] : []),
    ...(stockoutMonths >= 3 ? [{
      type: "供应风险",
      title: `${stockoutMonths} 个月连续缺料`,
      body: `建议检查供应商产能与物流提前期，必要时拆单或引入备选供应商。`,
      metric: fmt(recommendedAmount),
      color: A.orange,
    }] : []),
    ...(Math.abs(result.trackingSignal) > 4 ? [{
      type: "预测偏差",
      title: `Tracking Signal ${result.trackingSignal.toFixed(1)}`,
      body: `模型存在系统性偏差，释放采购前建议复核最近订单和促销/项目需求。`,
      metric: `MAPE ${result.mape.toFixed(1)}%`,
      color: A.purple,
    }] : []),
    ...(supplierScore.score < 84 ? [{
      type: "供应商复核",
      title: `${procurementProfile.supplier} 评分 ${supplierScore.score}`,
      body: `供应商评分低于自动推荐阈值，建议触发 RFQ 或选择备选供应商。`,
      metric: supplierScore.grade,
      color: A.orange,
    }] : []),
  ].slice(0, 4);

  useEffect(() => {
    setLastGeneratedRequest("");
  }, [sku.sku, method, horizon, scenario, promoLift, serviceLevel, leadTimeDays, peakGap]);

  function runEngine() {
    setRunning(true); setProgress(0); setCommitted(false);
    let p = 0;
    const step = () => {
      p += Math.random() * 18 + 10;
      if (p >= 100) { setProgress(100); setRunning(false); toast.success(`${METHOD_LABEL[method]} 已收敛`, { description: `MAPE ${result.mape.toFixed(1)}% · RMSE ${result.rmse.toFixed(0)}` }); }
      else { setProgress(Math.round(p)); setTimeout(step, 90); }
    };
    setTimeout(step, 60);
  }

  function applyAI() {
    setMethod(champion.method);
    toast(`已切换为 AI 推荐模型: ${METHOD_LABEL[champion.method]}`, {
      description: `MAPE ${champion.mape.toFixed(1)}% (较当前 ↓${(result.mape - champion.mape).toFixed(1)}pts)`,
    });
  }

  async function saveForecastPlan() {
    setSavingPlan(true);
    try {
      const recommendation = peakGap > 0
        ? `建议追加采购 ${recommendedQty.toLocaleString()} ${sku.unit}，优先覆盖 ${stockoutMonths} 个月断货风险。`
        : "当前供需平衡，建议维持现有采购节奏并持续监控 MAPE 与 Tracking Signal。";
      const plan = await apiJson<SavedForecastPlan>("/api/forecast-plans", {
        method: "POST",
        body: JSON.stringify({
          sku: sku.sku,
          name: sku.name,
          unit: sku.unit,
          method,
          horizon,
          scenario,
          promoLift,
          serviceLevel,
          leadTimeDays,
          history: sku.history,
          metrics: {
            mape: Number(result.mape.toFixed(2)),
            wmape: Number(result.wmape.toFixed(2)),
            smape: Number(result.smape.toFixed(2)),
            rmse: Number(result.rmse.toFixed(2)),
            mae: Number(result.mae.toFixed(2)),
            trackingSignal: Number(result.trackingSignal.toFixed(2)),
            theilU: Number(result.theilU.toFixed(2)),
            cov: Number(diag.cov.toFixed(3)),
          },
          reconciliation,
          procurementSuggestion: {
            supplier: procurementProfile.supplier,
            buyer: procurementProfile.buyer,
            unitPrice: procurementProfile.unitPrice,
            quantity: recommendedQty,
            amount: recommendedAmount,
            priority: purchasePriority,
            firstStockoutMonth: firstStockoutIndex >= 0 ? reconciliation[firstStockoutIndex]?.month : null,
            safetyFactor,
            basis: "peak-net-shortage",
          },
          recommendation,
        }),
      });
      setSavedPlans((prev) => [plan, ...prev].slice(0, 8));
      setCommitted(true);
      toast.success("预测方案已保存到后端", { description: `${plan.id} · ${sku.sku}` });
    } catch {
      toast.error("保存失败，请检查 API 服务");
    } finally {
      setSavingPlan(false);
    }
  }

  async function createRequestFromForecast() {
    if (executableRecommendedQty <= 0) {
      toast("当前无需生成采购申请", { description: "供需对账未识别到净缺口，建议继续监控预测偏差。" });
      return;
    }
    if (lastGeneratedRequest) {
      toast("已生成采购申请", { description: `${lastGeneratedRequest} 已在采购申请待审批队列中。` });
      return;
    }
    setGeneratingRequest(true);
    try {
      const created = await apiJson<PurchaseRequest>("/api/purchase-requests", {
        method: "POST",
        body: JSON.stringify({
          supplier: procurementProfile.supplier,
          requester: "张磊",
          buyer: procurementProfile.buyer,
          requiredDate: formatEta(leadTimeDays),
          amount: executableRecommendedAmount,
          status: "待审批",
          priority: executablePriority,
          source: "forecast",
          sourceSku: sku.sku,
          sourceName: sku.name,
          quantity: executableRecommendedQty,
          unit: sku.unit,
          unitPrice: procurementProfile.unitPrice,
          reason: currentMrpRow
            ? `MRP 净需求计划建议入库 ${executableRecommendedQty.toLocaleString()} ${sku.unit}，例外 ${currentMrpRow.exception}`
            : `预测净缺口 ${peakGap.toLocaleString()} ${sku.unit}，服务水平 ${serviceLevel}%`,
          forecastBasis: {
            peakGap,
            serviceLevel,
            safetyFactor,
            stockoutMonths,
            firstStockoutMonth: firstStockoutIndex >= 0 ? reconciliation[firstStockoutIndex]?.month : null,
            source: currentMrpRow ? "mrp-net-requirements" : "forecast",
            plannedReceipt: executableRecommendedQty,
            mrpException: currentMrpRow?.exception,
            bomSourceSummary: currentMrpRow ? mrpBomSourceSummary : "",
            bomSources: currentMrpRow?.bomSources || [],
          },
          approvalSnapshot: {
            source: currentMrpRow ? "mrp-assisted-forecast" : "forecast",
            summary: `${sku.sku} ${sku.name} · 建议 ${executableRecommendedQty.toLocaleString()} ${sku.unit} · ${fmt(executableRecommendedAmount)}`,
            explanation: currentMrpRow
              ? `预测补货数量已按后端 MRP 净需求校准：MRP 例外 ${currentMrpRow.exception}，计划入库 ${executableRecommendedQty.toLocaleString()} ${sku.unit}，优先级 ${executablePriority}。${mrpBomSourceSummary ? `BOM 来源：${mrpBomSourceSummary}。` : ""}`
              : `预测供需对账识别峰值净缺口 ${peakGap.toLocaleString()} ${sku.unit}，服务水平 ${serviceLevel}% 下建议采购 ${executableRecommendedQty.toLocaleString()} ${sku.unit}。`,
            forecast: {
              method,
              horizon,
              scenario,
              promoLift,
              mape: Number(result.mape.toFixed(2)),
              rmse: Number(result.rmse.toFixed(2)),
              peakGap,
              stockoutMonths,
              firstStockoutMonth: firstStockoutIndex >= 0 ? reconciliation[firstStockoutIndex]?.month : null,
            },
            mrp: currentMrpRow ? {
              exception: currentMrpRow.exception,
              totalPlannedReceipt: currentMrpRow.totalPlannedReceipt,
              maxNetRequirement: currentMrpRow.maxNetRequirement,
              firstShortagePeriod: currentMrpRow.firstShortagePeriod,
              ...mrpBomEvidence,
            } : null,
            supplier: {
              name: procurementProfile.supplier,
              buyer: procurementProfile.buyer,
              unitPrice: procurementProfile.unitPrice,
              score: supplierScore.score,
              grade: supplierScore.grade,
              note: supplierScore.note,
            },
            createdAt: new Date().toISOString(),
          },
        }),
      });
      toast.success(`${created.pr} 已生成待审批采购申请`, {
        description: `${procurementProfile.supplier} · ${executableRecommendedQty.toLocaleString()} ${sku.unit} · ${fmt(executableRecommendedAmount)}`,
      });
      setLastGeneratedRequest(created.pr);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const duplicate = message.match(/PR-\d{4}-\d{4}/)?.[0];
      if (duplicate) {
        setLastGeneratedRequest(duplicate);
        toast("预测采购申请已存在", { description: `${duplicate} 已在待审批或执行中，无需重复生成。` });
      } else {
        toast.error("采购申请生成失败", { description: "请确认 API 服务正在运行。" });
      }
    } finally {
      setGeneratingRequest(false);
    }
  }

  async function releaseMrpAsPr() {
    if (!currentMrpRow || currentMrpRow.totalPlannedReceipt <= 0) {
      toast("当前没有可释放的 MRP 计划", { description: "净需求计划未产生 planned order release。" });
      return;
    }
    if (lastGeneratedRequest) {
      toast("已生成采购申请", { description: `${lastGeneratedRequest} 已在采购申请待审批队列中。` });
      return;
    }
    const releaseLine = currentMrpRow.schedule.find((line) => line.plannedRelease > 0 && line.exception !== "正常")
      || currentMrpRow.schedule.find((line) => line.plannedRelease > 0);
    const releaseQty = Number(currentMrpRow.totalPlannedReceipt || 0);
    const unitPrice = Number(currentMrpRow.unitPrice || procurementProfile.unitPrice || 0);
    const amount = releaseQty * unitPrice;
    setGeneratingRequest(true);
    try {
      const created = await apiJson<PurchaseRequest>("/api/purchase-requests", {
        method: "POST",
        body: JSON.stringify({
          supplier: currentMrpRow.supplier || procurementProfile.supplier,
          requester: "张磊",
          buyer: procurementProfile.buyer,
          requiredDate: formatEta(Math.max(7, Number(currentMrpRow.leadTimePeriods || 1) * 7)),
          amount,
          status: "待审批",
          priority: currentMrpRow.exception === "加急" ? "高" : currentMrpRow.exception === "释放" ? "中" : executablePriority,
          source: "mrp-release",
          sourceSku: currentMrpRow.sku,
          sourceName: currentMrpRow.name,
          quantity: releaseQty,
          unit: currentMrpRow.unit,
          unitPrice,
          reason: `MRP planned order release：${currentMrpRow.exception}，计划入库 ${releaseQty.toLocaleString()} ${currentMrpRow.unit}，释放期 ${releaseLine?.plannedReleasePeriod || "—"}。`,
          forecastBasis: {
            source: "mrp-release",
            plannedReceipt: releaseQty,
            plannedReleasePeriod: releaseLine?.plannedReleasePeriod || "",
            mrpException: currentMrpRow.exception,
            firstStockoutMonth: currentMrpRow.firstShortagePeriod,
            peakGap: currentMrpRow.maxNetRequirement,
            serviceLevel: currentMrpRow.serviceLevel,
            leadTimeDays: Number(currentMrpRow.leadTimePeriods || 1) * 7,
            moq: currentMrpRow.moq,
            batchMultiple: currentMrpRow.batchMultiple,
            bomSourceSummary: mrpBomSourceSummary,
            bomSources: currentMrpRow.bomSources || [],
          },
          approvalSnapshot: {
            source: "mrp-release",
            summary: `${currentMrpRow.sku} ${currentMrpRow.name} · ${currentMrpRow.exception} · ${releaseQty.toLocaleString()} ${currentMrpRow.unit} · ${fmt(amount)}`,
            explanation: `MRP 根据独立需求、BOM 相关需求、库存、在途和批量规则生成 planned order release。${mrpBomSourceSummary ? `BOM 来源：${mrpBomSourceSummary}。` : ""}采购申请需由审批人确认释放期、供应商产能和预算。`,
            mrp: {
              generatedAt: mrpPlan?.generatedAt,
              horizon: mrpPlan?.horizon,
              firstShortagePeriod: currentMrpRow.firstShortagePeriod,
              maxNetRequirement: currentMrpRow.maxNetRequirement,
              totalPlannedReceipt: currentMrpRow.totalPlannedReceipt,
              releasePeriod: releaseLine?.plannedReleasePeriod || "",
              ...mrpBomEvidence,
            },
            supplier: {
              name: currentMrpRow.supplier || procurementProfile.supplier,
              score: supplierScore.score,
              grade: supplierScore.grade,
              note: supplierScore.note,
            },
            createdAt: new Date().toISOString(),
          },
        }),
      });
      toast.success(`${created.pr} 已由 MRP 释放为待审批 PR`, {
        description: `${currentMrpRow.sku} · ${releaseQty.toLocaleString()} ${currentMrpRow.unit} · ${fmt(amount)}`,
      });
      setLastGeneratedRequest(created.pr);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const duplicate = message.match(/PR-\d{4}-\d{4}/)?.[0];
      if (duplicate) {
        setLastGeneratedRequest(duplicate);
        toast("MRP 释放申请已存在", { description: `${duplicate} 已在待审批或执行中。` });
      } else {
        toast.error("MRP 释放失败", { description: message || "请确认 API 服务正在运行。" });
      }
    } finally {
      setGeneratingRequest(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="模型 MAPE" value={`${result.mape.toFixed(1)}%`} sub={`RMSE ${result.rmse.toFixed(0)}`}
          delta={aiSuggestsDifferent ? `AI ↓${(result.mape - champion.mape).toFixed(1)}pts` : "已最优"}
          positive={!aiSuggestsDifferent} icon={Activity} color={A.green} />
        <KpiCard label={`未来 ${horizon} 月需求`}
          value={reconciliation.reduce((s, r) => s + r.demand, 0).toLocaleString()}
          sub={sku.unit}
          delta={scenario !== "base" ? (scenario === "opt" ? "+12%" : "-12%") : promoLift ? `促销 +${promoLift}%` : "基准"}
          positive={scenario === "opt"} icon={TrendingUp} color={A.blue} />
        <KpiCard label="峰值净缺口" value={peakGap > 0 ? peakGap.toLocaleString() : "0"}
          sub={`${stockoutMonths} 个月断货风险`}
          delta={peakGap > 0 ? "需采购" : "充足"} positive={peakGap === 0}
          icon={AlertTriangle} color={peakGap > 0 ? A.red : A.green} />
        <KpiCard label="计划状态" value={committed ? "已发布" : "草稿"} sub="S&OP 共识需求"
          icon={committed ? CheckCircle2 : Clock} color={committed ? A.green : A.orange} />
      </div>

      {/* SKU selector */}
      <Card className="p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2 shrink-0" style={{ color: A.gray2 }}>SKU</span>
          {FORECAST_SKUS.map((s, i) => (
            <button key={s.sku} onClick={() => { setSkuIdx(i); setCommitted(false); }}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={skuIdx === i
                ? { background: "#f0f6ff", color: A.blue, boxShadow: `0 0 0 1px ${A.blue}30` }
                : { background: "transparent", color: A.gray1 }}>
              <span style={{ color: skuIdx === i ? A.blue : A.gray2 }}>{s.sku}</span>
              <span className="ml-2">{s.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="历史需求输入"
            right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: useCustomHistory ? "#f0faf4" : A.gray6, color: useCustomHistory ? A.green : A.gray1 }}>
              {useCustomHistory ? "使用用户输入" : "使用系统样本"}
            </span>} />
          <textarea
            value={historyText}
            onChange={(e) => setHistoryText(e.target.value)}
            className="w-full h-24 rounded-xl p-3 text-xs outline-none resize-none"
            style={{ background: A.gray6, color: A.label, border: "0.5px solid rgba(0,0,0,0.08)" }}
            placeholder="粘贴历史月需求，例如：120, 132, 141, 138..."
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-[10px]" style={{ color: parsedHistory.length >= 6 ? A.green : A.orange }}>
              已识别 {parsedHistory.length} 个历史点 · 至少 6 个点才可用于预测，建议 18-36 个点
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setHistoryText(formatDemandSeries(baseSku.history)); setUseCustomHistory(false); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: A.gray6, color: A.label }}>
                恢复样本
              </button>
              <button onClick={() => {
                  if (parsedHistory.length < 6) {
                    toast.error("历史数据不足", { description: "请至少输入 6 个非负数字。" });
                    return;
                  }
                  setUseCustomHistory(true);
                  setCommitted(false);
                  toast.success("历史需求已应用", { description: `${parsedHistory.slice(-36).length} 个数据点已进入预测引擎` });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: A.blue }}>
                应用输入数据
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="客观数据诊断" />
          <div className="grid grid-cols-2 gap-2">
            {[
              ["样本数", `${diag.n}`],
              ["均值", `${diag.mean.toFixed(0)} ${sku.unit}`],
              ["中位数", `${diag.median.toFixed(0)} ${sku.unit}`],
              ["范围", `${diag.min.toFixed(0)}-${diag.max.toFixed(0)}`],
              ["标准差", `${diag.std.toFixed(0)}`],
              ["CoV", `${diag.cov.toFixed(2)}`],
              ["近3月趋势", `${diag.recentTrend >= 0 ? "+" : ""}${diag.recentTrend.toFixed(1)}%`],
              ["零需求点", `${diag.zeros}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                <div className="text-[9px]" style={{ color: A.gray2 }}>{label}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color: label === "近3月趋势" ? (diag.recentTrend >= 0 ? A.green : A.red) : A.label }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[10px] leading-relaxed" style={{ color: A.sub }}>
            诊断基于当前进入模型的历史需求，不依赖 AI 生成。CoV 越高，预测越不稳定。
          </div>
        </Card>
      </div>

      {/* Engine controls */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="预测引擎"
            right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0f6ff", color: A.blue }}>v2.4</span>} />

          <Field label="算法">
            <select value={method} onChange={(e) => setMethod(e.target.value as Method)} style={inputStyle}>
              {(["naive","sma","ses","holt","hw"] as Method[]).map((m) => (
                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
              ))}
            </select>
          </Field>

          <div className="space-y-4 mt-4">
            {[
              { label: "α (Level)",    val: alpha, set: setAlpha, enabled: method === "ses" || method === "holt" || method === "hw" },
              { label: "β (Trend)",    val: beta,  set: setBeta,  enabled: method === "holt" || method === "hw" },
              { label: "γ (Seasonal)", val: gamma, set: setGamma, enabled: method === "hw" },
            ].map((p) => (
              <div key={p.label} style={{ opacity: p.enabled ? 1 : 0.4 }}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: A.sub }}>{p.label}</span>
                  <span className="font-medium tabular-nums" style={{ color: A.label }}>{p.val.toFixed(2)}</span>
                </div>
                <input type="range" min={0.05} max={0.95} step={0.05}
                  value={p.val} disabled={!p.enabled}
                  onChange={(e) => p.set(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: A.blue, background: A.gray5 }} />
              </div>
            ))}

            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span style={{ color: A.sub }}>预测期 (月)</span>
                <span className="font-medium tabular-nums" style={{ color: A.label }}>{horizon}</span>
              </div>
              <input type="range" min={3} max={12} step={1} value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: A.blue, background: A.gray5 }} />
            </div>
          </div>

          <button onClick={runEngine} disabled={running}
            className="w-full mt-5 text-xs py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-1.5"
            style={{ background: A.blue, opacity: running ? 0.6 : 1 }}>
            {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {running ? `运算中… ${progress}%` : "运行预测引擎"}
          </button>

          {running && (
            <div className="h-1 mt-2 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: A.blue }} />
            </div>
          )}

          {/* Accuracy metrics — industry standard suite */}
          <div className="mt-4 pt-4" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            {(() => {
              const g = mapeGrade(result.mape);
              const tsAlert = Math.abs(result.trackingSignal) > 4;
              const theilBetter = result.theilU < 1;
              return (
                <>
                  {/* Lewis grade banner */}
                  <div className="rounded-xl p-3 mb-3 flex items-center gap-3"
                    style={{ background: `${g.color}12`, border: `1px solid ${g.color}30` }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-base"
                      style={{ background: g.color, color: A.white }}>{g.grade}</div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold" style={{ color: A.label }}>Lewis 等级 · {g.band}</div>
                      <div className="text-[10px]" style={{ color: A.sub }}>MAPE {result.mape.toFixed(1)}% (A&lt;10 · B&lt;20 · C&lt;50 · D≥50)</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "MAPE",    val: `${result.mape.toFixed(1)}%`,  hint: "平均绝对百分比误差",  color: g.color },
                      { label: "WMAPE",   val: `${result.wmape.toFixed(1)}%`, hint: "按销量加权 MAPE",     color: A.label },
                      { label: "sMAPE",   val: `${result.smape.toFixed(1)}%`, hint: "对称 MAPE (无穷大保护)", color: A.label },
                      { label: "RMSE",    val: result.rmse.toFixed(0),         hint: "均方根误差",          color: A.label },
                      { label: "MAE",     val: result.mae.toFixed(0),          hint: "平均绝对误差",        color: A.label },
                      { label: "Bias",    val: (result.bias >= 0 ? "+" : "") + result.bias.toFixed(0),
                        hint: "误差均值 (>0 低估)", color: Math.abs(result.bias) < result.mae * 0.3 ? A.green : A.orange },
                      { label: "Tracking Signal",
                        val: (result.trackingSignal >= 0 ? "+" : "") + result.trackingSignal.toFixed(2),
                        hint: tsAlert ? "|TS|>4 系统性偏差" : "在 ±4 控制限内",
                        color: tsAlert ? A.red : A.green },
                      { label: "Theil's U",
                        val: result.theilU.toFixed(2),
                        hint: theilBetter ? "U<1 优于朴素法" : "U≥1 不如朴素法",
                        color: theilBetter ? A.green : A.red },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg p-2.5" style={{ background: A.gray6 }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px]" style={{ color: A.gray1 }}>{m.label}</span>
                        </div>
                        <div className="text-sm font-semibold tabular-nums mt-0.5" style={{ color: m.color }}>{m.val}</div>
                        <div className="text-[9px] mt-0.5" style={{ color: A.gray2 }}>{m.hint}</div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </Card>

        {/* Chart */}
        <Card className="col-span-2 p-5">
          <SectionHeader title={`${sku.sku} · ${sku.name}`}
            right={
              <div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: A.blue }} /><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: A.blue, marginLeft: -2 }} /><span style={{ color: A.gray1 }}>实际 (历史)</span></span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `1.5px dotted ${A.green}` }} /><span style={{ color: A.gray1 }}>拟合 (训练)</span></span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `2px dashed ${A.orange}` }} /><span style={{ color: A.gray1 }}>预测 (未来)</span></span>
              </div>
            } />

          {/* Two side-by-side panels: HISTORY (actual vs fitted) | FORECAST (prediction + 95% CI band) */}
          <div className="flex items-stretch rounded-xl overflow-hidden" style={{ border: `0.5px solid ${A.gray5}` }}>
            {/* LEFT — 历史拟合度 */}
            <div className="flex-1 min-w-0 p-3" style={{ background: "rgba(0,113,227,0.02)", borderRight: `1px dashed ${A.gray4}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: A.blue }}>① 历史拟合 · 模型在 24 个月真实数据上的表现</span>
                <span className="text-[10px]" style={{ color: A.gray1 }}>2024-06 ~ 2026-05</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<AppleTooltip />} />
                  <Line type="monotone" dataKey="actual" name="实际" stroke={A.blue} strokeWidth={2}
                    dot={{ r: 2.5, fill: A.blue, strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: A.blue, stroke: A.white, strokeWidth: 2 }}
                    isAnimationActive={false} />
                  <Line type="monotone" dataKey="fitted" name="拟合" stroke={A.green} strokeWidth={1.5}
                    strokeDasharray="3 3" dot={false} connectNulls
                    isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 text-[10px]" style={{ color: A.gray1 }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ background: A.blue }} />实际销量</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `1.5px dashed ${A.green}` }} />模型拟合</span>
                <span className="ml-auto">MAPE <span className="font-semibold" style={{ color: A.green }}>{result.mape.toFixed(1)}%</span></span>
              </div>
            </div>

            {/* RIGHT — 未来预测 */}
            <div className="p-3" style={{ background: "rgba(255,149,0,0.03)", width: `${Math.max(24, (horizon / (24 + horizon)) * 100 + 10)}%`, minWidth: 220 }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: A.orange }}>② 未来 {horizon} 月预测 · 含 95% 置信带</span>
                <span className="text-[10px]" style={{ color: A.gray1 }}>{FUTURE_LABEL(0)} ~ {FUTURE_LABEL(horizon - 1)}</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={forecastChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ciG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={A.orange} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={A.orange} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <YAxis domain={yDomain} tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={42} />
                  <Tooltip content={<AppleTooltip />} />
                  <Area type="monotone" dataKey="lower"      stackId="ci2" stroke="none" fill="transparent" isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="bandHeight" stackId="ci2" name="95% 区间" stroke="none" fill="url(#ciG2)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="forecast" name="预测" stroke={A.orange} strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.orange }}
                    activeDot={{ r: 5, fill: A.orange, stroke: A.white, strokeWidth: 2 }}
                    isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-1 text-[10px]" style={{ color: A.gray1 }}>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0" style={{ borderTop: `2px dashed ${A.orange}` }} />预测中位</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2 rounded-sm" style={{ background: `${A.orange}33` }} />95% 置信带</span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]" style={{ color: A.gray1 }}>
            <div><span style={{ color: A.blue, fontWeight: 500 }}>实际</span> 真实销量历史值,模型的训练原料</div>
            <div><span style={{ color: A.green, fontWeight: 500 }}>拟合</span> 模型对历史的"反推",越贴合实际越好</div>
            <div><span style={{ color: A.orange, fontWeight: 500 }}>预测</span> 模型对未来的外推 ± 1.96σ 置信带</div>
          </div>

          {/* AI consensus banner */}
          <div className="mt-4 rounded-xl p-3 flex items-center gap-3"
            style={{ background: aiSuggestsDifferent ? "#fff8f0" : "#f0faf4", border: `1px solid ${aiSuggestsDifferent ? A.orange : A.green}30` }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${A.blue} 0%, #34aadc 100%)` }}>
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="flex-1 text-[11px]" style={{ color: A.label }}>
              {aiSuggestsDifferent ? (
                <>
                  <span className="font-semibold">AI 推荐切换至 {METHOD_LABEL[champion.method]}</span>
                  ：在交叉验证中 MAPE 为 <span className="font-semibold" style={{ color: A.green }}>{champion.mape.toFixed(1)}%</span>，
                  优于当前模型 {(result.mape - champion.mape).toFixed(1)} 个百分点。
                </>
              ) : (
                <><span className="font-semibold">当前已是 5 模型基准中的最优解。</span> 可直接应用此预测进入 S&OP。</>
              )}
            </div>
            {aiSuggestsDifferent && (
              <button onClick={applyAI}
                className="text-[11px] px-3 py-1.5 rounded-lg font-medium text-white shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: A.blue }}>采纳建议</button>
            )}
          </div>
        </Card>
      </div>

      {/* Scenario + benchmark + reconciliation */}
      <div className="grid grid-cols-3 gap-3">
        {/* Scenario planning */}
        <Card className="p-5">
          <SectionHeader title="情景规划 (What-If)" />
          <div className="space-y-1.5">
            {([
              { id: "pess", label: "悲观",   note: "-12% · 经济下行 / 客户流失", color: A.red    },
              { id: "base", label: "基准",   note: "模型基线",                    color: A.blue   },
              { id: "opt",  label: "乐观",   note: "+12% · 大客户中标 / 市场扩张", color: A.green  },
            ] as const).map((s) => (
              <button key={s.id} onClick={() => setScenario(s.id)}
                className="w-full text-left p-3 rounded-xl transition-all flex items-center gap-3"
                style={{
                  background: scenario === s.id ? `${s.color}12` : A.gray6,
                  border: `1px solid ${scenario === s.id ? s.color + "40" : "transparent"}`,
                }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: A.label }}>{s.label}情景</div>
                  <div className="text-[10px]" style={{ color: A.sub }}>{s.note}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[11px] mb-1">
              <span style={{ color: A.sub }}>促销/活动叠加</span>
              <span className="font-medium tabular-nums" style={{ color: promoLift >= 0 ? A.green : A.red }}>
                {promoLift >= 0 ? "+" : ""}{promoLift}%
              </span>
            </div>
            <input type="range" min={-30} max={50} step={5} value={promoLift}
              onChange={(e) => setPromoLift(parseInt(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: A.purple }} />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: A.gray2 }}>
              <span>-30%</span><span>基线</span><span>+50%</span>
            </div>
          </div>
        </Card>

        {/* Model benchmark */}
        <Card className="p-5">
          <SectionHeader title="模型对比 (Champion / Challenger)" />
          <div className="space-y-2">
            {benchmark.map((b, i) => {
              const max = Math.max(...benchmark.map((x) => x.mape));
              const isCurrent = b.method === method;
              const isChamp = i === 0;
              return (
                <div key={b.method}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] w-4" style={{ color: A.gray2 }}>{i + 1}</span>
                    <span className="text-xs flex-1 truncate" style={{ color: isCurrent ? A.blue : A.label, fontWeight: isCurrent ? 600 : 500 }}>
                      {METHOD_LABEL[b.method]}
                    </span>
                    {isChamp && <span className="text-[9px] px-1.5 py-px rounded-full font-semibold" style={{ background: "#f0faf4", color: A.green }}>BEST</span>}
                    {isCurrent && !isChamp && <span className="text-[9px] px-1.5 py-px rounded-full font-semibold" style={{ background: "#f0f6ff", color: A.blue }}>当前</span>}
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${(b.mape / max) * 100}%`, background: isChamp ? A.green : isCurrent ? A.blue : A.gray3 }} />
                    </div>
                    <span className="text-[11px] tabular-nums w-12 text-right" style={{ color: A.sub }}>{b.mape.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 text-[10px]" style={{ color: A.gray2, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            交叉验证：留最后 6 个月作为测试集
          </div>
        </Card>

        {/* AI insights for current SKU */}
        <Card className="p-5">
          <SectionHeader title="AI 关键发现"
            right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#f0f6ff", color: A.blue }}>实时</span>} />
          <div className="space-y-2.5">
            {[
              {
                t: "info" as const,
                title: "强季节性 (γ 推荐 0.25)",
                body: `检出年度季节因子峰值 +${(Math.max(...sku.history) / (sku.history.reduce((a, b) => a + b, 0) / 24) - 1).toFixed(2)}x，建议 γ ≥ 0.20。`,
              },
              {
                t: stockoutMonths > 0 ? "risk" : "info" as const,
                title: stockoutMonths > 0 ? `${stockoutMonths} 个月断货风险` : "供需平衡",
                body: stockoutMonths > 0
                  ? `当前在手 ${sku.onHand} + 在途 ${sku.open}，预测期最大净缺口 ${peakGap.toLocaleString()} ${sku.unit}。`
                  : `在手 ${sku.onHand} + 在途 ${sku.open} 充足覆盖未来 ${horizon} 月需求。`,
              },
              {
                t: "action" as const,
                title: peakGap > 0 ? `建议追加采购 ${recommendedQty.toLocaleString()} ${sku.unit}` : "无需追加采购",
                body: peakGap > 0 ? `按峰值净缺口叠加 ${(safetyFactor * 100 - 100).toFixed(0)}% 安全系数，建议转待审批采购单。` : `当前计划已满足安全库存要求。`,
              },
            ].map((it, i) => {
              const m = insightMeta[it.t];
              const Icon = m.icon;
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: m.bg }}>
                  <div className="flex items-start gap-2">
                    <Icon size={11} style={{ color: m.color }} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold" style={{ color: A.label }}>{it.title}</div>
                      <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: A.sub }}>{it.body}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Inventory planning: Service Level + Safety Stock + Forecastability */}
      {(() => {
        const xyz = xyzClass(sku.history);
        const mean = sku.history.reduce((a, b) => a + b, 0) / sku.history.length;
        const std = Math.sqrt(sku.history.reduce((s, v) => s + (v - mean) ** 2, 0) / sku.history.length);
        const z = zScore(serviceLevel);
        const leadMonths = leadTimeDays / 30;
        // Safety Stock = z × σ_d × √L  (Browne's formula, demand variability dominant)
        const safetyStock = Math.ceil(z * std * Math.sqrt(leadMonths));
        const cycleStock  = Math.ceil(mean * leadMonths);
        const reorderPoint = Math.ceil(mean * leadMonths + safetyStock);
        const eoq = Math.ceil(Math.sqrt((2 * mean * 12 * 800) / (50 * 0.25))); // Wilson EOQ, K=800 setup, h=50*0.25
        const fillRate = serviceLevel; // simplified — assume CSL ≈ Fill Rate for illustration

        return (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-5">
              <SectionHeader title="服务水平与安全库存"
                right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "#eef0ff", color: A.indigo }}>z = {z.toFixed(2)}</span>} />

              <Field label={`服务水平 (CSL)`}>
                <div className="grid grid-cols-6 gap-1">
                  {([85, 90, 95, 97, 98, 99] as const).map((s) => (
                    <button key={s} onClick={() => setServiceLevel(s)}
                      className="text-[11px] py-1.5 rounded-md font-medium transition-colors"
                      style={{
                        background: serviceLevel === s ? A.blue : A.gray6,
                        color: serviceLevel === s ? A.white : A.gray1,
                      }}>{s}%</button>
                  ))}
                </div>
              </Field>

              <div className="mt-4">
                <div className="flex justify-between text-[11px] mb-1">
                  <span style={{ color: A.sub }}>采购提前期 (L)</span>
                  <span className="font-medium tabular-nums" style={{ color: A.label }}>{leadTimeDays} 天</span>
                </div>
                <input type="range" min={3} max={45} step={1} value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(parseInt(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: A.blue }} />
              </div>

              <div className="mt-5 pt-4 space-y-2" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                {[
                  { k: "需求均值 (μ)",   v: `${Math.round(mean).toLocaleString()} ${sku.unit}/月` },
                  { k: "需求标准差 (σ)", v: `${Math.round(std).toLocaleString()} ${sku.unit}/月` },
                  { k: "周期库存",       v: `${cycleStock.toLocaleString()} ${sku.unit}`, hl: A.label },
                  { k: "安全库存 SS",    v: `${safetyStock.toLocaleString()} ${sku.unit}`, hl: A.orange },
                  { k: "再订货点 ROP",   v: `${reorderPoint.toLocaleString()} ${sku.unit}`, hl: A.blue },
                  { k: "经济订货量 EOQ", v: `${eoq.toLocaleString()} ${sku.unit}`, hl: A.purple },
                  { k: "预计填充率",     v: `${fillRate}%`, hl: A.green },
                ].map((r) => (
                  <div key={r.k} className="flex justify-between text-xs">
                    <span style={{ color: A.sub }}>{r.k}</span>
                    <span className="font-medium tabular-nums" style={{ color: r.hl || A.label }}>{r.v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: "#f0f6ff", color: A.sub }}>
                <span style={{ color: A.label, fontWeight: 600 }}>SS = z × σ × √L</span>
                {" "}· EOQ = √(2DK/h) · ROP = μL + SS
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="可预测性诊断 (XYZ)" />
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-semibold"
                  style={{ background: `${xyz.color}18`, color: xyz.color }}>{xyz.cls}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold" style={{ color: A.label }}>{xyz.note}</div>
                  <div className="text-[10px]" style={{ color: A.sub }}>变异系数 CoV = {xyz.cov.toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-2 mt-3">
                {([
                  { c: "X", min: "0", max: "0.25", note: "稳定 · 自动补货", color: A.green },
                  { c: "Y", min: "0.25", max: "0.50", note: "波动 · 半月预测", color: A.orange },
                  { c: "Z", min: "0.50", max: "∞", note: "不规则 · 按订单生产", color: A.red },
                ] as const).map((row) => (
                  <div key={row.c} className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: xyz.cls === row.c ? `${row.color}10` : A.gray6 }}>
                    <span className="text-[11px] font-semibold w-4" style={{ color: row.color }}>{row.c}</span>
                    <span className="text-[10px] tabular-nums w-20" style={{ color: A.sub }}>CoV {row.min}–{row.max}</span>
                    <span className="text-[10px]" style={{ color: A.label }}>{row.note}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 text-[10px] leading-relaxed" style={{ color: A.gray2, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                结合 ABC 价值分类形成 9 宫格策略矩阵：AX 高价值稳定品 100% 自动补货，CZ 低价值不规则品按需采购。
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader title="预测准确度 SLA 趋势" />
              <ResponsiveContainer width="100%" height={140}>
                <ComposedChart data={Array.from({ length: 12 }, (_, i) => ({
                  m: `${(i + 1)}月`,
                  mape: 6 + Math.sin(i * 0.7) * 3 + Math.random() * 2,
                  target: 10,
                }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={28} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<AppleTooltip />} />
                  <Line type="monotone" dataKey="target" name="SLA 目标" stroke={A.red} strokeWidth={1} strokeDasharray="4 3" dot={false} />
                  <Line type="monotone" dataKey="mape"   name="实际 MAPE" stroke={A.blue} strokeWidth={2} dot={{ r: 2.5, fill: A.white, strokeWidth: 1.5, stroke: A.blue }} />
                </ComposedChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                  { l: "12个月均值", v: "7.8%", c: A.green },
                  { l: "SLA 达成率", v: "92%",   c: A.green },
                  { l: "偏差天数",   v: "1/30",  c: A.orange },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                    <div className="text-[9px]" style={{ color: A.gray2 }}>{m.l}</div>
                    <div className="text-sm font-semibold tabular-nums" style={{ color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      <Card className="p-5">
        <SectionHeader title="MRP 例外消息"
          right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: mrpExceptions.length ? "#fff8f0" : "#f0faf4", color: mrpExceptions.length ? A.orange : A.green }}>
            {mrpExceptions.length ? `${mrpExceptions.length} 条异常` : "无异常"}
          </span>} />
        {mrpExceptions.length === 0 ? (
          <div className="text-xs py-6 text-center" style={{ color: A.gray2 }}>
            当前预测、库存和供应商评分未触发 MRP 例外消息。
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {mrpExceptions.map((item) => (
              <div key={item.type} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold" style={{ color: item.color }}>{item.type}</span>
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: item.color }}>{item.metric}</span>
                </div>
                <div className="text-xs font-semibold" style={{ color: A.label }}>{item.title}</div>
                <div className="text-[10px] leading-4 mt-1" style={{ color: A.sub }}>{item.body}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>后端 MRP 净需求计划</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>
              {currentMrpRow
                ? `${currentMrpRow.sku} · 在手 ${currentMrpRow.onHand.toLocaleString()} ${currentMrpRow.unit} · 已分配 ${currentMrpRow.allocated.toLocaleString()} · MOQ ${currentMrpRow.moq} · 提前期 ${currentMrpRow.leadTimePeriods} 期`
                : "等待 MRP 接口返回计划结果"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-4 gap-2 min-w-[460px]">
              {[
                { label: "计划入库", value: currentMrpRow ? `${currentMrpRow.totalPlannedReceipt.toLocaleString()} ${currentMrpRow.unit}` : "—", color: A.blue },
                { label: "最大净需求", value: currentMrpRow ? currentMrpRow.maxNetRequirement.toLocaleString() : "—", color: currentMrpRow?.maxNetRequirement ? A.red : A.green },
                { label: "BOM来源", value: currentMrpRow?.bomSources?.length ? `${currentMrpRow.bomSources.length} 个父项` : "—", color: A.orange },
                { label: "计划金额", value: currentMrpRow ? fmt(currentMrpRow.amount) : "—", color: A.purple },
              ].map((item) => (
                <div key={item.label} className="rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>{item.label}</div>
                  <div className="text-xs font-semibold truncate" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <button onClick={releaseMrpAsPr} disabled={generatingRequest || !currentMrpRow || currentMrpRow.totalPlannedReceipt <= 0 || Boolean(lastGeneratedRequest)}
              className="h-10 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:cursor-not-allowed"
              style={{ background: lastGeneratedRequest ? A.green : currentMrpRow && currentMrpRow.totalPlannedReceipt > 0 ? A.purple : A.gray3, opacity: generatingRequest ? 0.7 : 1 }}>
              {generatingRequest ? <Loader2 size={13} className="animate-spin" /> : lastGeneratedRequest ? <CheckCircle2 size={13} /> : <GitBranch size={13} />}
              {lastGeneratedRequest ? `已生成 ${lastGeneratedRequest}` : "释放为 PR"}
            </button>
          </div>
        </div>
        {currentMrpRow ? (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["周期", "毛需求", "独立/BOM", "计划到货", "预计可用", "净需求", "计划入库", "计划释放", "例外"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentMrpRow.schedule.map((line, index) => {
                const exceptionColor = line.exception === "加急" ? A.red : line.exception === "释放" ? A.blue : line.exception === "推迟/取消" ? A.orange : A.green;
                return (
                  <tr key={line.period} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: index < currentMrpRow.schedule.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{line.period}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.label }}>{line.grossRequirement.toLocaleString()}</td>
                    <td className="px-4 py-3 tabular-nums min-w-[190px]" style={{ color: A.sub }}>
                      <div>{line.independentDemand.toLocaleString()} / {line.dependentDemand.toLocaleString()}</div>
                      {line.dependentDemandSources?.length ? (
                        <div className="mt-1 text-[10px] leading-4 tabular-nums" style={{ color: A.gray2 }}>
                          {line.dependentDemandSources.map((source) => `${source.parentName || source.parent} ${source.demand.toLocaleString()}`).join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: line.scheduledReceipt > 0 ? A.blue : A.gray3 }}>
                      {line.scheduledReceipt > 0 ? `+${line.scheduledReceipt.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: line.projectedAvailable < currentMrpRow.safetyStock ? A.red : A.label }}>
                      {line.projectedAvailable.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: line.netRequirement > 0 ? A.red : A.gray3 }}>
                      {line.netRequirement > 0 ? line.netRequirement.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: line.plannedReceipt > 0 ? A.blue : A.gray3 }}>
                      {line.plannedReceipt > 0 ? line.plannedReceipt.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: line.plannedRelease > 0 ? A.purple : A.gray3 }}>
                      {line.plannedRelease > 0 ? `${line.plannedReleasePeriod} · ${line.plannedRelease.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Chip label={line.exception} color={exceptionColor} bg={`${exceptionColor}16`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-10 text-center text-xs" style={{ color: A.gray2 }}>MRP 接口暂不可用，预测页仍可使用本地供需对账。</div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <SectionHeader title="预测转采购建议"
              right={<span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: peakGap > 0 ? "#fff1f0" : "#f0faf4", color: peakGap > 0 ? A.red : A.green }}>
                {peakGap > 0 ? "需要补货" : "无需补货"}
              </span>} />
            <p className="text-xs leading-5 max-w-3xl" style={{ color: A.sub }}>
              基于峰值净缺口、服务水平和提前期生成采购申请；审批通过后再转采购订单。
            </p>
          </div>
          <button onClick={createRequestFromForecast} disabled={generatingRequest || executableRecommendedQty <= 0 || Boolean(lastGeneratedRequest)}
            className="h-9 px-4 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 disabled:cursor-not-allowed"
            style={{ background: lastGeneratedRequest ? A.green : executableRecommendedQty > 0 ? A.blue : A.gray3, opacity: generatingRequest ? 0.7 : 1 }}>
            {generatingRequest ? <Loader2 size={13} className="animate-spin" /> : lastGeneratedRequest ? <CheckCircle2 size={13} /> : <ShoppingCart size={13} />}
            {lastGeneratedRequest ? `已生成 ${lastGeneratedRequest}` : "生成采购申请"}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2 mt-4">
          {[
            { label: currentMrpRow ? "MRP 建议量" : "建议采购量", value: executableRecommendedQty > 0 ? `${executableRecommendedQty.toLocaleString()} ${sku.unit}` : "0", color: executableRecommendedQty > 0 ? A.red : A.green },
            { label: "峰值净缺口", value: `${peakGap.toLocaleString()} ${sku.unit}`, color: peakGap > 0 ? A.red : A.green },
            { label: "推荐供应商", value: procurementProfile.supplier, color: A.blue },
            { label: "供应商评分", value: `${supplierScore.score} · ${supplierScore.grade}`, color: supplierScore.color },
            { label: "预估金额", value: fmt(executableRecommendedAmount), color: A.purple },
            { label: "优先级", value: executablePriority, color: executablePriority === "高" ? A.red : executablePriority === "中" ? A.orange : A.green },
            { label: "预计到货", value: formatEta(leadTimeDays), color: A.label },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="text-[10px]" style={{ color: A.gray2 }}>{item.label}</div>
              <div className="text-xs font-semibold mt-1 truncate" style={{ color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.sub }}>
          <span className="font-semibold" style={{ color: supplierScore.color }}>供应商推荐依据：</span>{supplierScore.note}
        </div>
      </Card>

      {/* Demand-Supply Reconciliation */}
      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>需求 — 供给对账 (S&OP)</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>
              起始在手 {sku.onHand.toLocaleString()} {sku.unit} · 待入库 {sku.open.toLocaleString()} {sku.unit}
            </p>
          </div>
          <button onClick={saveForecastPlan} disabled={savingPlan}
            className="text-xs px-4 py-2 rounded-xl font-medium text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: committed ? A.green : A.blue, opacity: savingPlan ? 0.7 : 1 }}>
            {savingPlan ? <><Loader2 size={12} className="animate-spin" /> 保存中</>
              : committed ? <><CheckCircle2 size={12} /> 已保存方案</>
                : <><FileCheck2 size={12} /> 保存共识预测方案</>}
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["月份", "预测需求", "计划入库", "期末库存", "缺口", "覆盖月数", "风险", "AI 建议"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reconciliation.map((row, i) => {
              const riskColor = row.risk === "高" ? A.red : row.risk === "中" ? A.orange : A.green;
              return (
                <tr key={i} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < reconciliation.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{row.month}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: A.label }}>{row.demand.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: row.inbound > 0 ? A.blue : A.gray3 }}>{row.inbound > 0 ? "+" + row.inbound.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 tabular-nums font-semibold" style={{ color: row.ending < 0 ? A.red : A.label }}>{row.ending.toLocaleString()}</td>
                  <td className="px-5 py-3 tabular-nums font-medium" style={{ color: row.gap > 0 ? A.red : A.gray3 }}>{row.gap > 0 ? row.gap.toLocaleString() : "—"}</td>
                  <td className="px-5 py-3 tabular-nums" style={{ color: A.sub }}>{row.cover.toFixed(1)}</td>
                  <td className="px-5 py-3"><StatusPill status={row.risk === "高" ? "不足" : row.risk === "中" ? "预警" : "正常"} /></td>
                  <td className="px-5 py-3" style={{ color: riskColor }}>
                    {row.risk === "高" ? `紧急补货 +${Math.ceil(row.gap * 1.1).toLocaleString()}`
                      : row.risk === "中" ? "提前下单" : "维持现状"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <SectionHeader title="已保存预测方案"
          right={<span className="text-[10px]" style={{ color: A.gray2 }}>{savedPlans.length} 条后端记录</span>} />
        {savedPlans.length === 0 ? (
          <div className="text-xs py-6 text-center" style={{ color: A.gray2 }}>
            还没有保存方案。运行预测后点击“保存共识预测方案”，结果会写入后端数据。
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {savedPlans.slice(0, 8).map((plan) => (
              <div key={plan.id} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                <div className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{plan.id}</div>
                <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{plan.sku}</div>
                <div className="text-[10px] mt-0.5 truncate" style={{ color: A.sub }}>{plan.name}</div>
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <span style={{ color: A.gray1 }}>{METHOD_LABEL[plan.method] ?? plan.method}</span>
                  <span style={{ color: A.green }}>MAPE {Number(plan.metrics?.mape ?? 0).toFixed(1)}%</span>
                </div>
                {plan.procurementSuggestion && Number(plan.procurementSuggestion.quantity || 0) > 0 && (
                  <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <div className="flex items-center justify-between">
                      <span style={{ color: A.gray2 }}>建议采购</span>
                      <span className="font-semibold" style={{ color: A.red }}>
                        {Number(plan.procurementSuggestion.quantity).toLocaleString()} {plan.unit || ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="truncate" style={{ color: A.gray2 }}>{plan.procurementSuggestion.supplier || "—"}</span>
                      <span style={{ color: A.purple }}>{fmt(Number(plan.procurementSuggestion.amount || 0))}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// Legacy forecast block removed in favor of S&OP engine above
function _ForecastLegacy_Unused() {
  return (
    <div style={{ display: "none" }}>
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Q1 预测营收" value="¥3.09亿" sub="1—3月 (信心 91%)" delta="+12.8% YoY" positive icon={TrendingUp} color={A.blue} />
        <KpiCard label="预测准确率" value="94.2%" sub="MAPE 5.8%" icon={Activity} color={A.green} />
        <KpiCard label="需补货品种" value="342" sub="未来 30 天" delta="+24 vs 上期" positive={false} icon={AlertTriangle} color={A.red} />
        <KpiCard label="模型更新" value="2h 前" sub="持续学习中" icon={Clock} color={A.purple} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="营收预测 vs 实际（含置信区间）"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 rounded" style={{ background: A.blue }} />实际</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 rounded border-dashed" style={{ borderTop: `2px dashed ${A.orange}` }} />预测</span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={forecastData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="confG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={A.orange} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={A.orange} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1e4}万`} width={48} />
              <Tooltip content={<AppleTooltip />} />
              <Area type="monotone" dataKey="upper" name="上限" stroke="none" fill="url(#confG)" />
              <Area type="monotone" dataKey="lower" name="下限" stroke="none" fill="white" />
              <Line type="monotone" dataKey="actual" name="实际" stroke={A.blue} strokeWidth={2.5} dot={{ r: 3.5, fill: A.white, strokeWidth: 2, stroke: A.blue }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="预测" stroke={A.orange} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3, fill: A.white, strokeWidth: 2, stroke: A.orange }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="季度预测" />
          <div className="space-y-4">
            {[
              { q: "Q3 2026", revenue: "¥3.09亿", conf: 91 },
              { q: "Q4 2026", revenue: "¥3.56亿", conf: 84 },
              { q: "Q1 2027", revenue: "¥3.84亿", conf: 76 },
              { q: "Q2 2027", revenue: "¥4.21亿", conf: 68 },
            ].map((row) => (
              <div key={row.q}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs font-medium" style={{ color: A.label }}>{row.q}</span>
                  <span className="text-sm font-semibold" style={{ color: A.blue }}>{row.revenue}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${row.conf}%`, background: A.orange }} />
                  </div>
                  <span className="text-[11px] w-14 text-right" style={{ color: A.gray1 }}>置信 {row.conf}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>30 天补货优先级</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["品名", "当前库存", "预测消耗", "可用天数", "建议采购量", "建议时间", "预估金额", "紧迫度"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { name: "控制器主板 V3.2",  qty: 12,  consume: 48,  days: 7,  suggest: 60,  when: "立即",   cost: "¥72万", urgency: "不足" },
              { name: "伺服电机 750W",     qty: 34,  consume: 120, days: 8,  suggest: 150, when: "立即",   cost: "¥45万", urgency: "不足" },
              { name: "铝合金型材 6063",   qty: 148, consume: 620, days: 7,  suggest: 800, when: "48h 内", cost: "¥28万", urgency: "不足" },
              { name: "液压油缸 50mm",     qty: 67,  consume: 140, days: 14, suggest: 120, when: "本周内", cost: "¥31万", urgency: "预警" },
              { name: "密封垫片 φ80",      qty: 520, consume: 900, days: 17, suggest: 600, when: "本周内", cost: "¥9万",  urgency: "预警" },
            ].map((row, i) => (
              <tr key={row.name} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < 4 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.name}</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{row.qty}</td>
                <td className="px-5 py-3.5" style={{ color: A.sub }}>{row.consume}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: row.days <= 10 ? A.red : A.orange }}>{row.days} 天</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.green }}>{row.suggest}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.when}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.orange }}>{row.cost}</td>
                <td className="px-5 py-3.5"><StatusPill status={row.urgency} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
