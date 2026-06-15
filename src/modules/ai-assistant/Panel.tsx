import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Eye,
  Loader2,
  Minus,
  RefreshCw,
  Send,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { A } from "../../components/ui";
import type { AiConfidence, ChatMessage, MarketPrice } from "../../types/scm";
import { AI_INSIGHTS } from "./ai-insights";

const PAGE_LABELS: Record<string, string> = {
  overview: "每日工作台", inventory: "库存",
  sales: "销售表现", forecast: "高级计划",
  purchaseRequests: "采购申请", purchasing: "采购订单", rfq: "供应商报价", receiving: "收货",
  procurement: "采购工作台",
};

const insightMeta = {
  risk:        { color: A.red,    bg: "#fff1f0", label: "风险预警", icon: AlertTriangle },
  opportunity: { color: A.green,  bg: "#f0faf4", label: "增长机会", icon: TrendingUp    },
  info:        { color: A.blue,   bg: "#f0f6ff", label: "分析洞察", icon: Eye           },
  action:      { color: A.orange, bg: "#fff8f0", label: "行动建议", icon: Zap           },
};

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

export default function AiPanel({ moduleId }: { moduleId: string }) {
  const insights = AI_INSIGHTS[moduleId] ?? [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [scanPct, setScanPct] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastConfidence, setLastConfidence] = useState<AiConfidence | null>(null);
  const [asking, setAsking] = useState(false);
  const [externalStatus, setExternalStatus] = useState("外部信号样本加载中");
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [marketStatus, setMarketStatus] = useState("行情样本加载中");
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
      .then((data) => setExternalStatus(`外部信号样本 ${data.signals.length} 条`))
      .catch(() => setExternalStatus("外部信号样本暂不可用"));
    apiJson<{ asOf: string; prices: MarketPrice[] }>("/api/market-prices")
      .then((data) => {
        setMarketPrices(data.prices);
        setMarketStatus(`行情样本 ${data.prices.length} 条`);
      })
      .catch(() => setMarketStatus("行情样本暂不可用"));
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
          ? "行情样本: "
        : `${result.provider === "doubao" ? "豆包" : "GPT"}: `;
      const timing = typeof result.timingMs === "number"
        ? `\n\n耗时 ${result.timingMs}ms · 模型 ${result.modelMs ?? "-"}ms · ${result.usedWeb ? `外部信号样本 ${result.externalMs ?? "-"}ms` : "未使用外部信号样本"}`
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
      setMarketStatus("行情样本更新中");
      const data = await apiJson<{ asOf: string; prices: MarketPrice[] }>("/api/market-prices/refresh", { method: "POST" });
      setMarketPrices(data.prices);
      setMarketStatus(`行情样本 ${data.prices.length} 条`);
      toast.success("行情样本已更新");
    } catch {
      setMarketStatus("行情样本更新失败");
      toast.error("行情样本更新失败，请检查 API");
    }
  }

  return (
    <div className="flex flex-col h-full bg-white" style={{ borderLeft: "0.5px solid rgba(0,0,0,0.1)" }}>
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
            基于 180 天历史数据 · 行情样本更新 · 仅供参考
          </p>

          <div className="rounded-xl p-2.5 mb-2.5" style={{ background: A.gray6 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart2 size={11} style={{ color: A.orange }} />
                <span className="text-[11px] font-semibold" style={{ color: A.label }}>行情样本</span>
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
              非实时市场样本 · 点击卡片生成采购影响分析
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
