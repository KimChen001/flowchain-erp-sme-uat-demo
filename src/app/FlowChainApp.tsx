import React, { useState, useEffect, useMemo, useRef } from "react";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle,
  Bell, LogOut, Search, Settings, User,
  Activity, Sparkles,
  Loader2,
  ShieldCheck,
  Lock,
  X,
} from "lucide-react";
import { navGroups, navItems } from "./routes";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/constants";
import { apiJson } from "../lib/api-client";
import {
  navigationIntentFromGlobalSearchResult,
  navigationIntentFromModule,
  splitNavigationId,
  type CanonicalFocusTarget,
  type CanonicalNavigationIntent,
} from "../lib/evidenceLinks";
import { fmt } from "../lib/format";
import { A, Card, Field, inputStyle, Modal, RecoveryActions } from "../components/ui";
import { BusinessBackLink } from "../components/navigation/BusinessBackLink";
import type { WorkflowContext } from "../lib/workflowContext";
import { buildReturnContext } from "../lib/workflowContext";
import { typography } from "../components/ui/typography";
import type {
  WorkspaceUser,
  PurchaseIntent,
} from "../types/scm";
import {
  inventoryItems,
  supplierData,
} from "../data/demo-data";
import { inventoryPlan } from "../domain/inventory/planning";
import ReceivingPanel from "../modules/receiving/Page";
import InventoryPanel from "../modules/inventory/Page";
import ForecastPanel from "../modules/forecast/Page";
import OverviewPanel from "../modules/overview/Page";
import ProcurementPanel from "../modules/procurement/Page";
import FinanceWorkbench from "../modules/finance/Page";
import SrmPage from "../modules/srm/Page";
import MasterDataPage from "../modules/master-data/Page";
import AiPanel, { type ActiveContext } from "../modules/ai-assistant/Panel";
import { ActionDraftReviewShell, type ActionDraftPreview, type ActionDraftPreviewRequest, type ConfirmedActionResult } from "../modules/action-drafts/ActionDraftReviewShell";
import ReportsPanel from "../modules/reports/Page";
import ImportsPanel from "../modules/imports/Page";
import ExceptionCasesPage from "../modules/exception-cases/Page";
import SalesDemandPage from "../modules/sales/Page";
import CollaborationDraftsPage from "../modules/collaboration-drafts/Page";
import SettingsPage from "../modules/settings/Page";
import AuditHistoryPage from "../modules/audit-history/Page";
import PilotReadinessPage from "../modules/pilot-readiness/Page";
import { ReviewFirstActionWorkflowV2 } from "../components/actions/ReviewFirstActionWorkflowV2";

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

