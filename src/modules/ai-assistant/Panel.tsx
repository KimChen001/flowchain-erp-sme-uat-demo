import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { A } from "../../components/ui";

type ActiveContext = {
  module?: string;
  entityType?: "supplier" | "item" | "rfq" | "purchase_request";
  entityId?: string;
  entityLabel?: string;
  view?: string;
  route?: string;
};

type AiChatMessage = {
  role: "user" | "assistant";
  content: string;
  cards?: AiChatCard[];
};

type AiChatCard = {
  type?: string;
  title?: string;
  data?: Record<string, unknown>;
  fields?: { name?: string; reason?: string }[];
  actions?: { label?: string; kind?: string; target?: string }[];
  evidence?: { type?: string; id?: string; summary?: string }[];
  matches?: Record<string, unknown>[];
};

type AiChatResponse = {
  message?: string;
  content?: string;
  cards?: AiChatCard[];
};

const PAGE_LABELS: Record<string, string> = {
  overview: "每日工作台",
  inventory: "库存管理",
  forecast: "预测与 MRP",
  purchaseRequests: "采购申请",
  purchasing: "采购订单",
  rfq: "供应商报价",
  receiving: "收货",
  procurement: "采购管理",
  srm: "供应商管理",
  finance: "财务协同",
};

const QUICK_PROMPTS = ["解释当前页面", "下一步建议", "查看异常"];

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function textValue(value: unknown) {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
  return String(value ?? "");
}

function fieldEntries(fields: [string, unknown][]) {
  return fields.filter(([, value]) => hasValue(value));
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3 py-2.5 space-y-2" style={{ background: A.white, border: `1px solid ${A.border}` }}>
      <div className="text-[11px] font-semibold" style={{ color: A.label }}>{title}</div>
      {children}
    </div>
  );
}

