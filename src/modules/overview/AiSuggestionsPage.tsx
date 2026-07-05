import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Info,
  Mail,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import { A, Card, Chip } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type { ActionDraftPreviewRequest } from "../action-drafts/ActionDraftReviewShell";

type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;

type SuggestionPriority = "high" | "medium" | "low";

type AiSuggestion = {
  id: string;
  priority: SuggestionPriority;
  title: string;
  sourceObject: string;
  impact: string;
  time: string;
  category: string;
  detail: {
    conclusion: string;
    evidence: string[];
    businessImpact: string;
    action: string;
    limitation: string;
  };
  draftRequest: ActionDraftPreviewRequest;
};

type AiDraftCard = {
  title: string;
  about: string;
  object: string;
  icon: typeof Mail;
  color: string;
  request: ActionDraftPreviewRequest;
  moduleId: string;
  focusTarget: { entityType: string; entityId: string };
};

const priorityStyles: Record<SuggestionPriority, { label: string; color: string; bg: string; dot: string }> = {
  high: { label: "高优先级", color: A.red, bg: "#fff1f0", dot: A.blue },
  medium: { label: "中优先级", color: A.orange, bg: "#fff8f0", dot: A.green },
  low: { label: "低优先级", color: A.blue, bg: "#eef4ff", dot: A.purple },
};

const summaryCards = [
  { title: "PO 建议", value: "2", tag: "到货跟进", icon: ShoppingCart, color: A.blue, bg: "#eef4ff" },
  { title: "库存建议", value: "2", tag: "可承诺复核", icon: Package, color: A.green, bg: "#ecfdf5" },
  { title: "供应商建议", value: "1", tag: "报价提醒", icon: Users, color: A.purple, bg: "#f5f3ff" },
  { title: "财务建议", value: "1", tag: "发票复核", icon: CircleDollarSign, color: A.orange, bg: "#fff7ed" },
];

