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
};

type AiChatCard = {
  type?: string;
  title?: string;
  data?: Record<string, unknown>;
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

function compactCardSummary(cards: AiChatCard[] = []) {
  const first = cards.find((card) => card.type && card.type !== "evidence" && card.type !== "recommended_actions");
  if (!first) return "";
  const title = first.title ? `${first.title} · ` : "";
  return `${title}${first.type}`;
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
          message,
          ...(context ? { activeContext: context } : {}),
        }),
      });
      const summary = compactCardSummary(response.cards);
      const content = response.message || response.content || "已收到请求，但当前没有可展示的回复。";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: summary ? `${content}\n\n${summary}` : content },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "AI 助手暂时无法连接，请稍后再试。",
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
                  className="max-w-[86%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6"
                  style={{
                    background: message.role === "user" ? A.blue : A.gray6,
                    color: message.role === "user" ? A.white : A.label,
                  }}
                >
                  {message.content}
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