function KeyValueGrid({ fields }: { fields: [string, unknown][] }) {
  const entries = fieldEntries(fields);
  if (!entries.length) return null;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
          <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
          <div className="text-[11px] font-medium truncate" style={{ color: A.label }}>{textValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function MiniList({ items }: { items: unknown[] }) {
  const rows = items.slice(0, 2).filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="space-y-1">
      {rows.map((item, index) => {
        const row = typeof item === "object" && item ? item as Record<string, unknown> : { value: item };
        const title = row.title || row.rfqId || row.id || row.pr || row.value;
        const detail = row.reason || row.status || row.responseStatus || row.dueDate || row.riskLevel;
        return (
          <div key={`${textValue(title)}-${index}`} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
            {hasValue(title) && <div className="text-[11px] font-medium truncate" style={{ color: A.label }}>{textValue(title)}</div>}
            {hasValue(detail) && <div className="text-[10px] truncate" style={{ color: A.gray2 }}>{textValue(detail)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function AiResponseCard({ card }: { card: AiChatCard }) {
  const data = card.data || {};
  switch (card.type) {
    case "supplier_status":
      return (
        <CardShell title={card.title || textValue(data.name) || "供应商状态"}>
          <KeyValueGrid fields={[
            ["状态", data.status],
            ["风险", data.risk],
            ["评分", data.score],
            ["未结 PO", data.openPoCount],
            ["逾期 PO", data.overduePoCount],
            ["优选", data.preferred],
          ]} />
        </CardShell>
      );
    case "inventory_status":
      return (
        <CardShell title={card.title || textValue(data.sku) || "库存状态"}>
          <KeyValueGrid fields={[
            ["物料", data.name || data.sku],
            ["可用库存", data.availableQuantity],
            ["风险", data.riskLevel],
            ["原因", data.riskReason],
            ["默认仓", data.defaultWarehouseId],
          ]} />
        </CardShell>
      );
    case "procurement_exception_summary":
      return (
        <CardShell title={card.title || "采购异常"}>
          <KeyValueGrid fields={[
            ["总数", data.totalIssueCount],
            ["逾期 PO", data.overduePoCount],
            ["待处理 PR", data.pendingPrCount],
            ["待处理 RFQ", data.pendingRfqCount],
          ]} />
          {Array.isArray(data.topIssues) && <MiniList items={data.topIssues} />}
        </CardShell>
      );
    case "rfq_status":
      return (
        <CardShell title={card.title || textValue(data.rfqId) || "RFQ 状态"}>
          <KeyValueGrid fields={[
            ["状态", data.status],
            ["供应商", data.supplierCount],
            ["已回复", data.respondedSupplierCount],
            ["待回复", data.pendingSupplierCount],
            ["截止", data.dueDate],
            ["风险", data.riskLevel],
          ]} />
        </CardShell>
      );
    case "rfq_response_summary":
      return (
        <CardShell title={card.title || "RFQ 回复"}>
          <KeyValueGrid fields={[
            ["开放 RFQ", data.totalOpenRfqs],
            ["待回复 RFQ", data.rfqsWithPendingResponses],
          ]} />
          {Array.isArray(data.topPendingRfqs) && <MiniList items={data.topPendingRfqs} />}
        </CardShell>
      );
    case "supplier_rfq_participation":
      return (
        <CardShell title={card.title || textValue(data.supplierName) || "供应商 RFQ"}>
          <KeyValueGrid fields={[
            ["供应商", data.supplierName || data.supplierId],
            ["总 RFQ", data.totalRfqs],
            ["开放 RFQ", data.openRfqs],
            ["待回复", data.pendingResponseCount],
            ["已回复", data.respondedCount],
          ]} />
          {Array.isArray(data.recentRfqs) && <MiniList items={data.recentRfqs} />}
        </CardShell>
      );
    case "pr_draft":
      return (
        <CardShell title={card.title || "采购申请草稿"}>
          <KeyValueGrid fields={[
            ["物料", data.itemName || data.name || data.sku || data.itemId],
            ["数量", data.quantity],
            ["需求日期", data.requiredDate],
            ["仓库", data.warehouseId || data.defaultWarehouseId],
            ["供应商", data.preferredSupplierId || data.supplierId || data.supplier],
            ["优先级", data.priority || data.prioritySource],
            ["状态", data.status || "draft / review required"],
          ]} />
        </CardShell>
      );
    case "rfq_draft":
      return (
        <CardShell title={card.title || "询价草稿"}>
          <KeyValueGrid fields={[
            ["物料", data.itemLabel || data.itemName || data.name || data.sku || data.itemId],
            ["数量", data.quantity],
            ["交期", data.targetDeliveryDate || data.requiredDate],
            ["候选供应商", data.supplierCandidateCount || (Array.isArray(data.supplierCandidates) ? data.supplierCandidates.length : "")],
            ["报价截止", data.quotationDeadline],
            ["状态", data.status || "draft / review required"],
          ]} />
        </CardShell>
      );
    case "missing_fields":
      return (
        <CardShell title="需补充信息">
          <MiniList items={(card.fields || []).map((field) => ({ title: field.name, reason: field.reason }))} />
        </CardShell>
      );
    case "confidence_summary":
      return (
        <CardShell title={card.title || "字段置信度"}>
          <MiniList items={(card.fields || []).map((field) => ({ title: field.name, reason: field.reason }))} />
        </CardShell>
      );
    case "recommended_actions": {
      const actions = (card.actions || []).filter((action) => ["deep_link", "review", "edit"].includes(String(action.kind || "")));
      if (!actions.length) return null;
      return (
        <CardShell title="建议操作">
          <div className="flex flex-wrap gap-1.5">
            {actions.slice(0, 3).map((action) => action.kind === "deep_link" && action.target ? (
              <a key={`${action.label}-${action.target}`} href={action.target} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: A.gray6, color: A.blue }}>
                {action.label || "打开"}
              </a>
            ) : (
              <span key={`${action.label}-${action.kind}`} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: A.gray6, color: A.gray1 }}>
                {action.label || action.kind}
              </span>
            ))}
          </div>
        </CardShell>
      );
    }
    case "evidence":
      return (
        <CardShell title="依据">
          <MiniList items={(card.evidence || []).map((item) => ({ title: [item.type, item.id].filter(Boolean).join(" · "), reason: item.summary }))} />
        </CardShell>
      );
    case "empty_state":
      return (
        <CardShell title={card.title || "暂无结果"}>
          <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>{textValue((card as Record<string, unknown>).reason)}</div>
        </CardShell>
      );
    case "ambiguous_match":
      return (
        <CardShell title={card.title || "需要选择匹配项"}>
          <MiniList items={card.matches || []} />
        </CardShell>
      );
    default:
      if (!card.type && !card.title) return null;
      return (
        <CardShell title={card.title || "结构化信息"}>
          <div className="text-[11px]" style={{ color: A.gray1 }}>{card.type || "response_card"}</div>
        </CardShell>
      );
  }
}

function AiResponseCards({ cards = [] }: { cards?: AiChatCard[] }) {
  const visibleCards = cards.filter((card) => card.type);
  if (!visibleCards.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {visibleCards.map((card, index) => (
        <AiResponseCard key={`${card.type}-${index}`} card={card} />
      ))}
    </div>
  );
}

function cleanActiveContext(context?: ActiveContext | null) {
  if (!context?.entityType || !context.entityId) return null;
  return {
    module: context.module,
    entityType: context.entityType,
    entityId: context.entityId,
    entityLabel: context.entityLabel,
    view: context.view,
    route: context.route,
  };
}

export default function FloatingAiAssistant({
  moduleId,
  activeContext,
  openSignal,
}: {
  moduleId: string;
  activeContext?: ActiveContext | null;
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, asking]);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [moduleId]);

  async function askAi(text: string) {
    const message = text.trim();
    if (!message || asking) return;

    const context = cleanActiveContext(activeContext);
    setAsking(true);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);

    try {
      const response = await apiJson<AiChatResponse>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          moduleId,
          question: message,
          message,
          ...(context ? { activeContext: context } : {}),
        }),
      });
      const content = response.message || response.content || "已收到请求，但当前没有可展示的回复。";
      setMessages((current) => [
        ...current,
        { role: "assistant", content, cards: response.cards },
      ]);
    } catch (error) {
      console.error("AI assistant request failed", error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "AI 助手暂时无法连接，请稍后再试。",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="fixed right-5 bottom-5 z-40 pointer-events-none">
      {open && (
        <div
          className="pointer-events-auto mb-3 w-[min(380px,calc(100vw-2rem))] rounded-2xl bg-white shadow-2xl overflow-hidden"
          style={{ border: `1px solid ${A.border}` }}
        >
          <div className="h-12 px-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: A.label }}>
                <Sparkles size={15} style={{ color: A.blue }} />
                AI 助手
              </div>
              <div className="text-[11px] truncate" style={{ color: A.gray2 }}>
                基于当前页面上下文回答
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100"
              style={{ color: A.gray1 }}
              aria-label="关闭 AI 助手"
            >
              <X size={15} />
            </button>
          </div>

          <div ref={scrollRef} className="h-[min(360px,52vh)] overflow-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="rounded-xl px-3 py-3 text-sm leading-6" style={{ background: A.gray6, color: A.sub }}>
                你正在查看{PAGE_LABELS[moduleId] ?? "当前页面"}。可以询问当前供应商、库存、采购或 RFQ 状态。
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-6"
                  style={{
                    background: message.role === "user" ? A.blue : A.gray6,
                    color: message.role === "user" ? A.white : A.label,
                  }}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  {message.role === "assistant" && <AiResponseCards cards={message.cards} />}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 text-sm flex items-center gap-2" style={{ background: A.gray6, color: A.gray1 }}>
                  <Loader2 size={14} className="animate-spin" />
                  正在回复
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => askAi(prompt)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium hover:bg-slate-100"
                  style={{ background: A.gray6, color: A.gray1 }}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    askAi(input);
                  }
                }}
                rows={2}
                placeholder="询问当前供应商、库存、采购或 RFQ 状态..."
                className="min-h-10 flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: A.gray6, color: A.label, fontFamily: "inherit" }}
              />
              <button
                onClick={() => askAi(input)}
                disabled={!input.trim() || asking}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:cursor-not-allowed"
                style={{ background: input.trim() && !asking ? A.blue : A.gray3 }}
                aria-label="发送"
              >
                {asking ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="pointer-events-auto h-12 rounded-full pl-4 pr-5 flex items-center gap-2 text-sm font-semibold text-white shadow-xl hover:shadow-2xl transition-shadow"
        style={{ background: A.blue }}
        aria-label="打开 AI 助手"
      >
        <MessageCircle size={18} />
        AI 助手
      </button>
    </div>
  );
}