function ReplenishmentRequestModal({
  item,
  open,
  onClose,
  onPreviewDraft,
}: {
  item: typeof inventoryItems[number] | null;
  open: boolean;
  onClose: () => void;
  onPreviewDraft: (request: ActionDraftPreviewRequest) => void;
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
  const draftType = plan.needsSourcing ? "rfq_draft" : "purchase_request_draft";
  const draftLabel = plan.needsSourcing ? "预览 RFQ 草稿" : "预览 PR 草稿";
  const canPreview = quantity > 0;
  const previewDraft = () => {
    onPreviewDraft({
      type: draftType,
      title: `${item.sku} ${plan.needsSourcing ? "RFQ 草稿预览" : "补货 PR 草稿预览"}`,
      source: "inventory_replenishment",
      originEvidence: [
        {
          type: "inventory_item",
          id: item.sku,
          label: item.name,
          status: item.status,
          summary: reason,
        },
      ],
      payload: {
        itemIdOrSku: item.sku,
        quantity,
        unit: plan.unit,
        requestedDeliveryDate: requiredDate,
        reason,
        supplierIdOrName: plan.needsSourcing ? "" : plan.supplier,
        supplierSuggestion: plan.needsSourcing ? undefined : { supplierName: plan.supplier },
        severity: plan.priority,
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} width={680}
      title={plan.needsSourcing ? "补货 RFQ 草稿预览" : "补货 PR 草稿预览"} subtitle={`${item.sku} · ${item.name}`}>
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
          当前 SKU 缺少有效供应商或单价，将先进入 RFQ 草稿预览，确认能力仍保留为后续人工动作。
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
          style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>取消</button>
        <button onClick={previewDraft} disabled={!canPreview}
          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
          style={{ background: canPreview ? A.blue : A.gray3 }}>
          {draftLabel}
        </button>
      </div>
    </Modal>
  );
}

function actionDraftErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "草稿预览暂不可用，请补充上下文后重试。";
  if (/^\s*[{[]/.test(message) || /<html|stack|trace| at /i.test(message)) {
    return "当前动作需要人工复核，尚未接入草稿预览。";
  }
  return message;
}

const PAGE_LABELS: Record<string, string> = {
  overview: "每日工作台", sales: "销售需求", inventory: "库存管理",
  forecast: "预测与 MRP",
  purchaseRequests: "采购申请", purchasing: "采购订单", rfq: "供应商报价", receiving: "收货",
  procurement: "采购管理", finance: "财务协同", "master-data": "基础资料", srm: "供应商管理", reports: "报表与分析", imports: "数据接入与质量", "exception-cases": "异常处理工单", "collaboration-drafts": "协同通知草稿", "review-actions": "行动草稿与人工复核", "audit-history": "业务审计与历史", "pilot-readiness": "试点准备度", settings: "系统设置",
};

type GlobalSearchResult = {
  id: string;
  type: string;
  label: string;
  subtitle: string;
  status: string;
  moduleId: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  evidence: Array<{ label: string; value: string }>;
  score: number;
  matchedFields: string[];
};

type GlobalSearchFocus = {
  entityType: string;
  entityId: string;
  entityLabel?: string;
  source?: string;
  at: number;
};

const SEARCH_TYPE_LABELS: Record<string, string> = {
  sales_order: "客户订单",
  purchase_request: "PR",
  rfq: "RFQ",
  purchase_order: "PO",
  receiving_doc: "GRN",
  supplier_invoice: "发票",
  supplier: "供应商",
  item: "物料",
  inventory_item: "库存",
  warehouse: "仓库",
  bin: "库位",
};

const SEARCH_GROUP_LABELS: Record<string, string> = {
  sales_order: "客户订单",
  purchase_request: "采购申请",
  rfq: "RFQ / 寻源",
  purchase_order: "采购订单",
  receiving_doc: "收货单",
  supplier_invoice: "供应商发票",
  supplier: "供应商",
  item: "物料",
  inventory_item: "库存",
  warehouse: "仓库 / 库位",
};

const SEARCH_GROUP_ORDER = [
  "sales_order",
  "purchase_order",
  "purchase_request",
  "rfq",
  "supplier_invoice",
  "receiving_doc",
  "supplier",
  "item",
  "inventory_item",
  "warehouse",
];
const SEARCH_GROUP_VISIBLE_LIMIT = 5;

const FOCUS_ENTITY_LABELS: Record<string, string> = {
  customer_order: "客户订单",
  sales_order: "客户订单",
  inventory_availability: "库存可用量",
  inventory_item: "SKU",
  item: "SKU",
  sku: "SKU",
  purchase_request: "采购申请",
  rfq: "RFx",
  purchase_order: "采购订单",
  receiving_doc: "收货单",
  supplier: "供应商",
  supplier_invoice: "供应商发票",
  exception_case: "异常工单",
};

function searchGroupKey(type: string) {
  return type === "bin" ? "warehouse" : type;
}

function LoginScreen({ onLogin }: { onLogin: (user: WorkspaceUser, token: string) => void }) {
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
      const result = await apiJson<{ token: string; user: WorkspaceUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
      });
      localStorage.setItem("scm-demo-token", result.token);
      localStorage.setItem("scm-demo-user", JSON.stringify(result.user));
      onLogin(result.user, result.token);
      toast.success("登录成功，用户档案已保存");
    } catch {
      toast.error("登录失败，请检查服务连接状态");
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
              这是一个可交互的供应链协同工作台。用户登录后，系统会保存用户档案，后续可扩展公司级租户、权限边界、审批协同和业务数据服务。
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
              <div className="text-xs" style={{ color: A.gray1 }}>输入用户信息，进入 FlowChain 工作台</div>
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
  const [draftShellOpen, setDraftShellOpen] = useState(false);
  const [draftPreview, setDraftPreview] = useState<ActionDraftPreview | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [aiOpenSignal, setAiOpenSignal] = useState(0);
  const [aiActiveContext, setAiActiveContext] = useState<ActiveContext | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [searchFocus, setSearchFocus] = useState<GlobalSearchFocus | null>(null);
  const [focusReturnActive, setFocusReturnActive] = useState("overview");
  const [focusReturnContext, setFocusReturnContext] = useState<WorkflowContext | null>(null);
  const searchRef = useRef<HTMLFormElement | null>(null);
  const [unreadCount] = useState(3);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("scm-demo-token") || "");
  const [user, setUser] = useState<WorkspaceUser | null>(() => {
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
    setReplenishmentSku(sku);
  }

  const replenishmentItem = replenishmentSku ? inventoryItems.find((item) => item.sku === replenishmentSku) ?? null : null;

  const { moduleId: activeModule, viewId: activeView } = splitNavigationId(active);
  const activeModuleLabel = PAGE_LABELS[activeModule] || activeModule;
  const activeNavItem = navItems.find((item) => item.id === activeModule);
  const activeChildLabel = activeNavItem?.children?.find((item) => item.id === active)?.label;
  const contentMaxWidthClass = activeModule === "srm"
    ? "max-w-[1440px]"
    : ["overview", "reports", "imports", "review-actions", "collaboration-drafts", "audit-history", "pilot-readiness", "settings"].includes(activeModule)
      ? "max-w-[1360px]"
      : "max-w-[1320px]";
  const searchGroups = useMemo(() => {
    const grouped = new Map<string, GlobalSearchResult[]>();
    searchResults.forEach((result) => {
      const key = searchGroupKey(result.type);
      grouped.set(key, [...(grouped.get(key) || []), result]);
    });
    return Array.from(grouped.entries())
      .sort(([left], [right]) => {
        const leftIndex = SEARCH_GROUP_ORDER.indexOf(left);
        const rightIndex = SEARCH_GROUP_ORDER.indexOf(right);
        return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
      })
      .map(([type, results]) => ({
        type,
        label: SEARCH_GROUP_LABELS[type] || type,
        results: results.slice(0, SEARCH_GROUP_VISIBLE_LIMIT),
        hiddenCount: Math.max(0, results.length - SEARCH_GROUP_VISIBLE_LIMIT),
      }));
  }, [searchResults]);
  const visibleSearchResults = useMemo(() => searchGroups.flatMap((group) => group.results), [searchGroups]);

  useEffect(() => {
    setAiActiveContext((current) => {
      const contextModule = current?.module;
      const activeContextModule = activeModule === "rfq" || activeModule === "purchaseRequests" || activeModule === "purchasing"
        ? "procurement"
        : activeModule;
      if (!contextModule || contextModule === activeContextModule) return current;
      return null;
    });
  }, [activeModule]);

  useEffect(() => {
    setActiveSearchIndex(visibleSearchResults.length ? 0 : -1);
  }, [visibleSearchResults.length]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function runGlobalSearch(query = searchQuery) {
    const trimmed = query.trim();
    setSearchQuery(query);
    setSearchError("");
    if (!trimmed) {
      setSearchResults([]);
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }
    setSearchLoading(true);
    setSearchOpen(true);
    try {
      const payload = await apiJson<{ query: string; results: GlobalSearchResult[]; total: number }>(`/api/search?q=${encodeURIComponent(trimmed)}`);
      setSearchResults(payload.results);
      setActiveSearchIndex(payload.results.length ? 0 : -1);
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "搜索暂不可用");
    } finally {
      setSearchLoading(false);
    }
  }

  function applyNavigationIntent(intent: CanonicalNavigationIntent, returnContext?: WorkflowContext | null) {
    setActive(intent.activeId);
    if (intent.returnTo) setFocusReturnActive(intent.returnTo);
    if (returnContext !== undefined) setFocusReturnContext(returnContext);
    setSearchFocus(intent.focusTarget
      ? {
          ...intent.focusTarget,
          entityLabel: intent.entityLabel,
          source: intent.source,
          at: Date.now(),
        }
      : null);
  }

  function navigateTo(moduleId: string, focusTarget?: CanonicalFocusTarget | null, options: {
    returnTo?: string;
    entityLabel?: string;
    returnContext?: WorkflowContext | null;
    source?: string;
  } = {}) {
    const sourceLabel = activeChildLabel || activeModuleLabel;
    const focusLabel = focusTarget
      ? `${FOCUS_ENTITY_LABELS[focusTarget.entityType] || "业务对象"} ${focusTarget.entityId}`
      : "";
    const inferredReturnContext = focusTarget
      ? buildReturnContext({
          sourceModule: activeModule,
          sourceRoute: active,
          sourceEntityType: searchFocus?.entityType,
          sourceEntityId: searchFocus?.entityId,
          sourceLabel: searchFocus?.entityLabel || focusLabel || sourceLabel,
          originIntent: options.source || "businessNavigation",
          returnLabel: searchFocus?.entityId
            ? `返回 ${FOCUS_ENTITY_LABELS[searchFocus.entityType] || "业务对象"} ${searchFocus.entityId}`
            : options.source === "ai" || options.source === "aiRuntimeGateway"
              ? "返回 AI 结果"
              : options.source === "globalSearch"
                ? "返回全局搜索"
                : `返回${sourceLabel}`,
        })
      : null;
    applyNavigationIntent(navigationIntentFromModule(moduleId, {
      focusTarget,
      source: options.source || (focusTarget ? "evidence" : undefined),
      returnTo: options.returnTo,
      entityLabel: options.entityLabel,
    }), options.returnContext !== undefined ? options.returnContext : inferredReturnContext);
  }

  async function openActionDraftReview(request: ActionDraftPreviewRequest) {
    setDraftShellOpen(true);
    setDraftPreview(null);
    setDraftError("");
    setDraftLoading(true);
    try {
      const response = await apiJson<{ draft: ActionDraftPreview; previewOnly: boolean }>("/api/action-drafts/preview", {
        method: "POST",
        body: JSON.stringify(request),
      });
      setDraftPreview(response.draft);
      if (!response.previewOnly) setDraftError("草稿预览边界异常：接口未返回 previewOnly。");
    } catch (error) {
      setDraftError(actionDraftErrorMessage(error));
    } finally {
      setDraftLoading(false);
    }
  }

  async function saveActionDraftReview(draft: ActionDraftPreview) {
    const response = await apiJson<{ draft: ActionDraftPreview; persisted: boolean; createsBusinessDocument: boolean; requiresConfirmation: boolean }>("/api/action-drafts/save", {
      method: "POST",
      body: JSON.stringify({ draft }),
    });
    if (response.createsBusinessDocument) {
      throw new Error("保存边界异常：接口声明会创建业务单据。");
    }
    setDraftPreview(response.draft);
    toast.success("草稿已保存", { description: "仅保存待复核草稿，不会创建业务单据。" });
  }

  function confirmedActionTypeForPreview(type: string) {
    const map: Record<string, string> = {
      purchase_request_draft: "create_purchase_request",
      rfq_draft: "create_rfq",
      supplier_followup_draft: "save_supplier_followup_note",
    };
    return map[type] || "save_reviewed_draft";
  }

  async function confirmSafeActionDraft(draft: ActionDraftPreview): Promise<ConfirmedActionResult> {
    const response = await apiJson<{ createdRecordId?: string; status?: string; auditEventId?: string | null; mutatesLinkedBusinessRecords?: boolean; sideEffects?: Record<string, unknown> }>("/api/user-confirmed-actions", {
      method: "POST",
      body: JSON.stringify({
        actionType: confirmedActionTypeForPreview(draft.type),
        draftId: draft.id,
        sourceTrigger: draft.source || "action_draft_review",
        reviewedFields: draft.payload || {},
        linkedRecords: draft.originEvidence || [],
        evidenceReferences: draft.originEvidence || [],
        auditPreview: draft.auditTrail || [],
        confirm: true,
        actor: "current_user",
      }),
    });
    if (response.mutatesLinkedBusinessRecords || response.sideEffects?.issuesPo || response.sideEffects?.sendsExternalEmail) {
      throw new Error("确认边界异常：接口声明存在禁止的业务副作用。");
    }
    toast.success("安全动作已确认", { description: `${response.createdRecordId || "记录"} · ${response.status || "已保存"}` });
    return { createdRecordId: response.createdRecordId, status: response.status, auditEventId: response.auditEventId };
  }

  function clearFocus() {
    setSearchFocus(null);
    setFocusReturnContext(null);
  }

  function returnFromFocus() {
    const context = focusReturnContext;
    setActive(context?.sourceRoute || focusReturnActive || "overview");
    setSearchFocus(context?.sourceEntityId && context.sourceEntityType
      ? {
          entityType: context.sourceEntityType,
          entityId: context.sourceEntityId,
          entityLabel: context.sourceLabel,
          source: context.originIntent || "businessReturn",
          at: Date.now(),
        }
      : null);
    setFocusReturnContext(null);
  }

  function openSearchResult(result: GlobalSearchResult) {
    applyNavigationIntent(navigationIntentFromGlobalSearchResult(result, { returnTo: active }), {
      sourceModule: activeModule,
      sourceRoute: active,
      sourceLabel: activeChildLabel || activeModuleLabel,
      returnLabel: "返回全局搜索",
      originIntent: "globalSearch",
    });
    setSearchOpen(false);
    setActiveSearchIndex(-1);
  }

  const focusEntityLabel = searchFocus
    ? `${SEARCH_TYPE_LABELS[searchFocus.entityType] || searchFocus.entityType} · ${searchFocus.entityLabel || searchFocus.entityId}`
    : "";
  const focusSourceLabel = searchFocus?.source === "ai" || searchFocus?.source === "aiRuntimeGateway"
    ? "AI 助手"
    : searchFocus?.source === "globalSearch"
      ? "全局搜索"
      : searchFocus?.source === "evidenceGraph" || searchFocus?.source === "evidence"
        ? "证据链"
        : "业务跳转";
  const focusReturnHint = searchFocus?.source === "ai" || searchFocus?.source === "aiRuntimeGateway"
    ? "返回 AI 结果"
    : "可返回来源对象或返回列表";

  const panels: Record<string, React.ReactNode> = {
    overview:    <OverviewPanel initialView={activeView} onNavigate={navigateTo} onPrepareReplenishmentRequest={prepareReplenishmentRequest} onOpenAi={() => setAiOpenSignal(Date.now())} onReviewActionDraft={openActionDraftReview} />,
    sales:       <SalesDemandPage initialView={activeView as any} focus={searchFocus} onNavigate={navigateTo} onOpenAi={() => setAiOpenSignal(Date.now())} />,
    inventory:   <InventoryPanel initialView={activeView as any} focus={searchFocus} onActiveContextChange={setAiActiveContext} onReviewActionDraft={openActionDraftReview} />,
    forecast:    <ForecastPanel initialView={activeView as any} onNavigate={navigateTo} onReviewActionDraft={openActionDraftReview} />,
    // Compatibility aliases for older dashboard/report actions; sidebar uses module:view ids.
    purchaseRequests: <ProcurementPanel view="requests" intent={purchaseIntent} focus={searchFocus} onOpenRfq={() => navigateTo("procurement:rfq")} onNavigate={navigateTo} onActiveContextChange={setAiActiveContext} />,
    purchasing:  <ProcurementPanel view="orders" focus={searchFocus} onNavigate={navigateTo} />,
    rfq:         <ProcurementPanel view="rfq" focus={searchFocus} onNavigate={navigateTo} onActiveContextChange={setAiActiveContext} />,
    receiving:   <ReceivingPanel focus={searchFocus} onNavigate={navigateTo} />,
    procurement: <ProcurementPanel view={activeView as any} intent={purchaseIntent} focus={searchFocus} onOpenRfq={() => navigateTo("procurement:rfq")} onNavigate={navigateTo} onActiveContextChange={setAiActiveContext} />,
    srm: <SrmPage initialView={activeView as any} focus={searchFocus} onNavigate={navigateTo} onActiveContextChange={setAiActiveContext} />,
    "master-data": <MasterDataPage initialView={activeView as any} focus={searchFocus} onActiveContextChange={setAiActiveContext} />,
    finance:     <FinanceWorkbench initialView={activeView as any} />,
    reports:     <ReportsPanel initialView={activeView as any} onNavigate={navigateTo} />,
    imports:     <ImportsPanel initialView={activeView as any} onNavigate={navigateTo} />,
    "exception-cases": <ExceptionCasesPage onNavigate={navigateTo} />,
    "collaboration-drafts": <CollaborationDraftsPage onNavigate={navigateTo} />,
    "review-actions": <ReviewFirstActionWorkflowV2 onNavigate={navigateTo} />,
    "audit-history": <AuditHistoryPage onNavigate={navigateTo} />,
    "pilot-readiness": <PilotReadinessPage onNavigate={navigateTo} />,
    settings: <SettingsPage initialView={activeView as any} onNavigate={navigateTo} />,
  };

  function handleLogin(nextUser: WorkspaceUser, token: string) {
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
        onPreviewDraft={(request) => {
          setReplenishmentSku(null);
          openActionDraftReview(request);
        }}
      />

      <aside className="w-56 shrink-0 flex flex-col"
        style={{
          background: A.sidebar,
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}>
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: A.blue }}>
              <Activity size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none text-white">{PRODUCT_NAME}</div>
              <div className="text-[10px] mt-1" style={{ color: A.sidebarSub }}>{PRODUCT_TAGLINE}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-2" style={{ color: "rgba(148,163,184,0.58)" }}>{group.label}</div>
              <div className="space-y-0.5">
                {group.itemIds.map((itemId) => {
                  const item = navItems.find((entry) => entry.id === itemId);
                  if (!item) return null;
                  const isActive = activeModule === item.id;
                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button onClick={() => navigateTo(item.id)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors duration-150"
                        style={isActive
                          ? { background: A.sidebarAccent, color: "#f8fafc" }
                          : { background: "transparent", color: A.sidebarSub }}>
                        <item.icon size={15} strokeWidth={isActive ? 2 : 1.8} />
                        <span className="truncate">{item.label}</span>
                      </button>
                      {isActive && item.children && (
                        <div className="ml-4 pl-3 py-1 space-y-0.5" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
                          {item.children.map((child) => {
                            const childActive = active === child.id || (active === item.id && child.id === item.id);
                            return (
                              <button key={child.id} onClick={() => navigateTo(child.id)}
                                className="w-full text-left px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
                                style={childActive
                                  ? { background: "rgba(37,99,235,0.16)", color: "#bfdbfe" }
                                  : { background: "transparent", color: A.sidebarSub }}>
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setAiOpenSignal(Date.now())}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors duration-150"
            style={{ background: "transparent", color: A.sidebarSub }}>
            <Sparkles size={15} strokeWidth={1.8} />
            <span>AI 助手</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-12 flex items-center justify-between px-6 shrink-0 bg-white"
          style={{
            borderBottom: `1px solid ${A.border}`,
          }}>
          <div className="flex items-center gap-2 text-sm">
            <span style={{ color: A.gray2 }}>{PRODUCT_NAME}</span>
            <span style={{ color: A.gray3 }}>/</span>
            <span className="font-medium" style={{ color: A.label }}>{activeModuleLabel}</span>
            {activeChildLabel && activeChildLabel !== activeModuleLabel && (
              <>
                <span style={{ color: A.gray3 }}>/</span>
                <span className="font-medium" style={{ color: A.label }}>{activeChildLabel}</span>
              </>
            )}
            <span className="text-xs ml-2" style={{ color: A.gray2 }}>{user.company}</span>
          </div>
          <div className="flex items-center gap-2">
            <form ref={searchRef} onSubmit={(event) => { event.preventDefault(); runGlobalSearch(); }}
              className="relative hidden sm:block">
              <div className="flex items-center gap-2 w-72 px-3 py-1.5 rounded-lg text-xs"
                style={{ color: A.gray1, background: A.gray6 }}>
                <button type="submit" className="shrink-0" aria-label="搜索业务记录">
                  {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    if (!event.target.value.trim()) {
                      setSearchResults([]);
                      setSearchOpen(false);
                    }
                  }}
                  onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchOpen(false);
                      return;
                    }
                    if (!searchOpen || visibleSearchResults.length === 0) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveSearchIndex((current) => (current + 1 + visibleSearchResults.length) % visibleSearchResults.length);
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveSearchIndex((current) => (current - 1 + visibleSearchResults.length) % visibleSearchResults.length);
                      return;
                    }
                    if (event.key === "Enter" && activeSearchIndex >= 0) {
                      event.preventDefault();
                      openSearchResult(visibleSearchResults[activeSearchIndex]);
                    }
                  }}
                  placeholder="搜索业务记录"
                  className="w-full bg-transparent outline-none text-xs"
                  style={{ color: A.label }}
                />
                {searchQuery && (
                  <button type="button" aria-label="清空搜索"
                    onClick={() => { setSearchQuery(""); setSearchResults([]); setSearchOpen(false); setSearchError(""); }}
                    className="shrink-0">
                    <X size={13} />
                  </button>
                )}
              </div>
              {searchOpen && (
                <div className="absolute right-0 top-full mt-2 w-[420px] rounded-xl shadow-xl z-30 overflow-hidden"
                  style={{ background: A.white, border: `1px solid ${A.border}` }}>
                  <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
                    <span className={typography.searchResultTitle} style={{ color: A.label }}>搜索结果</span>
                    <span className={typography.searchResultMeta} style={{ color: A.gray2 }}>{searchLoading ? "搜索中..." : `${searchResults.length} 条`}</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {searchLoading && (
                      <div className="px-4 py-6 text-xs flex items-center gap-2" style={{ color: A.gray1 }}>
                        <Loader2 size={14} className="animate-spin" /> 搜索中...
                      </div>
                    )}
                    {!searchLoading && searchError && (
                      <div className="px-4 py-6 text-xs" style={{ color: A.red }}>{searchError}</div>
                    )}
                    {!searchLoading && !searchError && searchResults.length === 0 && (
                      <div className="px-4 py-6 text-xs" style={{ color: A.gray2 }}>未找到匹配的业务记录</div>
                    )}
                    {!searchLoading && !searchError && searchGroups.length > 0 && (() => {
                      let rowIndex = -1;
                      return searchGroups.map((group) => (
                        <div key={group.type}>
                          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-normal" style={{ color: A.gray2 }}>
                            {group.label}
                          </div>
                          {group.results.map((result) => {
                            rowIndex += 1;
                            const activeResult = rowIndex === activeSearchIndex;
                            const hint = result.evidence?.[0]
                              ? `${result.evidence[0].label}: ${result.evidence[0].value}`
                              : result.matchedFields.slice(0, 2).join(" / ");
                            return (
                              <button key={result.id} type="button" onClick={() => openSearchResult(result)}
                                aria-selected={activeResult}
                                className="w-full text-left px-3 py-3 transition-colors"
                                style={{
                                  borderBottom: `1px solid ${A.border}`,
                                  background: activeResult ? "#eef4ff" : "transparent",
                                }}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: activeResult ? A.white : "#eef4ff", color: A.blue }}>
                                        {SEARCH_TYPE_LABELS[result.type] || result.type}
                                      </span>
                                      <span className={`${typography.searchResultTitle} truncate`} style={{ color: A.label }}>{result.label}</span>
                                    </div>
                                    <div className={`${typography.searchResultMeta} mt-1 truncate`} style={{ color: A.sub }}>{result.subtitle || result.entityLabel}</div>
                                    {hint && (
                                      <div className={`${typography.searchResultMeta} mt-1 truncate`} style={{ color: A.gray2 }}>{hint}</div>
                                    )}
                                  </div>
                                  {result.status && (
                                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: A.gray6, color: A.gray1 }}>
                                      {result.status}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                          {group.hiddenCount > 0 && (
                            <div className={`${typography.searchResultMeta} px-3 py-2`} style={{ color: A.gray2, borderBottom: `1px solid ${A.border}` }}>
                              还有 {group.hiddenCount} 条，请进入对应模块查看
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </form>
            <button className="relative p-2 rounded-md transition-colors hover:bg-slate-100"
              style={{ color: A.gray1 }}>
              <Bell size={15} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <div className="relative">
              <button
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[11px] font-semibold">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-[12px] font-medium leading-tight" style={{ color: A.label }}>{user.name}</div>
                  <div className="text-[10px] leading-tight" style={{ color: A.gray2 }}>{user.role}</div>
                </div>
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                    {[
                      { icon: User, label: "用户档案", onClick: () => toast("用户档案", { description: "用户档案页待接入" }) },
                      { icon: Settings, label: "设置", onClick: () => toast("设置", { description: "设置页待接入" }) },
                      { icon: LogOut, label: "退出登录", onClick: logout },
                    ].map(({ icon: Icon, label, onClick }) => (
                      <button
                        key={label}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        onClick={() => {
                          setProfileOpen(false);
                          onClick();
                        }}
                      >
                        <Icon size={13} className="text-slate-400" />
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-auto p-6" data-testid="app-main">
            <div id="module-export-scope" data-testid="module-export-scope" className={`mx-auto w-full ${contentMaxWidthClass}`}>
              {searchFocus && (
                <div className="mb-4 rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="focus-banner"
                  style={{ background: "#f0f6ff", border: `1px solid ${A.border}` }}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold" style={{ color: A.blue }}>当前聚焦</div>
                    <div className="mt-1 truncate text-sm font-semibold tabular-nums" style={{ color: A.label }}>{focusEntityLabel}</div>
                    <div className="mt-1 text-[11px]" style={{ color: A.sub }}>来源：{focusSourceLabel}，{focusReturnHint}。</div>
                  </div>
                  <RecoveryActions
                    className="shrink-0"
                    actions={[
                      { key: "previous", label: "返回上一层", onClick: returnFromFocus, kind: "previous", tone: "primary" },
                      { key: "module", label: "返回列表", onClick: () => navigateTo(activeModule), kind: "module" },
                      { key: "clear", label: "清除聚焦", onClick: clearFocus, kind: "clear", tone: "subtle" },
                    ]}
                  />
                  <BusinessBackLink context={focusReturnContext} onReturn={returnFromFocus} />
                </div>
              )}
              <PanelErrorBoundary key={active} moduleLabel={activeChildLabel || activeModuleLabel}>
                {panels[activeModule] || panels[active] || panels.overview}
              </PanelErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <AiPanel moduleId={activeModule} activeContext={aiActiveContext} openSignal={aiOpenSignal} onNavigate={navigateTo} onReviewActionDraft={openActionDraftReview} />
      <ActionDraftReviewShell
        open={draftShellOpen}
        loading={draftLoading}
        error={draftError}
        draft={draftPreview}
        onClose={() => setDraftShellOpen(false)}
        onCancelPreview={() => { setDraftPreview(null); setDraftError(""); setDraftShellOpen(false); }}
        onSaveDraft={saveActionDraftReview}
        onConfirmSafeAction={confirmSafeActionDraft}
        onNavigate={navigateTo}
      />
    </div>
  );
}