const suggestions: AiSuggestion[] = [
  {
    id: "po-1282",
    priority: "high",
    title: "建议优先跟进 PO-2026-1282 到货计划",
    sourceObject: "PO-2026-1282",
    impact: "避免交付延迟与生产停线",
    time: "10 分钟前",
    category: "PO 建议",
    detail: {
      conclusion: "PO-2026-1282 的 5/25 到货计划已超期 5 天，可能导致客户交付延迟。",
      evidence: ["计划到货日：2026-05-25（已超期 5 天）", "已收货：25 / 100", "影响订单：SO-260901（交付日 2026-06-02）"],
      businessImpact: "预计影响交付订单 1 个，金额约 ¥98,300，存在交付风险。",
      action: "联系供应商确认最新到货时间；如无法按期，启动替代备货或调整交期。",
      limitation: "部分收货数据可能存在滞后，未包含线下沟通记录。",
    },
    draftRequest: {
      type: "po_followup_draft",
      title: "PO-2026-1282 到货计划跟进草稿",
      source: "overview_ai_suggestion",
      originEvidence: [{ type: "purchase_order", id: "PO-2026-1282", label: "PO-2026-1282", status: "部分到货", summary: "5/25 到货计划已超期 5 天。" }],
      payload: { poId: "PO-2026-1282", message: "请确认 PO-2026-1282 剩余未到货数量的最新 ETA，并说明是否影响 SO-260901。", reason: "到货计划超期，需人工复核后跟进。" },
    },
  },
  {
    id: "sku-00412",
    priority: "medium",
    title: "建议复核 SKU-00412 可承诺量",
    sourceObject: "SKU-00412",
    impact: "提升订单可承诺准确率",
    time: "32 分钟前",
    category: "库存建议",
    detail: {
      conclusion: "SKU-00412 可用量与近期需求存在缺口，继续承诺可能放大交付风险。",
      evidence: ["当前库存低于安全水位", "近期客户需求集中释放", "部分在途数量尚未完成入库确认"],
      businessImpact: "可承诺量偏高会影响新订单交期判断，并增加后续调拨或加急采购压力。",
      action: "复核库存、在途 PO、预留记录与未过账出库，再更新可承诺判断。",
      limitation: "未包含线下预留和供应商口头交期承诺。",
    },
    draftRequest: {
      type: "purchase_request_draft",
      title: "SKU-00412 库存复核草稿",
      source: "overview_ai_suggestion",
      originEvidence: [{ type: "inventory_item", id: "SKU-00412", label: "SKU-00412", status: "待复核", summary: "可承诺量需要人工复核。" }],
      payload: { itemIdOrSku: "SKU-00412", quantity: 20, reason: "可承诺量与近期需求存在缺口，需复核库存和在途证据。", urgency: "medium" },
    },
  },
  {
    id: "rfq-0047",
    priority: "low",
    title: "建议提醒 RFQ-26-0047 供应商报价",
    sourceObject: "RFQ-26-0047",
    impact: "防止报价滞后影响采购周期",
    time: "1 小时前",
    category: "供应商建议",
    detail: {
      conclusion: "RFQ-26-0047 仍有供应商未回复，可能影响后续比价和采购周期。",
      evidence: ["RFQ 状态：等待报价", "已报价供应商不足", "目标采购周期需要在本周内完成比价"],
      businessImpact: "若报价滞后，补货采购周期可能延长，影响关键物料到货窗口。",
      action: "提醒未报价供应商补充报价，并记录回复截止时间。",
      limitation: "供应商线下电话回复未进入系统记录。",
    },
    draftRequest: {
      type: "supplier_followup_draft",
      title: "RFQ-26-0047 报价提醒草稿",
      source: "overview_ai_suggestion",
      originEvidence: [{ type: "rfq", id: "RFQ-26-0047", label: "RFQ-26-0047", status: "等待报价", summary: "供应商报价提醒。" }],
      payload: { supplierIdOrName: "华东精工机械", relatedDocumentType: "rfq", relatedDocumentId: "RFQ-26-0047", message: "请确认 RFQ-26-0047 的报价提交时间，并补充价格、交期和有效期。", reason: "供应商报价待补充，需人工复核后跟进。" },
    },
  },
  {
    id: "inv-260421",
    priority: "medium",
    title: "建议生成发票差异复核说明",
    sourceObject: "INV-HD-260421",
    impact: "减少发票处理周期与财务风险",
    time: "2 小时前",
    category: "财务建议",
    detail: {
      conclusion: "INV-HD-260421 存在发票差异，需要采购、收货与财务共同复核。",
      evidence: ["发票金额与收货记录存在差异", "关联 PO 和 GRN 需要再次核对", "差异说明尚未形成复核记录"],
      businessImpact: "若差异未及时解释，可能延长付款准备周期，并增加对账风险。",
      action: "整理 PO、GRN、发票差异点，生成内部复核说明草稿。",
      limitation: "未包含供应商补充发票附件和线下沟通结论。",
    },
    draftRequest: {
      type: "po_followup_draft",
      title: "INV-HD-260421 发票差异复核说明草稿",
      source: "overview_ai_suggestion",
      originEvidence: [{ type: "supplier_invoice", id: "INV-HD-260421", label: "INV-HD-260421", status: "存在差异", summary: "发票差异复核。" }],
      payload: { poId: "PO-2026-1282", message: "请复核 INV-HD-260421 与关联 PO、GRN 的差异，并补充内部说明。", reason: "发票差异需人工复核。" },
    },
  },
];

const draftCards: AiDraftCard[] = [
  {
    title: "内部跟进草稿",
    about: "关于 PO-2026-1282 到货计划跟进",
    object: "PO-2026-1282",
    icon: Mail,
    color: A.blue,
    request: suggestions[0].draftRequest,
    moduleId: "procurement:orders",
    focusTarget: { entityType: "purchase_order", entityId: "PO-2026-1282" },
  },
  {
    title: "供应商提醒草稿",
    about: "关于 RFQ-26-0047 报价提醒",
    object: "RFQ-26-0047",
    icon: Users,
    color: A.purple,
    request: suggestions[2].draftRequest,
    moduleId: "procurement:rfq",
    focusTarget: { entityType: "rfq", entityId: "RFQ-26-0047" },
  },
  {
    title: "库存复核草稿",
    about: "关于 SKU-00412 可承诺量复核",
    object: "SKU-00412",
    icon: Boxes,
    color: A.green,
    request: suggestions[1].draftRequest,
    moduleId: "inventory",
    focusTarget: { entityType: "inventory_item", entityId: "SKU-00412" },
  },
];

