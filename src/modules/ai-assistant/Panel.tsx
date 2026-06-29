import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { fmt } from "../../lib/format";
import { A } from "../../components/ui";
import { aiDisplayMessage, looksLikeRawJson, normalizeAiCardValue, safeUnknownCardMessage, sanitizeAiMessage } from "./presentation";
import { getContextualQuickPrompts } from "./prompts";

export type ActiveContext = {
  module?: string;
  entityType?: "supplier" | "item" | "rfq" | "purchase_request" | "purchase_order";
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
  fields?: { name?: string; reason?: string }[] | Record<string, unknown> | null;
  actions?: { label?: string; kind?: string; target?: string }[];
  evidence?: { type?: string; id?: string; summary?: string }[];
  matches?: Record<string, unknown>[];
};

type AiChatResponse = {
  message?: string;
  content?: string;
  cards?: AiChatCard[];
  timingMs?: number;
  modelMs?: number;
  externalMs?: number;
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

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function textValue(value: unknown) {
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "";
  if (typeof value === "object") return "";
  if (typeof value === "string") return sanitizeAiMessage(value);
  return String(value ?? "");
}

function businessValue(label: string, value: unknown) {
  if (/金额|余额|应付|贷项|差异/.test(label) && typeof value === "number") return fmt(value);
  return textValue(normalizeAiCardValue(label, value));
}

function fieldEntries(fields: [string, unknown][]) {
  return fields.filter(([, value]) => hasValue(value));
}

function normalizeFieldPairs(fields: AiChatCard["fields"]) {
  if (Array.isArray(fields)) {
    return fields.map((field) => [field.name, field.reason] as [unknown, unknown]).filter(([name]) => hasValue(name));
  }
  if (fields && typeof fields === "object") {
    return Object.entries(fields);
  }
  return [];
}

function safeInternalTarget(target: unknown) {
  const value = String(target || "").trim();
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}

function bestText(...values: unknown[]) {
  const found = values.find(hasValue);
  return found === undefined ? "" : textValue(found);
}

function compactCandidateLabel(candidate: Record<string, unknown>) {
  return bestText(
    [candidate.supplierId, candidate.name].filter(Boolean).join(" · "),
    [candidate.itemId, candidate.sku, candidate.name].filter(Boolean).join(" · "),
    [candidate.rfqId, candidate.title].filter(Boolean).join(" · "),
    [candidate.id, candidate.label].filter(Boolean).join(" · "),
    candidate.name,
    candidate.title,
    candidate.label,
  );
}

function priorityDisplayValue(data: Record<string, unknown>) {
  return bestText(data.priorityLabel, data.priorityId, data.prioritySignal, data.prioritySource);
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function yesNoValue(value: unknown) {
  if (!hasValue(value)) return "";
  return value === true ? "是" : value === false ? "否" : textValue(value);
}

function compactProcurementList(items: unknown[], type: "pr" | "po" | "receiving" | "issue") {
  return items.map((item) => {
    const row = typeof item === "object" && item ? item as Record<string, unknown> : { value: item };
    if (type === "pr") {
      return {
        title: bestText(row.prId, row.pr, row.id, "PR"),
        reason: [row.status, row.requiredDate, row.supplier].filter(hasValue).map(textValue).join(" · "),
      };
    }
    if (type === "po") {
      return {
        title: bestText(row.poId, row.po, row.id, "PO"),
        reason: [row.supplier, row.status, row.expectedDate, row.riskLevel].filter(hasValue).map(textValue).join(" · "),
      };
    }
    if (type === "receiving") {
      return {
        title: bestText(row.receivingId, row.grn, row.id, "收货单"),
        reason: [row.poId, row.supplier, row.varianceType, row.status].filter(hasValue).map(textValue).join(" · "),
      };
    }
    return {
      title: [row.type, row.id].filter(hasValue).map(textValue).join(" · ") || bestText(row.title, row.id, "重点事项"),
      reason: bestText(row.summary, row.reason, row.status),
    };
  });
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
          <div className="text-[11px] font-medium truncate" style={{ color: A.label }}>{businessValue(label, value)}</div>
        </div>
      ))}
    </div>
  );
}

