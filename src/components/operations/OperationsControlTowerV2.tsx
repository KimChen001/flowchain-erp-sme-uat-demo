import { AlertTriangle, ArrowUpRight, ClipboardList, FileText, Filter, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { A, Card, Chip, Modal } from "../ui";
import type { ActionDraftPreviewRequest } from "../../modules/action-drafts/ActionDraftReviewShell";
import type { OperationActionItem, OperationNavigationLink, OperationsControlTowerResponse } from "../../modules/overview/operationsControlTower";
import type { CanonicalFocusTarget } from "../../lib/evidenceLinks";

type NavigateOptions = { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown };
type NavigateFn = (moduleId: string, focusTarget?: CanonicalFocusTarget | null, options?: NavigateOptions) => void;

type Props = {
  tower: OperationsControlTowerResponse | null;
  loading: boolean;
  error?: boolean;
  onNavigate: NavigateFn;
  onReviewActionDraft?: (request: ActionDraftPreviewRequest) => void;
};

const filters = [
  { id: "all", label: "全部" },
  { id: "risk", label: "高风险" },
  { id: "procurement", label: "采购" },
  { id: "supplier", label: "供应商" },
  { id: "inventory", label: "库存" },
  { id: "finance", label: "财务协同" },
  { id: "data", label: "数据缺口" },
  { id: "draft", label: "可生成草稿" },
] as const;

function severityStyle(value?: string) {
  if (value === "risk" || value === "P0" || value === "P1") return { color: A.red, bg: "#fff1f2", label: value === "risk" ? "风险" : value };
  if (value === "warning" || value === "P2") return { color: A.orange, bg: "#fff7db", label: value === "warning" ? "提醒" : value };
  return { color: A.blue, bg: "#f0f6ff", label: value || "信息" };
}

function focusTarget(entityType?: string, entityId?: string): CanonicalFocusTarget | null {
  if (!entityType || !entityId) return null;
  return { entityType, entityId };
}

function filterItem(item: OperationActionItem, filterId: string) {
  if (filterId === "all") return true;
  if (filterId === "risk") return item.severity === "risk" || item.priority === "P0" || item.priority === "P1";
  if (filterId === "procurement") return ["po_unreceived", "rfq_pending_response", "requisition_waiting"].includes(item.category);
  if (filterId === "supplier") return item.category === "supplier_risk";
  if (filterId === "inventory") return item.category === "inventory_risk";
  if (filterId === "finance") return ["received_not_invoiced", "invoice_variance", "three_way_match_variance"].includes(item.category);
  if (filterId === "data") return item.category === "data_quality_gap";
  if (filterId === "draft") return item.reviewActions.length > 0;
  return true;
}

function navigate(onNavigate: NavigateFn, link: OperationNavigationLink) {
  onNavigate(link.moduleId, focusTarget(link.entityType, link.entityId), {
    returnTo: "overview",
    entityLabel: link.entityLabel || link.label,
    source: "operationsControlTower",
    returnContext: { sourceModule: "operationsControlTower", sourceRoute: "overview", sourceLabel: link.label, returnLabel: "返回 Operations Control Tower" },
  });
}

function draftRequest(item: OperationActionItem, action = item.reviewActions[0]): ActionDraftPreviewRequest | null {
  if (!action?.draftType) return null;
  return {
    type: action.draftType,
    title: action.draftTitle || action.label,
    source: "operations_control_tower",
    originEvidence: item.keyEvidence as unknown as Record<string, unknown>[],
    payload: {
      ...(action.payload || {}),
      reason: action.payload?.reason || action.description || item.reason,
    },
  };
}

function BoundaryText() {
  return (
    <div className="text-[10px] leading-4" style={{ color: A.gray2 }}>
      草稿预览 · 需人工复核 · 不会外发 · 不提交 · 不写入库存 · 不写入财务凭证 · 不处理资金 · 不改供应商资料
    </div>
  );
}

export function OperationsControlTowerV2({ tower, loading, error = false, onNavigate, onReviewActionDraft }: Props) {
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("all");
  const [selected, setSelected] = useState<OperationActionItem | null>(null);
  const filteredItems = useMemo(() => (tower?.items || []).filter((item) => filterItem(item, filter)), [tower, filter]);

  if (loading && !tower) {
    return (
      <Card className="p-5" data-testid="operations-control-tower-v2">
        <div className="text-sm font-semibold" style={{ color: A.label }}>Operations Control Tower 正在加载</div>
        <div className="mt-1 text-xs" style={{ color: A.sub }}>正在读取当前工作区数据。</div>
      </Card>
    );
  }
  if (error && !tower) {
    return (
      <Card className="p-5" data-testid="operations-control-tower-v2">
        <div className="text-sm font-semibold" style={{ color: A.label }}>Operations Control Tower 暂不可用</div>
        <div className="mt-1 text-xs" style={{ color: A.sub }}>可继续使用下方每日工作台。</div>
      </Card>
    );
  }
  if (!tower) return null;

  const summaryCards = [
    { label: "待处理事项", value: tower.summary.totalOpenItems, sub: tower.summary.topPriorityLabel, icon: ClipboardList, color: A.blue },
    { label: "高风险事项", value: tower.summary.riskCount, sub: "P0 / P1 优先复核", icon: AlertTriangle, color: A.red },
    { label: "逾期 / 临期事项", value: tower.summary.overdueCount, sub: "ETA 与截止日期", icon: ArrowUpRight, color: A.orange },
    { label: "可生成草稿预览", value: tower.summary.draftAvailableCount, sub: "内部复核动作", icon: FileText, color: A.green },
    { label: "数据缺口", value: tower.summary.dataGapCount, sub: "影响判断完整性", icon: Filter, color: A.purple },
    { label: "今日最高优先级", value: tower.items[0]?.priority || "—", sub: tower.items[0]?.businessObjectLabel || "暂无", icon: ShieldCheck, color: A.teal },
  ];

  return (
    <Card className="p-5" data-testid="operations-control-tower-v2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-normal" style={{ color: A.label }}>Operations Control Tower</h1>
            <Chip label="Action Inbox" color={A.blue} bg="#f0f6ff" />
            <Chip label="行动收件箱" color={A.gray1} bg={A.gray6} />
          </div>
          <p className="mt-1 text-xs" style={{ color: A.sub }}>
            今日待处理按供应商、采购、库存、财务协同和数据缺口统一排序，所有建议动作先进入内部复核。
          </p>
        </div>
        <div className="text-right text-[11px]" style={{ color: A.gray2 }}>
          {tower.dataScopeLabel}<br />{new Date(tower.generatedAt).toLocaleString("zh-CN")}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-lg border p-3" style={{ borderColor: A.border, background: A.white }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium" style={{ color: A.sub }}>{card.label}</span>
              <card.icon size={14} color={card.color} />
            </div>
            <div className="mt-2 text-xl font-semibold tabular-nums" style={{ color: card.color }}>{card.value}</div>
            <div className="mt-1 truncate text-[10px]" style={{ color: A.gray2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            data-testid={`operations-filter-${item.id}`}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={{ background: filter === item.id ? A.blue : A.gray6, color: filter === item.id ? A.white : A.label }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border" style={{ borderColor: A.border }}>
        <table className="min-w-[980px] w-full text-xs" data-testid="operations-action-inbox">
          <thead style={{ background: "#f8fafc", color: A.sub }}>
            <tr>
              {["优先级", "事项标题", "类别", "业务对象", "负责人", "到期 / 年龄", "风险等级", "关键原因", "建议下一步", "操作"].map((head) => (
                <th key={head} className="px-3 py-2 text-left font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, index) => {
              const priorityStyle = severityStyle(item.priority);
              const severity = severityStyle(item.severity);
              return (
                <tr key={item.id} style={{ borderTop: index ? `1px solid ${A.border}` : "none" }}>
                  <td className="px-3 py-2"><Chip label={priorityStyle.label} color={priorityStyle.color} bg={priorityStyle.bg} /></td>
                  <td className="px-3 py-2 font-semibold" style={{ color: A.label }}>{item.title}</td>
                  <td className="px-3 py-2" style={{ color: A.sub }}>{item.categoryLabel}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: A.blue }}>{item.businessObjectLabel}</td>
                  <td className="px-3 py-2" style={{ color: A.sub }}>{item.owner}</td>
                  <td className="px-3 py-2" style={{ color: A.sub }}>{item.dueLabel} · {item.ageLabel}</td>
                  <td className="px-3 py-2"><Chip label={severity.label} color={severity.color} bg={severity.bg} /></td>
                  <td className="px-3 py-2 max-w-[280px]" style={{ color: A.sub }}>{item.reason}</td>
                  <td className="px-3 py-2 max-w-[220px]" style={{ color: A.gray1 }}>{item.suggestedNextStep}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      data-testid="operations-action-detail-button"
                      className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                      style={{ background: "#f0f6ff", color: A.blue }}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={880}
        title={selected?.title || "Action detail"}
        subtitle={selected ? `${selected.priority} · ${selected.categoryLabel} · ${selected.businessObjectLabel}` : undefined}
      >
        {selected ? (
          <div className="space-y-4" data-testid="operations-action-detail">
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>结论</div>
              <div className="mt-1 text-xs leading-5" style={{ color: A.sub }}>{selected.title}</div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>为什么优先</div>
              <div className="mt-1 text-xs leading-5" style={{ color: A.sub }}>优先级 {selected.priority}，分值 {selected.priorityScore}。{selected.reason}</div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>关键证据</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {selected.keyEvidence.map((item) => (
                  <div key={item.id} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                    <div className="text-[11px] font-semibold" style={{ color: A.label }}>{item.entityLabel}</div>
                    <div className="mt-1 text-[11px] leading-5" style={{ color: A.sub }}>{item.summary}</div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>业务影响</div>
              <div className="mt-2 space-y-2">
                {selected.businessImpact.map((item) => (
                  <div key={`${item.area}-${item.impact}`} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                    <div className="text-[11px] font-semibold" style={{ color: A.label }}>{item.area} · {item.impact}</div>
                    <div className="mt-1 text-[11px]" style={{ color: A.sub }}>{item.explanation}</div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>建议动作</div>
              <div className="mt-1 text-xs" style={{ color: A.sub }}>{selected.suggestedNextStep}</div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>可点击跳转</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.navigationLinks.map((link) => (
                  <button
                    key={`${link.moduleId}-${link.entityId || link.label}`}
                    type="button"
                    onClick={() => {
                      navigate(onNavigate, link);
                      setSelected(null);
                    }}
                    data-testid="operations-nav-link"
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium"
                    style={{ background: "#f0f6ff", color: A.blue }}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>数据限制</div>
              <div className="mt-2 space-y-2">
                {selected.dataLimitations.map((item) => (
                  <div key={item.label} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                    <div className="text-[11px] font-semibold" style={{ color: A.label }}>{item.label}</div>
                    <div className="mt-1 text-[11px]" style={{ color: A.sub }}>{item.description}</div>
                    {item.consequence ? <div className="mt-1 text-[10px]" style={{ color: A.gray2 }}>{item.consequence}</div> : null}
                  </div>
                ))}
              </div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>内部复核 / 草稿预览</div>
              <div className="mt-2 space-y-2">
                {selected.reviewActions.map((action) => {
                  const request = draftRequest(selected, action);
                  return (
                    <div key={action.label} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                      <div className="text-[11px] font-semibold" style={{ color: A.label }}>{action.label}</div>
                      <div className="mt-1 text-[11px]" style={{ color: A.sub }}>{action.description}</div>
                      <BoundaryText />
                      {request && onReviewActionDraft ? (
                        <button
                          type="button"
                          onClick={() => onReviewActionDraft(request)}
                          data-testid="operations-draft-preview"
                          className="mt-2 rounded-md px-2.5 py-1 text-[11px] font-medium"
                          style={{ background: A.white, color: A.blue }}
                        >
                          草稿预览
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>允许动作</div>
              <div className="mt-1 text-xs" style={{ color: A.sub }}>查看相关单据、查看证据链、生成内部复核草稿、人工确认后继续。</div>
            </section>
            <section>
              <div className="text-xs font-semibold" style={{ color: A.label }}>禁止动作 / 边界</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.blockedActions.map((item) => (
                  <span key={item} className="rounded-full px-2.5 py-1 text-[10px]" style={{ background: "#fff7db", color: A.orange }}>{item}</span>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