const auditRows = [
  ["2026-05-25 09:18", "生成建议：建议优先跟进 PO-2026-1282 到货计划", "PO-2026-1282", "张磊 查看建议"],
  ["2026-05-25 08:47", "生成建议：建议复核 SKU-00412 可承诺量", "SKU-00412", "张磊 查看建议"],
  ["2026-05-25 08:31", "生成建议：建议提醒 RFQ-26-0047 供应商报价", "RFQ-26-0047", "张磊 编辑草稿"],
  ["2026-05-25 07:58", "生成建议：建议生成发票差异复核说明", "INV-HD-260421", "张磊 查看建议"],
];

function scrollButtonClass(primary = false) {
  return `inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold transition-colors ${primary ? "text-white" : "border"}`;
}

export default function AiSuggestionsPage({
  onNavigate,
  onReviewActionDraft,
}: {
  onNavigate: NavigateFn;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
}) {
  const [selectedId, setSelectedId] = useState(suggestions[0].id);
  const selected = useMemo(() => suggestions.find((item) => item.id === selectedId) || suggestions[0], [selectedId]);
  const selectedPriority = priorityStyles[selected.priority];

  function previewDraft(request: ActionDraftPreviewRequest) {
    onReviewActionDraft?.(request);
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-8 font-bold tracking-normal" style={{ color: A.label }}>AI 建议</h1>
          <div className="mt-2 inline-flex max-w-3xl items-start gap-2 rounded-md px-3 py-2 text-[13px] leading-5" style={{ background: "#eef4ff", color: A.blue }}>
            <Info size={15} className="mt-0.5 shrink-0" />
            <span>AI 仅生成解释、证据整理与行动草稿；所有动作需人工复核，不会自动审批、下单、付款或发送邮件。</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#ai-suggestions-list" className={scrollButtonClass(true)} style={{ background: A.blue }}>查看今日建议</a>
          <a href="#ai-draft-review" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看待复核草稿</a>
          <a href="#ai-audit-log" className={scrollButtonClass()} style={{ borderColor: A.border, color: A.label, background: A.white }}>查看审计记录</a>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="rounded-[20px] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: card.bg, color: card.color }}>
                  <Icon size={24} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold" style={{ color: A.label }}>{card.title}</div>
                  <div className="mt-1 text-[28px] leading-8 font-bold tabular-nums" style={{ color: A.label }}>{card.value}</div>
                  <Chip label={card.tag} color={card.color} bg={card.bg} />
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,0.9fr)_minmax(560px,1.1fr)]" id="ai-suggestions-list">
        <Card className="rounded-[20px] p-4">
          <h2 className={typography.sectionTitle} style={{ color: A.label }}>AI 建议列表</h2>
          <div className="mt-3 space-y-3">
            {suggestions.map((item) => {
              const style = priorityStyles[item.priority];
              const active = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="w-full rounded-xl border px-4 py-3 text-left transition-colors"
                  style={{ borderColor: active ? A.blue : A.border, background: active ? "#f8fbff" : A.white }}
                >
                  <div className="grid grid-cols-[12px_auto_1fr_auto_16px] items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: style.dot }} />
                    <Chip label={style.label} color={style.color} bg={style.bg} />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold" style={{ color: A.label }}>{item.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: A.sub }}>
                        <span>来源对象：<span style={{ color: A.blue }}>{item.sourceObject}</span></span>
                        <span>影响：{item.impact}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[12px]" style={{ color: A.sub }}>{item.time}</span>
                    <ArrowRight size={15} style={{ color: A.gray2 }} />
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-[20px] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className={typography.sectionTitle} style={{ color: A.label }}>建议详情</h2>
            <Chip label={selectedPriority.label} color={selectedPriority.color} bg={selectedPriority.bg} />
          </div>
          <div className="overflow-hidden rounded-xl border" style={{ borderColor: A.border }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ background: A.white, borderBottom: `1px solid ${A.border}` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: A.blue }} />
              <h3 className="text-[14px] font-semibold" style={{ color: A.label }}>{selected.title}</h3>
            </div>
            {[
              { label: "结论", icon: ClipboardCheck, body: selected.detail.conclusion, bg: "#eef4ff", color: A.blue },
              { label: "关键证据", icon: FileText, body: selected.detail.evidence, bg: "#ecfdf5", color: A.green },
              { label: "业务影响", icon: ShieldCheck, body: selected.detail.businessImpact, bg: "#fff7ed", color: A.orange },
              { label: "建议动作", icon: ArrowRight, body: selected.detail.action, bg: "#f5f3ff", color: A.purple },
              { label: "数据限制", icon: Info, body: selected.detail.limitation, bg: A.gray6, color: A.gray1 },
            ].map((row, index) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3" style={{ borderTop: index ? `1px solid ${A.border}` : "none", background: index % 2 ? "#fbfdff" : A.white }}>
                  <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: A.label }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: row.bg, color: row.color }}><Icon size={15} /></span>
                    {row.label}
                  </div>
                  <div className="text-[13px] leading-6" style={{ color: A.sub }}>
                    {Array.isArray(row.body) ? (
                      <ul className="list-disc space-y-1 pl-4">
                        {row.body.map((text) => <li key={text}>{text}</li>)}
                      </ul>
                    ) : row.body}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] leading-5" style={{ color: A.sub }}>仅生成待复核草稿，需人工确认后才可进入后续处理。</div>
            <button
              type="button"
              onClick={() => previewDraft(selected.draftRequest)}
              className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold text-white"
              style={{ background: A.blue }}
            >
              生成跟进草稿
            </button>
          </div>
        </Card>
      </section>

      <section id="ai-draft-review">
        <h2 className={`${typography.sectionTitle} mb-3`} style={{ color: A.label }}>待人工复核草稿</h2>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {draftCards.map((draft) => {
            const Icon = draft.icon;
            return (
              <Card key={draft.title} className="rounded-[20px] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${draft.color}14`, color: draft.color }}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold" style={{ color: A.label }}>{draft.title}</div>
                      <div className="mt-1 text-[12px]" style={{ color: A.sub }}>{draft.about}</div>
                      <div className="mt-1 text-[12px]" style={{ color: A.sub }}>对象：{draft.object}</div>
                    </div>
                  </div>
                  <Chip label="待复核" color={A.blue} bg="#eef4ff" />
                </div>
                <div className="mt-4 grid grid-cols-[0.8fr_0.8fr_1.5fr_1.15fr] gap-2">
                  <button type="button" onClick={() => previewDraft(draft.request)} className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>预览</button>
                  <button type="button" onClick={() => previewDraft(draft.request)} className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>编辑</button>
                  <button type="button" className="h-8 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-semibold" style={{ borderColor: A.border, color: A.label, background: A.white }}>标记无需发送</button>
                  <button
                    type="button"
                    onClick={() => onNavigate(draft.moduleId, draft.focusTarget, { returnTo: "overview:ai", entityLabel: draft.object, source: "ai" })}
                    className="h-8 whitespace-nowrap rounded-md px-1.5 text-[11px] font-semibold text-white"
                    style={{ background: A.blue }}
                  >
                    进入工作台
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="ai-audit-log">
        <h2 className={`${typography.sectionTitle} mb-3`} style={{ color: A.label }}>AI 审计记录</h2>
        <Card className="overflow-hidden rounded-[20px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead style={{ background: "#fbfdff" }}>
                <tr>
                  {["时间", "AI 动作", "来源对象", "用户操作"].map((header) => (
                    <th key={header} className="px-4 py-3 text-[12px] font-semibold" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row, index) => (
                  <tr key={row.join("-")} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row[0]}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.label }}>{row[1]}</td>
                    <td className="px-4 py-2.5 text-[13px] tabular-nums" style={{ color: A.blue }}>{row[2]}</td>
                    <td className="px-4 py-2.5 text-[13px]" style={{ color: A.sub }}>{row[3]}</td>
                    <td className="px-4 py-2.5 text-right"><ArrowRight size={15} style={{ color: A.gray2 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