function MiniList({ items, limit = 2 }: { items: unknown[]; limit?: number }) {
  const rows = items.slice(0, limit).filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="space-y-1">
      {rows.map((item, index) => {
        const row = typeof item === "object" && item ? item as Record<string, unknown> : { value: item };
        const title = compactCandidateLabel(row) || row.title || row.rfqId || row.id || row.pr || row.value || "匹配项";
        const detail = row.reason || row.status || row.responseStatus || row.dueDate || row.riskLevel || row.summary;
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
    case "supplier_operational_summary":
      return (
        <CardShell title={card.title || textValue(data.supplierName) || "供应商运营摘要"}>
          <KeyValueGrid fields={[
            ["供应商", data.supplierName || data.supplierId],
            ["状态", data.status],
            ["风险", data.risk],
            ["评分", data.score],
            ["开放 PO", data.openPoCount],
            ["逾期 PO", data.overduePoCount],
            ["发票差异", data.invoiceIssueCount],
            ["有效合同", data.activeContractCount],
            ["库存风险", data.inventoryRiskItemCount],
            ["开放 RFQ", data.openRfqCount],
            ["下一步", data.nextAction],
          ]} />
        </CardShell>
      );
    case "supplier_related_po_summary":
      return (
        <CardShell title={card.title || "供应商 PO"}>
          <KeyValueGrid fields={[
            ["总 PO", data.totalPoCount],
            ["开放 PO", data.openPoCount],
            ["逾期 PO", data.overduePoCount],
            ["临期 PO", data.dueSoonPoCount],
          ]} />
          <MiniList items={compactProcurementList(arrayValue(data.topPurchaseOrders), "po")} limit={3} />
        </CardShell>
      );
    case "supplier_invoice_summary":
      return (
        <CardShell title={card.title || "供应商发票"}>
          <KeyValueGrid fields={[
            ["发票数", data.invoiceCount],
            ["差异数", data.invoiceVarianceCount],
            ["待复核", data.pendingReviewCount],
            ["贷项金额", data.creditMemoAmount],
            ["对账状态", data.reconciliationStatus],
          ]} />
          <MiniList items={arrayValue(data.topIssues)} limit={3} />
        </CardShell>
      );
    case "supplier_contract_summary":
      return (
        <CardShell title={card.title || "供应商合同"}>
          <KeyValueGrid fields={[
            ["有效合同", data.activeContractCount],
            ["即将到期", data.expiringContractCount],
            ["已到期", data.expiredContractCount],
          ]} />
          <MiniList items={arrayValue(data.topContracts)} limit={3} />
        </CardShell>
      );
    case "supplier_inventory_risk_summary":
      return (
        <CardShell title={card.title || "供应商库存风险"}>
          <KeyValueGrid fields={[
            ["关联物料", data.relatedItemCount],
            ["风险物料", data.inventoryRiskItemCount],
          ]} />
          <MiniList items={arrayValue(data.topRiskItems)} limit={3} />
        </CardShell>
      );
    case "supplier_rfq_summary":
      return (
        <CardShell title={card.title || "供应商 RFQ"}>
          <KeyValueGrid fields={[
            ["总 RFQ", data.totalRfqCount],
            ["开放 RFQ", data.openRfqCount],
            ["待回复", data.pendingResponseCount],
          ]} />
          <MiniList items={arrayValue(data.topRfqs)} limit={3} />
        </CardShell>
      );
    case "supplier_operational_comparison":
      return (
        <CardShell title={card.title || "供应商运营对比"}>
          <MiniList
            items={arrayValue(data.suppliers).map((supplier) => {
              const row = typeof supplier === "object" && supplier ? supplier as Record<string, unknown> : {};
              return {
                title: bestText(row.supplierName, row.supplierId),
                reason: [
                  `开放 PO ${textValue(row.openPoCount)}`,
                  `发票差异 ${textValue(row.invoiceIssueCount)}`,
                  `库存风险 ${textValue(row.inventoryRiskItemCount)}`,
                  row.nextAction,
                ].filter(hasValue).join(" · "),
              };
            })}
            limit={3}
          />
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
    case "pr_status":
      return (
        <CardShell title={card.title || "采购申请状态"}>
          <KeyValueGrid fields={[
            ["PR", data.prId],
            ["状态", data.status],
            ["申请人", data.requester],
            ["采购负责人", data.buyer],
            ["供应商", data.supplier],
            ["物料", data.sku || data.itemId],
            ["数量", data.quantity],
            ["需求日期", data.requiredDate],
            ["优先级", data.priority],
            ["金额", data.amount],
            ["关联 PO", data.linkedPo],
            ["关联 RFQ", data.linkedRfq],
            ["来源", data.source],
          ]} />
        </CardShell>
      );
    case "pr_conversion_status":
      return (
        <CardShell title={card.title || "PR 转单状态"}>
          <KeyValueGrid fields={[
            ["PR", data.prId],
            ["状态", data.status],
            ["可转 PO", yesNoValue(data.canConvert)],
            ["阻塞原因", data.blockedReason],
            ["关联 PO", data.linkedPo],
            ["关联 RFQ", data.linkedRfq],
            ["下一步", data.nextStep],
          ]} />
        </CardShell>
      );
    case "pr_conversion_summary":
      return (
        <CardShell title={card.title || "待转单采购申请"}>
          <KeyValueGrid fields={[
            ["待转 PO 的 PR", data.approvedNotConvertedCount],
            ["待审批 PR", data.pendingApprovalCount],
          ]} />
          <MiniList items={compactProcurementList(arrayValue(data.topRequests), "pr")} limit={3} />
        </CardShell>
      );
    case "po_status":
      return (
        <CardShell title={card.title || "采购订单状态"}>
          <KeyValueGrid fields={[
            ["PO", data.poId],
            ["状态", data.status],
            ["供应商", data.supplier],
            ["来源 PR", data.sourceRequest],
            ["预计日期", data.expectedDate],
            ["已逾期", yesNoValue(data.overdue)],
            ["临近到期", yesNoValue(data.dueSoon)],
            ["订单数量", data.orderedQuantity],
            ["已收数量", data.receivedQuantity],
            ["收货状态", data.receivingStatus],
            ["收货单数", data.receivingDocCount],
          ]} />
        </CardShell>
      );
    case "po_overdue_summary":
      return (
        <CardShell title={card.title || "PO 跟进摘要"}>
          <KeyValueGrid fields={[
            ["逾期 PO", data.overdueCount],
            ["临近到期", data.dueSoonCount],
          ]} />
          <MiniList items={compactProcurementList(arrayValue(data.topPurchaseOrders), "po")} limit={3} />
        </CardShell>
      );
    case "receiving_status":
      return (
        <CardShell title={card.title || "收货状态"}>
          <KeyValueGrid fields={[
            ["收货单", data.receivingId],
            ["PO", data.poId],
            ["供应商", data.supplier],
            ["状态", data.status],
            ["已收数量", data.receivedQuantity],
            ["预计数量", data.expectedQuantity],
            ["差异", data.variance],
            ["不合格数量", data.failedQuantity],
            ["是否异常", yesNoValue(data.exception)],
            ["仓库", data.warehouse],
          ]} />
        </CardShell>
      );
    case "receiving_exception_summary":
      return (
        <CardShell title={card.title || "收货异常"}>
          <KeyValueGrid fields={[
            ["异常收货", data.exceptionCount],
            ["未关闭异常", data.openExceptionCount],
          ]} />
          <MiniList items={compactProcurementList(arrayValue(data.topExceptions), "receiving")} limit={3} />
        </CardShell>
      );
    case "procurement_followup_summary":
      return (
        <CardShell title={card.title || "采购跟进摘要"}>
          <KeyValueGrid fields={[
            ["待审批 PR", data.pendingPrCount],
            ["待转 PO 的 PR", data.approvedNotConvertedPrCount],
            ["待回复 RFQ", data.pendingRfqResponseCount],
            ["逾期 PO", data.overduePoCount],
            ["收货异常", data.receivingExceptionCount],
          ]} />
          <MiniList items={compactProcurementList(arrayValue(data.topIssues), "issue")} limit={3} />
        </CardShell>
      );
    case "pr_draft":
      return (
        <CardShell title={card.title || "采购申请草稿"}>
          <KeyValueGrid fields={[
            ["物料", data.itemLabel || data.itemName || data.name || data.sku || data.itemId],
            ["数量", data.quantity],
            ["需求日期", data.requiredDate],
            ["仓库", data.warehouseId || data.defaultWarehouseId],
            ["供应商", data.preferredSupplierId || data.supplierId || data.supplier],
            ["优先级", priorityDisplayValue(data)],
            ["优先级来源", data.prioritySource],
            ["优先级置信度", data.priorityConfidence],
            ["单据状态", data.documentStatus],
            ["需要复核", (card as Record<string, unknown>).reviewRequired],
            ["状态", data.status],
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
            ["优先级", priorityDisplayValue(data)],
            ["优先级来源", data.prioritySource],
            ["优先级置信度", data.priorityConfidence],
            ["单据状态", data.documentStatus],
            ["需要复核", (card as Record<string, unknown>).reviewRequired],
            ["状态", data.status],
          ]} />
        </CardShell>
      );
    case "missing_fields":
      return (
        <CardShell title="需补充信息">
          <MiniList items={normalizeFieldPairs(card.fields).map(([name, value]) => ({ title: name, reason: value }))} />
        </CardShell>
      );
    case "confidence_summary":
      return (
        <CardShell title={card.title || "字段级置信度"}>
          <MiniList items={normalizeFieldPairs(card.fields).map(([name, value]) => ({ title: name, reason: value }))} limit={3} />
        </CardShell>
      );
    case "recommended_actions": {
      const actions = (card.actions || []).filter((action) => ["deep_link", "review", "edit"].includes(String(action.kind || "")));
      if (!actions.length) return null;
      return (
        <CardShell title="建议操作">
          <div className="flex flex-wrap gap-1.5">
            {actions.slice(0, 3).map((action) => action.kind === "deep_link" && safeInternalTarget(action.target) ? (
              <a key={`${action.label}-${action.target}`} href={safeInternalTarget(action.target)} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: A.gray6, color: A.blue }}>
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
      if (!card.evidence?.length) return null;
      return (
        <CardShell title="依据">
          <MiniList items={card.evidence.map((item) => ({ title: [item.type, item.id].filter(Boolean).join(" · "), reason: item.summary }))} limit={3} />
        </CardShell>
      );
    case "empty_state":
      return (
        <CardShell title={card.title || "暂无结果"}>
          <div className="text-[11px] leading-5" style={{ color: A.gray1 }}>
            {bestText((card as Record<string, unknown>).reason, (card as Record<string, unknown>).message, (card as Record<string, unknown>).summary, data.reason, data.message, data.summary) || "当前没有匹配结果。"}
          </div>
        </CardShell>
      );
    case "ambiguous_match":
      return (
        <CardShell title={card.title || "需要选择匹配项"}>
          <MiniList items={card.matches?.length ? card.matches : ["请提供更具体的信息。"]} limit={3} />
        </CardShell>
      );
    default:
      if (!card.type && !card.title) return null;
      return (
        <CardShell title={sanitizeAiMessage(card.title || "") || "结构化信息"}>
          <div className="text-[11px]" style={{ color: A.gray1 }}>{safeUnknownCardMessage()}</div>
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
  const [slowRequest, setSlowRequest] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestInFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const abortReasonRef = useRef<"timeout" | "superseded" | "module-change" | null>(null);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, asking]);

  useEffect(() => {
    abortReasonRef.current = "module-change";
    abortRef.current?.abort();
    abortRef.current = null;
    requestInFlightRef.current = false;
    setMessages([]);
    setInput("");
    setAsking(false);
  }, [moduleId]);

  useEffect(() => {
    return () => {
      abortReasonRef.current = "module-change";
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!asking) {
      setSlowRequest(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowRequest(true), 1500);
    return () => window.clearTimeout(timer);
  }, [asking]);

  const currentContext = cleanActiveContext(activeContext);
  const quickPrompts = getContextualQuickPrompts({ moduleId, activeContext: currentContext });
  const contextLabel = currentContext
    ? currentContext.entityLabel || currentContext.entityId
    : "";

  async function askAi(text: string) {
    const message = text.trim();
    if (!message || requestInFlightRef.current) return;

    const context = cleanActiveContext(activeContext);
    const requestStartedAt = performance.now();
    const requestId = requestSeqRef.current + 1;
    const controller = new AbortController();
    let timeoutHit = false;
    requestSeqRef.current = requestId;
    requestInFlightRef.current = true;
    abortReasonRef.current = null;
    abortRef.current?.abort();
    abortRef.current = controller;
    setAsking(true);
    setInput("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    const timeout = window.setTimeout(() => {
      timeoutHit = true;
      abortReasonRef.current = "timeout";
      controller.abort();
    }, 12000);

    try {
      const response = await apiJson<AiChatResponse>("/api/ai/chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          moduleId,
          question: message,
          message,
          ...(context ? { activeContext: context } : {}),
        }),
      });
      const rawContent = response.message || response.content || "";
      const content = aiDisplayMessage(rawContent, Boolean(response.cards?.length));
      if (looksLikeRawJson(rawContent)) console.debug("AI assistant raw content suppressed", rawContent);
      if (import.meta.env.DEV) {
        console.debug("AI assistant request completed", {
          elapsedMs: Math.round(performance.now() - requestStartedAt),
          timingMs: response.timingMs,
          modelMs: response.modelMs,
          externalMs: response.externalMs,
          cards: response.cards?.length || 0,
        });
      }
      if (requestSeqRef.current !== requestId) return;
      setMessages((current) => [
        ...current,
        { role: "assistant", content, cards: response.cards },
      ]);
    } catch (error) {
      if (requestSeqRef.current !== requestId || abortReasonRef.current === "module-change" || abortReasonRef.current === "superseded") return;
      if (import.meta.env.DEV) console.warn("AI assistant request failed", error);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: timeoutHit || abortReasonRef.current === "timeout"
            ? "AI 助手响应超时，请稍后再试。"
            : "AI 助手暂时无法连接，请稍后再试。",
        },
      ]);
    } finally {
      window.clearTimeout(timeout);
      if (requestSeqRef.current === requestId) {
        requestInFlightRef.current = false;
        abortRef.current = null;
        abortReasonRef.current = null;
        setAsking(false);
      }
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
                {contextLabel ? `当前上下文：${contextLabel}` : "基于当前页面上下文回答"}
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
                {contextLabel
                  ? `你正在查看${PAGE_LABELS[moduleId] ?? "当前页面"}，当前上下文是 ${contextLabel}。`
                  : `你正在查看${PAGE_LABELS[moduleId] ?? "当前页面"}。可以询问当前供应商、库存、采购或 RFQ 状态。`}
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
                  {slowRequest ? "正在查询业务数据..." : "正在回复"}
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => askAi(prompt)}
                  disabled={asking}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium hover:bg-slate-100"
                  style={{ background: A.gray6, color: asking ? A.gray3 : A.gray1 }}
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
                    if (!asking) askAi(input);
                  }
                }}
                disabled={asking}
                rows={2}
                placeholder="询问当前供应商、库存、采购或 RFQ 状态..."
                className="min-h-10 flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none disabled:cursor-not-allowed"
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
