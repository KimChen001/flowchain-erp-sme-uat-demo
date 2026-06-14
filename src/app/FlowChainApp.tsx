import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
import {
  Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart,
} from "recharts";
import {
  Package, ShoppingCart, TrendingUp, DollarSign, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Bell, Search, ChevronRight,
  Activity, Truck, Sparkles, RefreshCw, Zap, Eye, Clock,
  CheckCircle2, Minus, BarChart2,
  ClipboardList, PackageCheck, FileText,
  AlertCircle, Plus,
  X, Loader2, FileCheck2, Send,
  ClipboardCheck,
  Users, Receipt, Tag, FileSpreadsheet, Handshake, Wallet,
  ShieldCheck, AlertOctagon, Undo2, Building2, CreditCard,
  Lock, LogOut, Printer, GitBranch,
} from "lucide-react";
import { navGroups, navItems } from "./routes";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/constants";
import { apiJson } from "../lib/api-client";
import { fmt } from "../lib/format";
import { exportModulePdf } from "../lib/pdf-export";
import { A, AppleTooltip, Card, Chip, Field, inputStyle, KpiCard, Modal, SectionHeader, SegmentedControl, SubTabs } from "../components/ui";
import { AI_INSIGHTS } from "../modules/ai-assistant/ai-insights";
import type {
  AiConfidence,
  ApprovalSnapshot,
  ChatMessage,
  DemoUser,
  MarketPrice,
  PurchaseIntent,
  PurchaseOrder,
  PurchaseRequest,
  ReceivingDoc,
  RfqRecord,
  SupplierRecommendationResult,
} from "../types/scm";
import {
  salesData,
  forecastData,
  procurementData,
  inventoryItems,
  topProducts,
  supplierData,
  monthlyProcurement,
  purchaseOrders,
  receivingDocs,
  FULFILLMENT_STAGES,
  FORECAST_SKUS,
  RFQS,
  CONTRACTS,
  MATCH_QUEUE,
  PAYABLES,
  PORTAL_SUPPLIERS,
} from "../data/demo-data";
import { toNumber } from "../domain/purchasing/helpers";
import { inventoryPlan } from "../domain/inventory/planning";
import { inventoryPurchaseRequestPayload } from "../domain/inventory/purchase-request";
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
} from "../domain/forecast";
import { forecastProcurementProfileForSku } from "../domain/forecast/purchase-request";
import PurchasingRequests from "../modules/purchase-requests/Page";
import PurchasingOrders from "../modules/purchasing/Page";
import PurchasingRFQ from "../modules/rfq/Page";
import ReceivingPanel from "../modules/receiving/Page";
import InventoryPanel from "../modules/inventory/Page";

// ─── Apple System Colors ──────────────────────────────────────────────────────

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

const pieColors = [A.blue, A.green, A.orange, A.purple, A.teal];

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

// ─── Purchase Orders ─────────────────────────────────────────────────────────
const poApprovalQueue = [
  { po: "PO-2026-1287", supplier: "深圳新元电气", amount: 1840000, requestor: "陈思远", wait: "4小时", reason: "伺服电机紧急补货" },
  { po: "PO-2026-1279", supplier: "深圳新元电气", amount: 528000,  requestor: "陈思远", wait: "1小时", reason: "驱动板季度备货" },
  { po: "PO-2026-1278", supplier: "上海仪表科技", amount: 92000,   requestor: "周浩",   wait: "30分钟", reason: "测量仪表更换" },
];

const procurementTrend = [
  { day: "周一", po: 8,  amount: 1240 },
  { day: "周二", po: 12, amount: 2840 },
  { day: "周三", po: 6,  amount: 1620 },
  { day: "周四", po: 15, amount: 3640 },
  { day: "周五", po: 11, amount: 2380 },
  { day: "周六", po: 3,  amount: 480  },
  { day: "周日", po: 1,  amount: 120  },
];

// ─── AI Insights ──────────────────────────────────────────────────────────────

const insightMeta = {
  risk:        { color: A.red,    bg: "#fff1f0", label: "风险预警", icon: AlertTriangle },
  opportunity: { color: A.green,  bg: "#f0faf4", label: "增长机会", icon: TrendingUp    },
  info:        { color: A.blue,   bg: "#f0f6ff", label: "分析洞察", icon: Eye           },
  action:      { color: A.orange, bg: "#fff8f0", label: "行动建议", icon: Zap           },
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

// Apple-style card with clean shadow
const QUICK_QUESTIONS: Record<string, string[]> = {
  overview: ["本周最重要的风险是什么？", "今天的铁的市场价格"],
  inventory: ["为什么这些 SKU 会断货？", "结合汇率和新闻看补货风险"],
  sales: ["哪些产品值得优先备货？", "销售下滑的原因是什么？"],
  forecast: ["这个预测模型靠谱吗？", "外部信号会影响预测吗？"],
  purchasing: ["哪些采购单应该优先审批？", "结合外部风险调整采购计划"],
  receiving: ["哪些到货异常最紧急？", "供应商延期会影响什么？"],
  procurement: ["采购成本为什么上涨？", "结合汇率看采购成本"],
};

function buildAiAssistantReply(moduleId: string, question: string, activeInsight?: { title: string; body: string; metric?: string }) {
  const q = question.toLowerCase();
  const moduleLabel = PAGE_LABELS[moduleId] ?? "当前模块";
  const evidence = activeInsight
    ? `当前系统正在关注「${activeInsight.title}」${activeInsight.metric ? `，核心指标是 ${activeInsight.metric}` : ""}。`
    : `当前上下文来自「${moduleLabel}」。`;

  if (q.includes("为什么") || q.includes("原因") || q.includes("why")) {
    return `${evidence} 主要原因可以拆成三层：第一是历史数据已经出现趋势变化；第二是库存、采购或交付节奏没有完全跟上；第三是这个变化会传导到订单履约或现金占用。建议先看数据依据，再确认是否需要生成采购动作或审批说明。`;
  }

  if (q.includes("风险") || q.includes("断货") || q.includes("延期")) {
    return `${evidence} 我会把风险优先级按“影响金额、发生概率、剩余处理时间”排序。当前建议先处理高影响且时间窗口短的问题，例如低于安全库存的 SKU、待审批高优先级 PO、以及已经出现延期记录的供应商。`;
  }

  if (q.includes("采购") || q.includes("补货") || q.includes("下单")) {
    return `${evidence} 采购建议应同时看预测需求、现有库存、在途数量、供应商交期和 MOQ。若预测需求超过可用库存，系统应先生成采购申请 PR，审批后再转 PO；若同一供应商存在多张草稿 PO，可以考虑合并下单来锁价和降低物流成本。`;
  }

  if (q.includes("模型") || q.includes("预测") || q.includes("准确")) {
    return `${evidence} 预测结果建议用 MAPE、WMAPE、Tracking Signal 和 Theil's U 一起判断。MAPE 看整体误差，Tracking Signal 看是否有系统性偏差，Theil's U 小于 1 说明模型优于朴素法。对波动大的 SKU，建议用 Holt-Winters 或敏感度更高的指数平滑参数。`;
  }

  if (q.includes("邮件") || q.includes("说明") || q.includes("审批")) {
    return `${evidence} 可以生成一段审批说明：基于历史需求预测和当前库存覆盖天数，系统识别出潜在供应风险。建议按推荐数量发起采购，并优先选择准时率更高、交期更短的供应商，以降低断货和订单延期风险。`;
  }

  return `${evidence} 我的建议是先确认这条 insight 的数据依据，再决定动作：如果影响订单交付，优先生成采购申请或催交任务；如果影响成本，优先做供应商对比和合并采购；如果只是趋势提醒，可以先加入下周 S&OP 复盘。`;
}

// ─── Typewriter ───────────────────────────────────────────────────────────────
function TypewriterText({ text, speed = 14 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    setDone(false);
    const tick = () => {
      if (idx.current < text.length) {
        idx.current++;
        setDisplayed(text.slice(0, idx.current));
        timer.current = setTimeout(tick, speed);
      } else {
        setDone(true);
      }
    };
    timer.current = setTimeout(tick, 80);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-0.5 h-3.5 rounded-full ml-px animate-pulse align-middle" style={{ background: A.blue }} />}
    </span>
  );
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
export function AiPanel({ moduleId }: { moduleId: string }) {
  const insights = AI_INSIGHTS[moduleId] ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [scanPct, setScanPct] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastConfidence, setLastConfidence] = useState<AiConfidence | null>(null);
  const [asking, setAsking] = useState(false);
  const [externalStatus, setExternalStatus] = useState("联网信号加载中");
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [marketStatus, setMarketStatus] = useState("行情加载中");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const startScan = useCallback(() => {
    setScanning(true);
    setScanPct(0);
    setActiveIdx(0);
    let p = 0;
    const step = () => {
      p += Math.random() * 22 + 10;
      if (p >= 100) { setScanPct(100); setScanning(false); }
      else { setScanPct(Math.round(p)); timer.current = setTimeout(step, 70); }
    };
    timer.current = setTimeout(step, 60);
  }, []);

  useEffect(() => {
    startScan();
    setInput("");
    setMessages([{
      role: "assistant",
      content: `${PAGE_LABELS[moduleId] ?? "当前模块"}上下文已载入。我会基于当前页面的指标、预测和 insight 回答，不做脱离数据的建议。`,
    }]);
    setLastConfidence(null);
    apiJson<{ signals: { type: string }[] }>("/api/external-signals")
      .then((data) => setExternalStatus(`联网信号 ${data.signals.length} 条`))
      .catch(() => setExternalStatus("联网信号暂不可用"));
    apiJson<{ asOf: string; prices: MarketPrice[] }>("/api/market-prices")
      .then((data) => {
        setMarketPrices(data.prices);
        setMarketStatus(`行情 ${data.prices.length} 条`);
      })
      .catch(() => setMarketStatus("行情暂不可用"));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [moduleId, refreshKey, startScan]);

  const active = insights[activeIdx];
  const meta = active ? insightMeta[active.type] : null;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  const quickQuestions = QUICK_QUESTIONS[moduleId] ?? ["帮我解释当前 insight", "下一步建议做什么？"];

  async function askAi(text: string) {
    const question = text.trim();
    if (!question || asking) return;
    setAsking(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    try {
      const result = await apiJson<{
        provider: string;
        model?: string;
        content: string;
        degraded?: boolean;
        usedWeb?: boolean;
        timingMs?: number;
        externalMs?: number;
        modelMs?: number;
        confidence?: AiConfidence;
      }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ moduleId, question, activeInsight: active }),
      });
      const prefix = result.provider === "local"
        ? "本地分析: "
        : result.provider === "market-data"
          ? "行情数据: "
        : `${result.provider === "doubao" ? "豆包" : "GPT"}: `;
      const timing = typeof result.timingMs === "number"
        ? `\n\n耗时 ${result.timingMs}ms · 模型 ${result.modelMs ?? "-"}ms · ${result.usedWeb ? `联网 ${result.externalMs ?? "-"}ms` : "未联网"}`
        : "";
      if (result.confidence) setLastConfidence(result.confidence);
      setMessages((prev) => [...prev, { role: "assistant", content: `${prefix}${result.content}${timing}`, confidence: result.confidence }]);
    } catch {
      const reply = buildAiAssistantReply(moduleId, question, active);
      setMessages((prev) => [...prev, { role: "assistant", content: `本地分析: ${reply}` }]);
    } finally {
      setAsking(false);
    }
  }

  async function refreshMarketPrices() {
    try {
      setMarketStatus("行情刷新中");
      const data = await apiJson<{ asOf: string; prices: MarketPrice[] }>("/api/market-prices/refresh", { method: "POST" });
      setMarketPrices(data.prices);
      setMarketStatus(`行情 ${data.prices.length} 条`);
      toast.success("行情数据已刷新");
    } catch {
      setMarketStatus("行情刷新失败");
      toast.error("行情刷新失败，请检查 API");
    }
  }

  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: "0.5px solid rgba(0,0,0,0.1)" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0071e3 0%, #34aadc 100%)" }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: A.label }}>AI 分析</div>
              <div className="text-[10px]" style={{ color: A.gray2 }}>供应链智能引擎</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: A.gray2 }}>{timeStr}</span>
            <button onClick={() => setRefreshKey((k) => k + 1)}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
              style={{ color: A.gray1 }}>
              <RefreshCw size={11} className={scanning ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Scan bar */}
        <div className="rounded-lg p-2.5" style={{ background: A.gray6 }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: scanning ? A.blue : A.green }}>
              {scanning ? "正在分析数据…" : "分析完成"}
            </span>
            <span className="text-[11px] font-medium" style={{ color: A.label }}>{scanPct}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: A.gray4 }}>
            <div className="h-full rounded-full transition-all duration-100"
              style={{ width: `${scanPct}%`, background: scanning ? A.blue : A.green }} />
          </div>
        </div>

        {/* Model tag */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#f0f6ff", color: A.blue }}>
            SupplyChain-LLM v2.4
          </span>
          <span className="text-[10px]" style={{ color: lastConfidence ? (lastConfidence.score >= 85 ? A.green : lastConfidence.score >= 70 ? A.orange : A.red) : A.gray2 }}>
            置信度 {lastConfidence ? `${lastConfidence.score}% · ${lastConfidence.level}` : "待校准"}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#f0faf4", color: A.green }}>{externalStatus}</span>
        </div>
      </div>

      {/* Insights list */}
      <div className="flex-[1.05] overflow-auto px-4 py-3 space-y-2">
        {scanning ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-3 space-y-2 animate-pulse" style={{ background: A.gray6 }}>
              <div className="h-2.5 rounded-full w-1/3" style={{ background: A.gray4 }} />
              <div className="h-3.5 rounded-full w-2/3" style={{ background: A.gray4 }} />
              <div className="h-2 rounded-full w-full" style={{ background: A.gray5 }} />
              <div className="h-2 rounded-full w-4/5" style={{ background: A.gray5 }} />
            </div>
          ))
        ) : (
          insights.map((ins, i) => {
            const m = insightMeta[ins.type];
            const Icon = m.icon;
            const isActive = i === activeIdx;
            return (
              <button key={i} onClick={() => setActiveIdx(i)} className="w-full text-left">
                <div className="rounded-xl p-3 transition-all duration-300"
                  style={{
                    background: isActive ? m.bg : A.gray6,
                    border: `1px solid ${isActive ? m.color + "30" : "transparent"}`,
                    opacity: isActive ? 1 : 0.7,
                  }}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${m.color}20` }}>
                      <Icon size={10} style={{ color: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                          {m.label}
                        </span>
                        {ins.metric && isActive && (
                          <span className="text-[10px] font-medium px-1.5 py-px rounded-full"
                            style={{ background: `${m.color}18`, color: m.color }}>
                            {ins.metric}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold mb-1" style={{ color: A.label }}>{ins.title}</div>
                      {isActive && (
                        <div className="text-[11px] leading-relaxed" style={{ color: A.sub }}>
                          <TypewriterText text={ins.body} />
                        </div>
                      )}
                      {!isActive && (
                        <div className="text-[10px]" style={{ color: A.gray2 }}>点击查看详细分析</div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Chatbot */}
      {!scanning && (
        <div className="px-4 pt-3 pb-4" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {insights.map((_, i) => (
                <button key={i} onClick={() => setActiveIdx(i)}
                  className="rounded-full transition-all duration-300"
                  style={{ width: i === activeIdx ? 16 : 5, height: 5, background: i === activeIdx ? A.blue : A.gray4 }} />
              ))}
            </div>
            <span className="text-[10px]" style={{ color: A.gray2 }}>{activeIdx + 1} / {insights.length}</span>
          </div>
          <p className="text-[10px] mt-2 mb-3" style={{ color: A.gray2 }}>
            基于 180 天历史数据 · 实时更新 · 仅供参考
          </p>

          <div className="rounded-xl p-2.5 mb-2.5" style={{ background: A.gray6 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart2 size={11} style={{ color: A.orange }} />
                <span className="text-[11px] font-semibold" style={{ color: A.label }}>行情数据</span>
              </div>
              <button onClick={refreshMarketPrices}
                className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:bg-white flex items-center gap-1"
                style={{ color: A.blue }}>
                <RefreshCw size={10} /> {marketStatus}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {marketPrices.slice(0, 3).map((item) => {
                const up = item.direction === "up";
                const down = item.direction === "down";
                const color = up ? A.red : down ? A.green : A.gray1;
                return (
                  <button key={item.symbol}
                    onClick={() => askAi(`${item.name}今天价格是多少？对采购有什么影响？`)}
                    className="rounded-lg p-2 text-left transition-colors hover:bg-white"
                    style={{ background: A.white, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)" }}>
                    <div className="text-[10px] font-medium truncate" style={{ color: A.label }}>{item.name}</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: A.label }}>
                      {item.price.toLocaleString()}
                    </div>
                    <div className="text-[9px] flex items-center gap-0.5 mt-0.5" style={{ color }}>
                      {up ? <ArrowUpRight size={9} /> : down ? <ArrowDownRight size={9} /> : <Minus size={9} />}
                      {Math.abs(item.changePct)}%
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-[9px] mt-1.5" style={{ color: A.gray2 }}>
              UAT 样本行情 · 点击卡片生成采购影响分析
            </div>
          </div>

          <div className="rounded-xl p-2.5" style={{ background: A.gray6 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} style={{ color: A.blue }} />
                <span className="text-[11px] font-semibold" style={{ color: A.label }}>AI 助手</span>
              </div>
              <span className="text-[10px]" style={{ color: A.gray2 }}>上下文感知</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickQuestions.map((q) => (
                <button key={q} onClick={() => askAi(q)}
                  className="text-[10px] px-2 py-1 rounded-lg transition-colors hover:bg-white"
                  style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.06)" }}>
                  {q}
                </button>
              ))}
            </div>

            <div className="max-h-72 overflow-auto space-y-2 pr-1 mb-2">
              {messages.map((msg, i) => (
                <div key={`${msg.role}-${i}`} className="flex" style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed max-w-[94%]"
                    style={{
                      background: msg.role === "user" ? A.blue : A.white,
                      color: msg.role === "user" ? A.white : A.sub,
                      boxShadow: msg.role === "assistant" ? "0 0 0 0.5px rgba(0,0,0,0.06)" : "none",
                    }}>
                    {msg.content}
                    {msg.role === "assistant" && msg.confidence && (
                      <div className="mt-2 pt-2 text-[10px] leading-4" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)", color: A.gray2 }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold" style={{ color: msg.confidence.score >= 85 ? A.green : msg.confidence.score >= 70 ? A.orange : A.red }}>
                            置信度 {msg.confidence.score}% · {msg.confidence.level}
                          </span>
                          <span className="truncate">{msg.confidence.method}</span>
                        </div>
                        {msg.confidence.evidence.length > 0 && (
                          <div className="mt-1">
                            <span style={{ color: A.label }}>证据：</span>{msg.confidence.evidence.slice(0, 3).join(" · ")}
                          </div>
                        )}
                        {msg.confidence.dimensions?.length ? (
                          <div className="grid grid-cols-2 gap-1.5 mt-2">
                            {msg.confidence.dimensions.map((item) => (
                              <div key={item.key} className="rounded-lg px-2 py-1"
                                style={{ background: A.gray6, color: A.gray1 }}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{item.label}</span>
                                  <span className="font-semibold" style={{ color: item.score >= 85 ? A.green : item.score >= 70 ? A.orange : A.red }}>
                                    {item.score}%
                                  </span>
                                </div>
                                {item.warnings.length > 0 && (
                                  <div className="truncate" style={{ color: A.orange }}>{item.warnings[0]}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {msg.confidence.warnings.length > 0 && (
                          <div className="mt-1" style={{ color: A.orange }}>
                            注意：{msg.confidence.warnings.slice(0, 2).join("；")}
                          </div>
                        )}
                        <div className="mt-1">{msg.confidence.recommendedValidation}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-1.5">
              <textarea value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    askAi(input);
                  }
                }}
                placeholder="追问数据原因、风险或动作..."
                rows={3}
                className="flex-1 rounded-lg px-2.5 py-2 text-xs outline-none resize-none"
                style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)", fontFamily: "inherit" }} />
              <button onClick={() => askAi(input)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ background: input.trim() && !asking ? A.blue : A.gray3 }}>
                {asking ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Tabs (ERP module navigation) ─────────────────────────────────────────
function ReplenishmentRequestModal({
  item,
  open,
  onClose,
  onSubmit,
}: {
  item: typeof inventoryItems[number] | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (item: typeof inventoryItems[number], values: { quantity: number; requiredDate: string; reason: string }) => void;
}) {
  const plan = item ? inventoryPlan(item) : null;
  const [quantity, setQuantity] = useState(0);
  const [requiredDate, setRequiredDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!item || !plan) return;
    setQuantity(plan.suggestedQty);
    setRequiredDate(`${plan.leadTimeDays}天内`);
    setReason(`库存低于再订货点：可用 ${plan.projectedAvailable}${plan.unit}，ROP ${plan.reorderPoint}${plan.unit}，覆盖 ${plan.daysCover} 天。策略 ${plan.policy}。`);
  }, [item?.sku]);

  if (!item || !plan) return null;
  const amount = quantity * plan.unitPrice;
  const score = supplierRecommendation(plan.supplier);
  const canSubmit = quantity > 0 && !plan.needsSourcing;

  return (
    <Modal open={open} onClose={onClose} width={680}
      title="生成补货采购申请" subtitle={`${item.sku} · ${item.name}`}>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "可用库存", value: `${plan.projectedAvailable.toLocaleString()} ${plan.unit}`, color: plan.projectedAvailable <= item.min ? A.red : A.label },
          { label: "ROP", value: `${plan.reorderPoint.toLocaleString()} ${plan.unit}`, color: A.label },
          { label: "覆盖天数", value: `${plan.daysCover} 天`, color: plan.daysCover <= plan.leadTimeDays ? A.red : A.label },
          { label: "MOQ/倍量", value: `${plan.moq}/${plan.batchMultiple}`, color: A.label },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
            <div className="text-[10px]" style={{ color: A.gray2 }}>{metric.label}</div>
            <div className="text-sm font-semibold mt-1" style={{ color: metric.color }}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="建议供应商">
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: A.gray6, color: A.label }}>
            {plan.supplier} · 评分 {score.score} · {score.grade}
          </div>
        </Field>
        <Field label="采购负责人">
          <div className="rounded-lg px-3 py-2 text-xs" style={{ background: A.gray6, color: A.label }}>{plan.buyer}</div>
        </Field>
        <Field label={`申请数量 (${plan.unit}) *`}>
          <input type="number" min={1} step={plan.batchMultiple}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            style={inputStyle} />
        </Field>
        <Field label="需求日期 *">
          <input value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} style={inputStyle} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: "系统建议量", value: `${plan.suggestedQty.toLocaleString()} ${plan.unit}` },
          { label: "预估金额", value: fmt(amount) },
          { label: "优先级", value: plan.priority },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
            <div className="text-[10px]" style={{ color: A.gray2 }}>{metric.label}</div>
            <div className="text-sm font-semibold mt-1" style={{ color: metric.label === "优先级" && plan.priority === "高" ? A.red : A.label }}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Field label="申请理由 / 审批说明">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: "none", fontFamily: "inherit" }} />
        </Field>
      </div>

      {plan.needsSourcing && (
        <div className="mt-4 rounded-xl p-3 text-xs" style={{ background: "#fff8f0", color: A.label }}>
          当前 SKU 缺少有效供应商或单价，请先发起 RFQ 或维护报价后再生成 PR。
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
        <button onClick={() => onSubmit(item, { quantity, requiredDate, reason })} disabled={!canSubmit}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ background: canSubmit ? A.blue : A.gray3 }}>
          提交采购申请
        </button>
      </div>
    </Modal>
  );
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
export function OverviewPanel({
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
const SALES_ORDERS: {
  id: string; customer: string; channel: "直销" | "经销" | "电商" | "OEM";
  amount: number; items: number; createdAt: string; promiseDate: string;
  status: "草稿" | "已确认" | "拣货中" | "已发货" | "已交付" | "已关闭";
  owner: string; payTerms: string;
}[] = [
  { id: "SO-26-001824", customer: "华东工业集团",   channel: "直销", amount: 1842000, items: 14, createdAt: "2026-05-20", promiseDate: "2026-06-02", status: "已发货", owner: "张磊", payTerms: "Net 60" },
  { id: "SO-26-001825", customer: "京海科技",       channel: "经销", amount: 624500,  items:  8, createdAt: "2026-05-22", promiseDate: "2026-06-05", status: "拣货中", owner: "陈晨", payTerms: "Net 30" },
  { id: "SO-26-001826", customer: "申联电子",       channel: "电商", amount: 86420,   items:  3, createdAt: "2026-05-24", promiseDate: "2026-05-28", status: "已交付", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001827", customer: "北方机械",       channel: "OEM",  amount: 3160000, items: 22, createdAt: "2026-05-25", promiseDate: "2026-06-18", status: "已确认", owner: "张磊", payTerms: "Net 90" },
  { id: "SO-26-001828", customer: "粤海制造",       channel: "直销", amount: 945000,  items: 11, createdAt: "2026-05-26", promiseDate: "2026-06-08", status: "草稿",   owner: "陈晨", payTerms: "Net 45" },
  { id: "SO-26-001829", customer: "申联电子",       channel: "电商", amount: 28700,   items:  2, createdAt: "2026-05-26", promiseDate: "2026-05-29", status: "已发货", owner: "刘洋", payTerms: "预付" },
  { id: "SO-26-001830", customer: "通达供应链",     channel: "经销", amount: 412800,  items:  6, createdAt: "2026-05-27", promiseDate: "2026-06-10", status: "已确认", owner: "张磊", payTerms: "Net 30" },
];

const CUSTOMERS: {
  code: string; name: string; tier: "A" | "B" | "C"; channel: string;
  ar: number; credit: number; ytd: number; lastOrder: string; nps: number; risk: "正常" | "关注" | "高风险";
}[] = [
  { code: "C-1001", name: "华东工业集团",   tier: "A", channel: "直销", ar: 4820000, credit: 8000000, ytd: 28600000, lastOrder: "2026-05-20", nps: 64, risk: "正常" },
  { code: "C-1002", name: "京海科技",       tier: "A", channel: "经销", ar: 1240000, credit: 3000000, ytd: 12400000, lastOrder: "2026-05-22", nps: 58, risk: "正常" },
  { code: "C-1003", name: "北方机械",       tier: "A", channel: "OEM",  ar: 6900000, credit: 10000000, ytd: 41200000, lastOrder: "2026-05-25", nps: 71, risk: "关注" },
  { code: "C-1004", name: "申联电子",       tier: "B", channel: "电商", ar: 86000,   credit: 500000,  ytd:  2840000, lastOrder: "2026-05-26", nps: 49, risk: "正常" },
  { code: "C-1005", name: "粤海制造",       tier: "B", channel: "直销", ar: 1840000, credit: 2500000, ytd:  9620000, lastOrder: "2026-05-26", nps: 52, risk: "高风险" },
  { code: "C-1006", name: "通达供应链",     tier: "B", channel: "经销", ar: 720000,  credit: 1500000, ytd:  6480000, lastOrder: "2026-05-27", nps: 61, risk: "正常" },
  { code: "C-1007", name: "西部重工",       tier: "C", channel: "直销", ar: 124000,  credit: 800000,  ytd:  1860000, lastOrder: "2026-04-18", nps: 42, risk: "关注" },
];


const RMAS: {
  id: string; so: string; customer: string; reason: "质量问题" | "型号错发" | "客户拒收" | "运输破损" | "保修退换";
  qty: number; amount: number; status: "待审批" | "已审批" | "已收货" | "已结案"; createdAt: string;
}[] = [
  { id: "RMA-26-0142", so: "SO-26-001801", customer: "华东工业集团", reason: "质量问题", qty:  3, amount: 28400, status: "已收货", createdAt: "2026-05-18" },
  { id: "RMA-26-0143", so: "SO-26-001815", customer: "申联电子",     reason: "运输破损", qty:  1, amount:  6200, status: "已审批", createdAt: "2026-05-22" },
  { id: "RMA-26-0144", so: "SO-26-001797", customer: "京海科技",     reason: "型号错发", qty:  2, amount: 14800, status: "待审批", createdAt: "2026-05-24" },
  { id: "RMA-26-0145", so: "SO-26-001820", customer: "粤海制造",     reason: "保修退换", qty:  5, amount: 42600, status: "待审批", createdAt: "2026-05-26" },
  { id: "RMA-26-0146", so: "SO-26-001782", customer: "北方机械",     reason: "客户拒收", qty:  8, amount: 96400, status: "已结案", createdAt: "2026-05-12" },
];

const PRICE_RULES: {
  id: string; name: string; scope: string; type: "阶梯折扣" | "客户专价" | "促销价" | "渠道价" | "合同价";
  discount: string; valid: string; status: "生效中" | "待生效" | "已停用";
}[] = [
  { id: "PR-001", name: "A 类客户阶梯",        scope: "全 SKU · A 类",     type: "阶梯折扣", discount: "5% / 8% / 12%",  valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-002", name: "华东工业 OEM 年框",   scope: "OEM 系列 12 SKU",   type: "合同价",   discount: "目录价 -18%",     valid: "2026-03-01 ~ 2027-02-28", status: "生效中" },
  { id: "PR-003", name: "电商 618 大促",        scope: "电商渠道 · 全品",   type: "促销价",   discount: "限时 -22%",       valid: "2026-06-01 ~ 2026-06-20", status: "待生效" },
  { id: "PR-004", name: "经销商保护价",         scope: "经销渠道",          type: "渠道价",   discount: "目录价 -12%",     valid: "2026-01-01 ~ 2026-12-31", status: "生效中" },
  { id: "PR-005", name: "粤海制造客户专价",     scope: "C-1005 · 6 SKU",    type: "客户专价", discount: "目录价 -15%",     valid: "2026-04-15 ~ 2026-10-15", status: "生效中" },
  { id: "PR-006", name: "Q1 清仓",              scope: "EOL 系列 8 SKU",    type: "促销价",   discount: "目录价 -35%",     valid: "2026-01-15 ~ 2026-03-31", status: "已停用" },
];

// ─── Sales · Master Wrapper ───────────────────────────────────────────────────
type SalesTab = "overview" | "orders" | "customers" | "fulfillment" | "rma" | "pricing";
export function SalesPanel() {
  const [tab, setTab] = useState<SalesTab>("overview");
  const tabs = [
    { id: "overview",    label: "销售总览",     icon: BarChart2,    count: "¥7.28亿" },
    { id: "orders",      label: "销售订单",     icon: Receipt,      count: SALES_ORDERS.length },
    { id: "customers",   label: "客户主数据",   icon: Users,        count: CUSTOMERS.length },
    { id: "fulfillment", label: "履约管道",     icon: Truck,        count: FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0) },
    { id: "rma",         label: "退货 RMA",     icon: Undo2,        count: RMAS.length },
    { id: "pricing",     label: "定价规则",     icon: Tag,          count: PRICE_RULES.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as SalesTab)} />
      {tab === "overview"    && <SalesOverview />}
      {tab === "orders"      && <SalesOrders />}
      {tab === "customers"   && <SalesCustomers />}
      {tab === "fulfillment" && <SalesFulfillment />}
      {tab === "rma"         && <SalesRMA />}
      {tab === "pricing"     && <SalesPricing />}
    </div>
  );
}

function SalesOverview() {
  const [tab, setTab] = useState<"revenue" | "orders">("revenue");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度营收" value="¥7.28亿" sub="2026 YTD" delta="+18.4%" positive icon={DollarSign} color={A.blue} />
        <KpiCard label="年度订单" value="4,726" sub="完成 4,552 单" delta="+22.1%" positive icon={ShoppingCart} color={A.green} />
        <KpiCard label="综合毛利率" value="31.8%" sub="加权平均" delta="+2.4pts" positive icon={BarChart2} color={A.purple} />
        <KpiCard label="退货率" value="0.8%" sub="全年" delta="-0.2pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="col-span-2 p-5">
          <SectionHeader title="月度趋势"
            right={<SegmentedControl
              options={[{ label: "营收", value: "revenue" }, { label: "订单量", value: "orders" }]}
              value={tab} onChange={(v) => setTab(v as any)}
            />}
          />
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={salesData} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={1} />
                  <stop offset="100%" stopColor={tab === "revenue" ? A.blue : A.green} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => tab === "revenue" ? `${v / 1e4}万` : `${v}`} width={48} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)", radius: 6 }} />
              <Bar dataKey={tab} name={tab === "revenue" ? "营收" : "订单量"} fill="url(#barG)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionHeader title="TOP 5 产品" />
          <div className="space-y-4">
            {topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium w-4 shrink-0 text-center rounded-md"
                      style={{ color: A.gray1, background: A.gray6, lineHeight: "1.4rem" }}>{i + 1}</span>
                    <span className="text-xs font-medium truncate" style={{ color: A.label }}>{p.name}</span>
                  </div>
                  <span className={`text-xs font-medium flex items-center gap-0.5 shrink-0 ml-2`}
                    style={{ color: p.growth >= 0 ? A.green : A.red }}>
                    {p.growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(p.growth)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.revenue / topProducts[0].revenue) * 100}%`, background: A.blue }} />
                  </div>
                  <span className="text-[11px] shrink-0 w-14 text-right font-medium" style={{ color: A.sub }}>{fmt(p.revenue)}</span>
                </div>
                <div className="flex gap-3 mt-1 text-[10px]" style={{ color: A.gray2 }}>
                  <span>毛利 <span style={{ color: A.green }}>{p.margin}%</span></span>
                  <span>退货 <span style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</span></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售明细</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["产品名称", "年销售额", "增长率", "销售量", "毛利率", "客单价", "退货率"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topProducts.map((p, i) => (
              <tr key={p.name} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < topProducts.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{p.name}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.blue }}>{fmt(p.revenue)}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: p.growth >= 0 ? A.green : A.red }}>
                  {p.growth >= 0 ? "+" : ""}{p.growth}%
                </td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{p.units.toLocaleString()}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.green }}>{p.margin}%</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>¥{Math.round(p.revenue / p.units / 10000)}万</td>
                <td className="px-5 py-3.5" style={{ color: p.returnRate > 0.8 ? A.red : A.gray1 }}>{p.returnRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Orders ───────────────────────────────────────────────────────────
function SalesOrders() {
  const [orders, setOrders] = useState(SALES_ORDERS);
  const [filter, setFilter] = useState<"全部" | "草稿" | "已确认" | "拣货中" | "已发货" | "已交付">("全部");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ customer: "华东工业集团", channel: "直销" as const, amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });

  const filtered = filter === "全部" ? orders : orders.filter(o => o.status === filter);
  const totalValue = filtered.reduce((a, b) => a + b.amount, 0);

  const confirm = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已确认" as const } : o));
    toast.success(`订单 ${id} 已确认`, { description: "已生成销售出库建议" });
  };
  const ship = (id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "已发货" as const } : o));
    toast.success(`订单 ${id} 已发货`, { description: "已通知物流系统创建运单" });
  };
  const createSO = () => {
    const amount = Number(form.amount);
    const items = Number(form.items);
    if (!amount || !items) { toast.error("请填写金额与行项数"); return; }
    const next = `SO-26-${String(1830 + orders.length + 1).padStart(6, "0")}`;
    setOrders(prev => [{
      id: next, customer: form.customer, channel: form.channel, amount, items,
      createdAt: "2026-05-27", promiseDate: form.promiseDate, status: "草稿", owner: "陈晨", payTerms: form.payTerms,
    }, ...prev]);
    setOpenNew(false);
    setForm({ customer: "华东工业集团", channel: "直销", amount: "", items: "", promiseDate: "2026-06-15", payTerms: "Net 30" });
    toast.success(`已创建 ${next}`, { description: "草稿订单已保存,等待销售经理确认" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动订单"   value={String(orders.length)}                            sub="近 7 天" delta="+12"   positive icon={Receipt}     color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}             sub="筛选合计"                       icon={DollarSign}  color={A.green} />
        <KpiCard label="平均周期"   value="6.4 天"                                            sub="确认 → 发货" delta="-0.8d" positive icon={Clock}      color={A.purple} />
        <KpiCard label="准时交付率" value="96.2%"                                             sub="本月 OTIF" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>销售订单</h2>
            <SegmentedControl
              options={(["全部", "草稿", "已确认", "拣货中", "已发货", "已交付"] as const).map(v => ({ label: v, value: v }))}
              value={filter} onChange={(v) => setFilter(v as any)}
            />
          </div>
          <button onClick={() => setOpenNew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-90"
            style={{ background: A.blue }}>
            <Plus size={13} /> 新建销售订单
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["订单号", "客户", "渠道", "金额", "行项", "创建", "承诺交付", "付款条款", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{o.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.customer}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.channel}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(o.amount / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.items}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.createdAt}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{o.promiseDate}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{o.payTerms}</td>
                <td className="px-5 py-3"><StatusPill status={o.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    {o.status === "草稿"   && <button onClick={() => confirm(o.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>确认</button>}
                    {o.status === "已确认" && <button onClick={() => ship(o.id)}    className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>发货</button>}
                    {(o.status === "拣货中" || o.status === "已发货") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="新建销售订单" subtitle="请填写客户与基本信息" width={520}
        footer={<>
          <button onClick={() => setOpenNew(false)} className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ color: A.label, background: A.gray6 }}>取消</button>
          <button onClick={createSO} className="px-3 py-1.5 text-xs font-medium rounded-lg text-white" style={{ background: A.blue }}>创建草稿</button>
        </>}
      >
        <Field label="客户">
          <select value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }}>
            {CUSTOMERS.map(c => <option key={c.code}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="渠道">
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["直销", "经销", "电商", "OEM"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="付款条款">
            <select value={form.payTerms} onChange={(e) => setForm({ ...form, payTerms: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border outline-none" style={{ borderColor: A.gray5, background: A.white }}>
              {["预付", "Net 30", "Net 45", "Net 60", "Net 90"].map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="金额 (元)">
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="如 1840000" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
          <Field label="行项数">
            <input value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })}
              placeholder="如 12" className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
              style={{ borderColor: A.gray5, background: A.white }} />
          </Field>
        </div>
        <Field label="承诺交付日期">
          <input type="date" value={form.promiseDate} onChange={(e) => setForm({ ...form, promiseDate: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
            style={{ borderColor: A.gray5, background: A.white }} />
        </Field>
      </Modal>
    </div>
  );
}

// ─── Sales · Customers ────────────────────────────────────────────────────────
function SalesCustomers() {
  const [tier, setTier] = useState<"全部" | "A" | "B" | "C">("全部");
  const filtered = tier === "全部" ? CUSTOMERS : CUSTOMERS.filter(c => c.tier === tier);
  const totalAR = filtered.reduce((a, b) => a + b.ar, 0);
  const highRisk = filtered.filter(c => c.risk === "高风险").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活跃客户" value={String(CUSTOMERS.length)} sub="近 90 天" delta="+3" positive icon={Users} color={A.blue} />
        <KpiCard label="应收账款" value={`¥${(totalAR / 1e4).toFixed(0)}万`} sub="筛选合计" icon={Wallet} color={A.orange} />
        <KpiCard label="高风险客户" value={String(highRisk)} sub="信用预警" delta={highRisk > 0 ? "需关注" : "—"} icon={AlertTriangle} color={A.red} />
        <KpiCard label="平均 NPS" value={String(Math.round(CUSTOMERS.reduce((a, b) => a + b.nps, 0) / CUSTOMERS.length))} sub="客户口碑" delta="+4" positive icon={Sparkles} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>客户主数据</h2>
          <SegmentedControl
            options={(["全部", "A", "B", "C"] as const).map(v => ({ label: v === "全部" ? v : `${v} 级`, value: v }))}
            value={tier} onChange={(v) => setTier(v as any)}
          />
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["客户编号", "名称", "等级", "渠道", "应收账款", "授信额度", "授信占用", "YTD 销售", "最近下单", "NPS", "风险"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const util = c.ar / c.credit;
              return (
                <tr key={c.code} className="hover:bg-blue-50/40 transition-colors"
                  style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.code}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.name}</td>
                  <td className="px-5 py-3"><Chip label={c.tier} color={c.tier === "A" ? A.green : c.tier === "B" ? A.blue : A.gray1} bg={c.tier === "A" ? "rgba(52,199,89,0.1)" : c.tier === "B" ? "rgba(0,113,227,0.1)" : "rgba(142,142,147,0.1)"} /></td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.channel}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{(c.ar / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>¥{(c.credit / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, util * 100)}%`, background: util > 0.8 ? A.red : util > 0.5 ? A.orange : A.green }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: util > 0.8 ? A.red : A.label }}>{(util * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(c.ytd / 1e4).toFixed(0)}万</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{c.lastOrder}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: c.nps > 60 ? A.green : c.nps > 50 ? A.blue : A.orange }}>{c.nps}</td>
                  <td className="px-5 py-3"><StatusPill status={c.risk} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Sales · Fulfillment Pipeline ─────────────────────────────────────────────
function SalesFulfillment() {
  const total = FULFILLMENT_STAGES.reduce((a, b) => a + b.count, 0);
  const totalValue = FULFILLMENT_STAGES.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="在途订单"   value={String(total)}                                       sub="全部阶段"                       icon={Truck}       color={A.blue} />
        <KpiCard label="在途金额"   value={`¥${(totalValue / 1e4).toFixed(0)}万`}              sub="未交付合计"                     icon={DollarSign}  color={A.green} />
        <KpiCard label="平均履约时长" value="7.2 天"                                            sub="确认 → 交付" delta="-0.4d" positive icon={Clock}       color={A.purple} />
        <KpiCard label="OTIF"       value="96.2%"                                              sub="准时全量交付率" delta="+1.4pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <Card className="p-5">
        <SectionHeader title="履约阶段漏斗" right={<span className="text-xs" style={{ color: A.gray1 }}>实时</span>} />
        <div className="space-y-3 mt-2">
          {FULFILLMENT_STAGES.map((s, i) => {
            const width = (s.count / FULFILLMENT_STAGES[0].count) * 100;
            const colors = [A.gray1, A.blue, A.orange, A.purple, A.green];
            return (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: A.label }}>{s.stage}</span>
                  <span className="text-xs" style={{ color: A.sub }}>
                    <span className="font-medium" style={{ color: A.label }}>{s.count}</span> 单 · ¥{(s.value / 1e4).toFixed(0)}万
                  </span>
                </div>
                <div className="h-7 rounded-lg flex items-center px-3" style={{ width: `${Math.max(15, width)}%`, background: `${colors[i]}1a`, border: `0.5px solid ${colors[i]}33` }}>
                  <span className="text-[11px] font-medium" style={{ color: colors[i] }}>
                    {((s.count / total) * 100).toFixed(1)}% · 转化率 {i < FULFILLMENT_STAGES.length - 1 ? ((FULFILLMENT_STAGES[i + 1].count / s.count) * 100).toFixed(0) + "%" : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-5">
          <SectionHeader title="今日待发运" />
          <div className="space-y-3">
            {SALES_ORDERS.filter(o => o.status === "拣货中" || o.status === "已确认").slice(0, 4).map(o => (
              <div key={o.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: A.gray6 }}>
                <div className="min-w-0">
                  <div className="text-xs font-medium" style={{ color: A.label }}>{o.id} · {o.customer}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>承诺 {o.promiseDate} · {o.items} 行项</div>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="异常预警" />
          <div className="space-y-2">
            {[
              { label: "延迟风险订单", value: 4, color: A.red, hint: "承诺日 < 48h 且未发货" },
              { label: "缺货阻塞订单", value: 2, color: A.orange, hint: "等待补货 / 转厂" },
              { label: "信用挂起",     value: 1, color: A.purple, hint: "授信占用 > 90%" },
              { label: "待客户确认",   value: 3, color: A.blue, hint: "条款变更待客户回签" },
            ].map(x => (
              <div key={x.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: `${x.color}0d` }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: A.label }}>{x.label}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>{x.hint}</div>
                </div>
                <span className="text-lg font-semibold" style={{ color: x.color }}>{x.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · RMA ──────────────────────────────────────────────────────────────
function SalesRMA() {
  const [rmas, setRmas] = useState(RMAS);
  const approve = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已审批" as const } : r));
    toast.success(`${id} 已审批`, { description: "已通知收货部门准备入库" });
  };
  const close = (id: string) => {
    setRmas(prev => prev.map(r => r.id === id ? { ...r, status: "已结案" as const } : r));
    toast.success(`${id} 已结案`, { description: "已生成贷项凭证" });
  };

  const totalAmt = rmas.reduce((a, b) => a + b.amount, 0);
  const byReason = ["质量问题", "型号错发", "客户拒收", "运输破损", "保修退换"].map(r => ({
    reason: r, count: rmas.filter(x => x.reason === r).length,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="RMA 工单"  value={String(rmas.length)}                          sub="近 30 天"                  icon={Undo2}         color={A.orange} />
        <KpiCard label="退货金额"  value={`¥${(totalAmt / 1e4).toFixed(1)}万`}          sub="累计"                       icon={DollarSign}    color={A.red} />
        <KpiCard label="退货率"    value="0.8%"                                          sub="销售额占比" delta="-0.2pts" positive icon={TrendingUp} color={A.green} />
        <KpiCard label="待处理"    value={String(rmas.filter(r => r.status === "待审批").length)} sub="需审批"           icon={AlertCircle}   color={A.blue} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="退货原因分布" />
          <div className="space-y-2.5">
            {byReason.map(r => (
              <div key={r.reason} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: A.label }}>{r.reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                    <div className="h-full rounded-full" style={{ width: `${(r.count / rmas.length) * 100}%`, background: A.orange }} />
                  </div>
                  <span className="text-xs font-medium w-6 text-right" style={{ color: A.label }}>{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2">
          <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>RMA 明细</h2>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["RMA 单号", "客户", "原因", "数量", "金额", "状态", "操作"].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rmas.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < rmas.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.customer}</td>
                  <td className="px-5 py-3" style={{ color: A.sub }}>{r.reason}</td>
                  <td className="px-5 py-3" style={{ color: A.label }}>{r.qty}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.red }}>¥{r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {r.status === "待审批" && <button onClick={() => approve(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>审批</button>}
                      {r.status === "已收货" && <button onClick={() => close(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>结案</button>}
                      {(r.status === "已审批" || r.status === "已结案") && <span className="text-[11px]" style={{ color: A.gray1 }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

// ─── Sales · Pricing ──────────────────────────────────────────────────────────
function SalesPricing() {
  const [rules, setRules] = useState(PRICE_RULES);
  const toggle = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "生效中" ? "已停用" : "生效中" as any } : r));
    toast.success("规则状态已更新");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="价格规则"   value={String(rules.length)}                              sub="全部"                            icon={Tag}        color={A.blue} />
        <KpiCard label="生效中"     value={String(rules.filter(r => r.status === "生效中").length)} sub="实时生效"                  icon={CheckCircle2} color={A.green} />
        <KpiCard label="本月调价"   value="8"                                                  sub="新增 / 修订" delta="+3" positive icon={Activity}   color={A.purple} />
        <KpiCard label="平均折扣"   value="14.6%"                                              sub="加权"                            icon={TrendingUp} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>定价规则</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["编号", "名称", "适用范围", "类型", "折扣 / 价格", "有效期", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < rules.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.name}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.scope}</td>
                <td className="px-5 py-3"><Chip label={r.type} color={A.purple} bg="rgba(175,82,222,0.1)" /></td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{r.discount}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.valid}</td>
                <td className="px-5 py-3"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => toggle(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md"
                    style={{ color: r.status === "生效中" ? A.red : A.green, background: r.status === "生效中" ? "rgba(255,59,48,0.1)" : "rgba(52,199,89,0.1)" }}>
                    {r.status === "生效中" ? "停用" : "启用"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

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

export function ForecastPanel() {
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

export function ProcurementPanel() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="年度采购总额" value="¥3.41亿" sub="2026 YTD" delta="+9.2% YoY" positive={false} icon={DollarSign} color={A.blue} />
        <KpiCard label="活跃供应商" value="248" sub="较去年 +12 家" delta="+5.1%" positive icon={Truck} color={A.green} />
        <KpiCard label="平均交期" value="8.4天" sub="日历日" delta="-1.2天" positive icon={Clock} color={A.orange} />
        <KpiCard label="合同履约率" value="97.1%" sub="年度综合" delta="+0.8pts" positive icon={CheckCircle2} color={A.teal} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-5">
          <SectionHeader title="采购费用分布" />
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={procurementData} cx="50%" cy="50%" innerRadius={44} outerRadius={70} dataKey="amount" paddingAngle={2.5}>
                {procurementData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
              </Pie>
              <Tooltip content={<AppleTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {procurementData.map((d, i) => (
              <div key={d.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ background: pieColors[i] }} />
                  <span style={{ color: A.label }}>{d.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: d.yoy > 0 ? A.red : A.green }} className="font-medium">
                    {d.yoy > 0 ? "+" : ""}{d.yoy}%
                  </span>
                  <span className="font-medium" style={{ color: A.sub, minWidth: 48, textAlign: "right" }}>{fmt(d.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="月度支出 vs 预算"
            right={<div className="flex items-center gap-4 text-xs" style={{ color: A.sub }}>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.gray4 }} />预算</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: A.orange }} />实际</span>
            </div>}
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyProcurement} barGap={3} barSize={18} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: A.gray2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1e4}万`} width={44} />
              <Tooltip content={<AppleTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)", radius: 6 }} />
              <Bar dataKey="budget" name="预算" fill={A.gray4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="amount" name="实际" fill={A.orange} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商排名</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["#", "供应商", "品类", "年采购额", "订单数", "准时交付", "质量合格", "评级", "趋势"].map((h) => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {supplierData.map((row, i) => (
              <tr key={row.rank} className="hover:bg-blue-50/40 transition-colors"
                style={{ borderBottom: i < supplierData.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.gray2 }}>{row.rank}</td>
                <td className="px-5 py-3.5 font-medium" style={{ color: A.label }}>{row.name}</td>
                <td className="px-5 py-3.5" style={{ color: A.sub }}>{row.cat}</td>
                <td className="px-5 py-3.5 font-semibold" style={{ color: A.blue }}>{fmt(row.amount)}</td>
                <td className="px-5 py-3.5" style={{ color: A.label }}>{row.orders}</td>
                <td className="px-5 py-3.5" style={{ color: row.ontime < 95 ? A.red : A.label }}>{row.ontime}%</td>
                <td className="px-5 py-3.5" style={{ color: row.quality < 95 ? A.red : A.label }}>{row.quality}%</td>
                <td className="px-5 py-3.5">
                  <Chip
                    label={row.grade}
                    color={row.grade === "S" ? A.purple : row.grade === "A" ? A.blue : A.orange}
                    bg={row.grade === "S" ? "#f8f0ff" : row.grade === "A" ? "#f0f6ff" : "#fff8f0"}
                  />
                </td>
                <td className="px-5 py-3.5">
                  {row.trend === "up"     && <ArrowUpRight   size={14} style={{ color: A.green }} />}
                  {row.trend === "down"   && <ArrowDownRight size={14} style={{ color: A.red }}   />}
                  {row.trend === "stable" && <Minus          size={14} style={{ color: A.gray2 }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

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

type AuditEntry = {
  auditId: string;
  id?: string;
  timestamp: string;
  actor: string;
  source?: string;
  action: string;
  entityType: "purchaseRequest" | "purchaseOrder" | "rfq" | "receivingDoc" | string;
  entityId: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string;
  metadata?: Record<string, unknown>;
};

// ─── Purchasing · Master Wrapper ──────────────────────────────────────────────
type PurTab = "requests" | "orders" | "rfq" | "contracts" | "match" | "payment" | "portal";
function PurchasingPanel({ intent }: { intent: PurchaseIntent | null }) {
  const [tab, setTab] = useState<PurTab>("requests");
  const tabs = [
    { id: "requests",  label: "采购申请",   icon: ClipboardCheck },
    { id: "orders",    label: "采购订单",   icon: FileText },
    { id: "rfq",       label: "询价 RFQ",   icon: FileSpreadsheet, count: RFQS.length },
    { id: "contracts", label: "框架合同",   icon: Handshake,       count: CONTRACTS.length },
    { id: "match",     label: "三单匹配",   icon: ShieldCheck,     count: MATCH_QUEUE.length },
    { id: "payment",   label: "付款条款",   icon: CreditCard,      count: PAYABLES.length },
    { id: "portal",    label: "供应商门户", icon: Building2,       count: PORTAL_SUPPLIERS.length },
  ] as const;

  useEffect(() => {
    if (intent) setTab("requests");
  }, [intent?.createdAt]);

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as PurTab)} />
      {tab === "requests"  && <PurchasingRequests intent={intent} />}
      {tab === "orders"    && <PurchasingOrders />}
      {tab === "rfq"       && <PurchasingRFQ />}
      {tab === "contracts" && <PurchasingContracts />}
      {tab === "match"     && <PurchasingMatch />}
      {tab === "payment"   && <PurchasingPayment />}
      {tab === "portal"    && <PurchasingPortal />}
    </div>
  );
}

// ─── Purchasing · Contracts ───────────────────────────────────────────────────
function PurchasingContracts() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="活动合同"   value={String(CONTRACTS.filter(c => c.status !== "已到期").length)} sub="全部供应商" icon={Handshake} color={A.blue} />
        <KpiCard label="即将到期"   value={String(CONTRACTS.filter(c => c.status === "即将到期").length)} sub="30 天内"   icon={AlertTriangle} color={A.orange} />
        <KpiCard label="承诺总额"   value="¥1.42亿"                                                       sub="年化"        icon={DollarSign} color={A.green} />
        <KpiCard label="平均消耗率" value="58%"                                                            sub="承诺量进度"  icon={Activity}    color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>框架合同 (BPA)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["合同编号", "供应商", "范围", "承诺量", "价格条款", "起始", "到期", "消耗进度", "状态"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONTRACTS.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < CONTRACTS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{c.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{c.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.scope}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{c.commitVol}</td>
                <td className="px-5 py-3" style={{ color: A.green }}>{c.price}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{c.start}</td>
                <td className="px-5 py-3" style={{ color: c.status === "即将到期" ? A.orange : A.label }}>{c.end}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.consumed * 100)}%`, background: c.consumed > 0.9 ? A.red : c.consumed > 0.7 ? A.orange : A.green }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{(c.consumed * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Chip label={c.status} color={c.status === "执行中" ? A.green : c.status === "即将到期" ? A.orange : A.gray1}
                    bg={c.status === "执行中" ? "rgba(52,199,89,0.1)" : c.status === "即将到期" ? "rgba(255,149,0,0.1)" : "rgba(142,142,147,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · 3-Way Match ─────────────────────────────────────────────────
function PurchasingMatch() {
  const [queue, setQueue] = useState(MATCH_QUEUE);
  const resolve = (id: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: "已匹配" as const, variance: 0 } : q));
    toast.success(`${id} 差异已解决`, { description: "已生成调整凭证并通知供应商" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="匹配队列"   value={String(queue.length)}                                       sub="近 7 天"                       icon={ShieldCheck} color={A.blue} />
        <KpiCard label="完全匹配率" value={`${((queue.filter(q => q.status === "已匹配").length / queue.length) * 100).toFixed(0)}%`} sub="3-Way 通过率" delta="+4pts" positive icon={CheckCircle2} color={A.green} />
        <KpiCard label="差异总额"   value={`¥${(queue.reduce((a, b) => a + b.variance, 0) / 1e4).toFixed(1)}万`} sub="待解决"             icon={AlertOctagon} color={A.red} />
        <KpiCard label="待匹配"     value={String(queue.filter(q => q.status === "待匹配" || q.status !== "已匹配").length)} sub="需人工" icon={AlertCircle} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>三单匹配 (PO · GRN · Invoice)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["匹配号", "PO", "GRN", "发票", "供应商", "PO 金额", "GRN 金额", "发票金额", "差异", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.map((q, i) => (
              <tr key={q.id} style={{ borderBottom: i < queue.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{q.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.po}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.grn}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{q.invoice}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{q.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.poAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.grnAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3" style={{ color: A.label }}>¥{(q.invAmt / 1e4).toFixed(1)}万</td>
                <td className="px-5 py-3 font-medium" style={{ color: q.variance === 0 ? A.green : A.red }}>{q.variance === 0 ? "—" : `¥${q.variance.toLocaleString()}`}</td>
                <td className="px-5 py-3">
                  <Chip label={q.status} color={q.status === "已匹配" ? A.green : q.status === "待匹配" ? A.gray1 : A.red}
                    bg={q.status === "已匹配" ? "rgba(52,199,89,0.1)" : q.status === "待匹配" ? "rgba(142,142,147,0.1)" : "rgba(255,59,48,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {q.status !== "已匹配" && <button onClick={() => resolve(q.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>解决</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · Payment ─────────────────────────────────────────────────────
function PurchasingPayment() {
  const [payables, setPayables] = useState(PAYABLES);
  const pay = (id: string) => {
    setPayables(prev => prev.map(p => p.id === id ? { ...p, status: "已付款" as const } : p));
    toast.success(`${id} 已付款`, { description: "已生成银行付款指令" });
  };

  const totalDue = payables.filter(p => p.status !== "已付款").reduce((a, b) => a + b.amount, 0);
  const overdue  = payables.filter(p => p.status === "逾期").reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="应付总额"   value={`¥${(totalDue / 1e4).toFixed(0)}万`}    sub="未付清"                            icon={Wallet}      color={A.blue} />
        <KpiCard label="逾期金额"   value={`¥${(overdue / 1e4).toFixed(1)}万`}     sub={`${payables.filter(p => p.status === "逾期").length} 笔逾期`} icon={AlertOctagon} color={A.red} />
        <KpiCard label="7 天到期"   value="¥146万"                                  sub="3 笔"                              icon={Clock}       color={A.orange} />
        <KpiCard label="DPO"        value="48.2 天"                                 sub="应付账款周转天数" delta="+2.1d"    icon={CreditCard}  color={A.purple} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>应付账款</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["AP 编号", "供应商", "发票", "金额", "条款", "到期日", "账龄", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payables.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < payables.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.id}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{p.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.invoice}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>¥{p.amount.toLocaleString()}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.terms}</td>
                <td className="px-5 py-3" style={{ color: p.aging > 0 ? A.red : A.label }}>{p.due}</td>
                <td className="px-5 py-3 font-medium" style={{ color: p.aging > 0 ? A.red : p.aging > -7 ? A.orange : A.green }}>
                  {p.aging > 0 ? `逾期 ${p.aging} 天` : `还剩 ${Math.abs(p.aging)} 天`}
                </td>
                <td className="px-5 py-3">
                  <Chip label={p.status} color={p.status === "已付款" ? A.green : p.status === "逾期" ? A.red : p.status === "部分付款" ? A.orange : A.blue}
                    bg={p.status === "已付款" ? "rgba(52,199,89,0.1)" : p.status === "逾期" ? "rgba(255,59,48,0.1)" : p.status === "部分付款" ? "rgba(255,149,0,0.1)" : "rgba(0,113,227,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {p.status !== "已付款" && <button onClick={() => pay(p.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.green }}>付款</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Purchasing · Supplier Portal ─────────────────────────────────────────────
function PurchasingPortal() {
  const [suppliers, setSuppliers] = useState<SupplierPerformance[]>(PORTAL_SUPPLIERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiJson<SupplierPerformance[]>("/api/supplier-performance")
      .then((data) => { if (alive) setSuppliers(data); })
      .catch(() => toast.error("供应商绩效 API 未连接", { description: "已显示本地样例绩效" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const strategic = suppliers.filter(s => s.flag === "战略").length;
  const avgRating = suppliers.length ? suppliers.reduce((a, b) => a + Number(b.rating || 0), 0) / suppliers.length : 0;
  const rectifying = suppliers.filter(s => s.flag === "整改").length;
  const exceptions = suppliers.reduce((sum, item) => sum + Number(item.exceptions || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="注册供应商" value={String(suppliers.length)} sub={loading ? "加载绩效" : "活动"} icon={Building2} color={A.blue} />
        <KpiCard label="战略供应商" value={String(strategic)} sub="核心合作" icon={Handshake} color={A.purple} />
        <KpiCard label="平均评分"   value={avgRating.toFixed(1)} sub="5 分制" delta={exceptions ? `${exceptions} 起质检异常` : "+0.2"} positive={!exceptions} icon={Sparkles} color={A.green} />
        <KpiCard label="整改中"     value={String(rectifying)} sub="质量 / 交付预警" icon={AlertTriangle} color={A.red} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>供应商绩效记分卡</h2>
            <span className="text-[11px]" style={{ color: A.gray2 }}>PO + GRN 质检动态评分</span>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["供应商", "评级", "准时率", "动态合格率", "质检异常", "YTD PO", "YTD 采购额", "战略分级"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s, i) => (
              <tr key={s.name} style={{ borderBottom: i < suppliers.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>
                  <div>{s.name}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{s.category || "供应商"}{s.lastIssue ? ` · ${s.lastIssue}` : ""}</div>
                </td>
                <td className="px-5 py-3 font-medium" style={{ color: s.rating >= 4.5 ? A.green : s.rating >= 4.0 ? A.blue : A.orange }}>{Number(s.rating || 0).toFixed(1)} ★</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.onTime}%`, background: s.onTime >= 95 ? A.green : s.onTime >= 90 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.onTime}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                      <div className="h-full rounded-full" style={{ width: `${s.quality}%`, background: s.quality >= 98 ? A.green : s.quality >= 95 ? A.blue : A.orange }} />
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: A.label }}>{s.quality}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium" style={{ color: Number(s.exceptions || 0) > 0 ? A.red : A.green }}>{Number(s.exceptions || 0)} 起</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>拒收率 {Number(s.rejectRate || 0).toFixed(1)}%</div>
                </td>
                <td className="px-5 py-3" style={{ color: A.label }}>{s.po}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>¥{(s.spend / 1e4).toFixed(0)}万</td>
                <td className="px-5 py-3">
                  <Chip label={s.flag}
                    color={s.flag === "战略" ? A.purple : s.flag === "核心" ? A.blue : s.flag === "备选" ? A.gray1 : A.red}
                    bg={s.flag === "战略" ? "rgba(175,82,222,0.1)" : s.flag === "核心" ? "rgba(0,113,227,0.1)" : s.flag === "备选" ? "rgba(142,142,147,0.1)" : "rgba(255,59,48,0.1)"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── Receiving Panel ─────────────────────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  overview: "每日工作台", inventory: "库存",
  sales: "销售表现", forecast: "高级计划",
  purchaseRequests: "采购申请", purchasing: "采购订单", rfq: "供应商报价", receiving: "收货",
  procurement: "供应商与绩效",
};

function LoginScreen({ onLogin }: { onLogin: (user: DemoUser, token: string) => void }) {
  const [form, setForm] = useState({
    company: "新辰智能制造",
    name: "张磊",
    email: "zhanglei@example.com",
    role: "供应链经理",
  });
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await apiJson<{ token: string; user: DemoUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      localStorage.setItem("scm-demo-token", result.token);
      localStorage.setItem("scm-demo-user", JSON.stringify(result.user));
      onLogin(result.user, result.token);
      toast.success("登录成功，用户档案已保存");
    } catch {
      toast.error("登录失败，请检查本地 API 是否运行");
    } finally {
      setLoading(false);
    }
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: A.bg, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Toaster position="top-right" />
      <div className="w-full max-w-5xl grid grid-cols-[1.05fr_0.95fr] gap-8 items-center">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0071e3 0%, #32ade6 100%)" }}>
              <Activity size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: A.label }}>{PRODUCT_NAME}</div>
              <div className="text-sm" style={{ color: A.sub }}>{PRODUCT_TAGLINE}</div>
            </div>
          </div>

          <div>
            <h1 className="text-[38px] leading-tight font-semibold mb-4" style={{ color: A.label }}>
              把采购、入库、预测和 AI insight 放进同一个工作台。
            </h1>
            <p className="text-base leading-7 max-w-xl" style={{ color: A.sub }}>
              这是一个可交互的供应链 ERP demo。用户登录后，系统会保存用户档案，后续可以继续扩展为公司级租户、权限、审批流和真实数据库。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-xl">
            {[
              ["9", "采购订单"],
              ["6", "收货单据"],
              ["AI", "经营洞察"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl px-4 py-3" style={{ background: A.white, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="text-lg font-semibold" style={{ color: A.label }}>{value}</div>
                <div className="text-xs" style={{ color: A.gray1 }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-[20px] p-6 space-y-4"
          style={{ background: A.white, boxShadow: "0 18px 60px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-3 pb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f6ff", color: A.blue }}>
              <Lock size={16} />
            </div>
            <div>
              <div className="text-base font-semibold" style={{ color: A.label }}>进入工作台</div>
              <div className="text-xs" style={{ color: A.gray1 }}>输入用户信息，后端会保存 demo 档案</div>
            </div>
          </div>

          {([
            ["company", "公司名称"],
            ["name", "姓名"],
            ["email", "邮箱"],
            ["role", "角色"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-medium" style={{ color: A.gray1 }}>{label}</span>
              <input
                value={form[key]}
                onChange={update(key)}
                className="mt-1 w-full h-11 rounded-xl px-3 text-sm outline-none"
                style={{ background: A.gray6, color: A.label, border: "0.5px solid rgba(0,0,0,0.08)" }}
                type={key === "email" ? "email" : "text"}
                required
              />
            </label>
          ))}

          <button type="submit" disabled={loading}
            className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white disabled:opacity-70"
            style={{ background: A.blue }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
            {loading ? "正在进入" : `进入 ${PRODUCT_NAME}`}
          </button>
        </form>
      </div>
    </div>
  );
}

type PanelErrorBoundaryProps = {
  children: React.ReactNode;
  moduleLabel: string;
};

type PanelErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message || "未知错误" };
  }

  componentDidCatch(error: Error) {
    console.error("FlowChain module crashed", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Card className="p-8">
        <div className="max-w-xl">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
            style={{ background: "#fff1f0", color: A.red }}>
            <AlertTriangle size={18} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: A.label }}>
            {this.props.moduleLabel}模块加载失败
          </h2>
          <p className="text-sm leading-6 mb-5" style={{ color: A.gray1 }}>
            页面数据已经保留，当前只是这个模块渲染时遇到异常，不会退出登录。错误信息：{this.state.errorMessage}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: "" })}
            className="h-9 px-4 rounded-lg text-sm font-semibold text-white"
            style={{ background: A.blue }}>
            重新加载模块
          </button>
        </div>
      </Card>
    );
  }
}

export default function FlowChainApp() {
  const [active, setActive] = useState("overview");
  const [purchaseIntent, setPurchaseIntent] = useState<PurchaseIntent | null>(null);
  const [replenishmentSku, setReplenishmentSku] = useState<string | null>(null);
  const [aiVisible, setAiVisible] = useState(true);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("scm-demo-token") || "");
  const [user, setUser] = useState<DemoUser | null>(() => {
    try {
      const raw = localStorage.getItem("scm-demo-user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function prepareReplenishmentRequest(sku: string) {
    const item = inventoryItems.find((entry) => entry.sku === sku);
    if (!item) {
      toast.error("未找到库存 SKU", { description: sku });
      return;
    }
    const plan = inventoryPlan(item);
    if (plan.suggestedQty <= 0) {
      toast("当前无需生成 PR", { description: `${item.sku} 仍高于再订货点，建议继续监控。` });
      setActive("inventory");
      return;
    }
    if (plan.needsSourcing) {
      toast("请先补齐供应商与报价", { description: `${item.sku} 已低于 ROP，但缺少有效供应商或单价，建议先发起 RFQ。` });
      setPurchaseIntent({ sourceSku: item.sku, createdAt: Date.now() });
      setActive("purchaseRequests");
      return;
    }
    setReplenishmentSku(sku);
  }

  async function submitReplenishmentRequest(item: typeof inventoryItems[number], values: { quantity: number; requiredDate: string; reason: string }) {
    const quantity = Number(values.quantity || 0);
    if (quantity <= 0) {
      toast.error("申请数量必须大于 0");
      return;
    }
    try {
      const created = await apiJson<PurchaseRequest>("/api/purchase-requests", {
        method: "POST",
        body: JSON.stringify(inventoryPurchaseRequestPayload(item, values)),
      });
      setPurchaseIntent({ selectedPr: created.pr, sourceSku: item.sku, createdAt: Date.now() });
      setReplenishmentSku(null);
      setActive("purchaseRequests");
      toast.success(`${created.pr} 已生成`, { description: `${item.name} · ${quantity.toLocaleString()} ${created.unit}` });
    } catch (error) {
      const existing = await apiJson<PurchaseRequest[]>("/api/purchase-requests")
        .then((requests) => requests.find((request) =>
          request.source === "inventory" &&
          request.sourceSku === item.sku &&
          !["已转PO", "已驳回", "已取消"].includes(request.status)
        ))
        .catch(() => null);
      if (existing) {
        setPurchaseIntent({ selectedPr: existing.pr, sourceSku: item.sku, createdAt: Date.now() });
        setReplenishmentSku(null);
        setActive("purchaseRequests");
        toast("已有未关闭采购申请", { description: `${existing.pr} 已自动定位。` });
        return;
      }
      toast.error("补货 PR 生成失败", { description: error instanceof Error ? error.message : "请确认 API 服务正在运行" });
    }
  }

  const replenishmentItem = replenishmentSku ? inventoryItems.find((item) => item.sku === replenishmentSku) ?? null : null;

  const panels: Record<string, React.ReactNode> = {
    overview:    <OverviewPanel onNavigate={setActive} onPrepareReplenishmentRequest={prepareReplenishmentRequest} onOpenAi={() => setAiVisible(true)} />,
    inventory:   <InventoryPanel />,
    sales:       <SalesPanel />,
    forecast:    <ForecastPanel />,
    purchaseRequests: <PurchasingRequests intent={purchaseIntent} onOpenRfq={() => setActive("rfq")} />,
    purchasing:  <PurchasingOrders />,
    rfq:         <PurchasingRFQ />,
    receiving:   <ReceivingPanel />,
    procurement: <ProcurementPanel />,
  };

  function handleLogin(nextUser: DemoUser, token: string) {
    setUser(nextUser);
    setAuthToken(token);
  }

  function logout() {
    localStorage.removeItem("scm-demo-token");
    localStorage.removeItem("scm-demo-user");
    setAuthToken("");
    setUser(null);
  }

  if (!authToken || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: A.bg, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius: 14, fontSize: 12, fontFamily: "Inter", boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)" },
      }} />
      <ReplenishmentRequestModal
        open={Boolean(replenishmentItem)}
        item={replenishmentItem}
        onClose={() => setReplenishmentSku(null)}
        onSubmit={submitReplenishmentRequest}
      />

      {/* Sidebar — frosted glass, macOS-style */}
      <aside className="w-52 shrink-0 flex flex-col"
        style={{
          background: "rgba(246,246,248,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRight: "0.5px solid rgba(0,0,0,0.1)",
        }}>
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #0071e3 0%, #34aadc 100%)" }}>
              <Activity size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: A.label }}>{PRODUCT_NAME}</div>
              <div className="text-[10px]" style={{ color: A.gray1 }}>{PRODUCT_TAGLINE}</div>
            </div>
          </div>

          {/* System status pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#f0faf4" }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: A.green }} />
            <span className="text-[11px] font-medium" style={{ color: A.green }}>系统正常运行</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1.5" style={{ color: A.gray2 }}>{group.label}</div>
              <div className="space-y-0.5">
                {group.itemIds.map((itemId) => {
                  const item = navItems.find((entry) => entry.id === itemId);
                  if (!item) return null;
                  const isActive = active === item.id;
                  return (
                    <button key={item.id} onClick={() => setActive(item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                      style={isActive
                        ? { background: A.white, color: A.blue, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                        : { background: "transparent", color: A.gray1 }}>
                      <item.icon size={15} strokeWidth={isActive ? 2 : 1.8} />
                      <span className="truncate">{item.label}</span>
                      {isActive && <ChevronRight size={12} className="ml-auto shrink-0" style={{ color: A.blue }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 space-y-1">
          <button
            onClick={() => setAiVisible((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={aiVisible
              ? { background: "#f0f6ff", color: A.blue }
              : { background: "transparent", color: A.gray1 }}>
            <Sparkles size={15} strokeWidth={1.8} />
            <span>AI 助手</span>
            <div className={`ml-auto w-2 h-2 rounded-full transition-colors`}
              style={{ background: aiVisible ? A.blue : A.gray4 }} />
          </button>

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 transition-colors">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #0071e3, #34aadc)" }}>
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: A.label }}>{user.name}</div>
              <div className="text-[10px] truncate" style={{ color: A.gray2 }}>{user.role}</div>
            </div>
            <button onClick={logout} className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white"
              style={{ color: A.gray2 }}>
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-12 flex items-center justify-between px-6 shrink-0"
          style={{
            background: "rgba(246,246,248,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "0.5px solid rgba(0,0,0,0.08)",
          }}>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: A.gray2 }}>{PRODUCT_NAME}</span>
            <span style={{ color: A.gray3 }}>/</span>
            <span className="font-medium" style={{ color: A.label }}>{PAGE_LABELS[active]}</span>
            <span className="text-xs ml-2" style={{ color: A.gray2 }}>{user.company}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportModulePdf(PAGE_LABELS[active] || active, user.company)}
              className="h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors hover:bg-white"
              style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
              <Printer size={13} />
              导出 PDF
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs cursor-pointer"
              style={{ background: A.white, borderColor: "rgba(0,0,0,0.08)", color: A.gray1 }}>
              <Search size={12} />
              <span>搜索</span>
              <kbd className="ml-3 text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: A.gray5, color: A.gray1 }}>⌘K</kbd>
            </div>
            <button className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white"
              style={{ color: A.gray1 }}>
              <Bell size={15} strokeWidth={1.8} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: A.red }} />
            </button>
          </div>
        </header>

        {/* Content + AI panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <div id="module-export-scope" className="max-w-6xl mx-auto">
              <PanelErrorBoundary key={active} moduleLabel={PAGE_LABELS[active] || active}>
                {panels[active] || panels.overview}
              </PanelErrorBoundary>
            </div>
          </main>

          {aiVisible && (
            <div className="w-[480px] shrink-0 overflow-hidden flex flex-col">
              <AiPanel moduleId={active} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
