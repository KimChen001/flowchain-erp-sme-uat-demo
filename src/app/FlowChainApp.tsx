import React, { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle,
  Bell, Search,
  Activity, Sparkles,
  Loader2,
  ShieldCheck,
  Lock, LogOut, Printer,
} from "lucide-react";
import { navGroups, navItems } from "./routes";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "../lib/constants";
import { apiJson } from "../lib/api-client";
import { fmt } from "../lib/format";
import { exportModulePdf } from "../lib/pdf-export";
import { A, Card, Field, inputStyle, Modal } from "../components/ui";
import type {
  DemoUser,
  PurchaseIntent,
  PurchaseRequest,
} from "../types/scm";
import {
  inventoryItems,
  supplierData,
} from "../data/demo-data";
import { inventoryPlan } from "../domain/inventory/planning";
import { inventoryPurchaseRequestPayload } from "../domain/inventory/purchase-request";
import ReceivingPanel from "../modules/receiving/Page";
import InventoryPanel from "../modules/inventory/Page";
import ForecastPanel from "../modules/forecast/Page";
import OverviewPanel from "../modules/overview/Page";
import SalesPanel from "../modules/sales/Page";
import ProcurementPanel from "../modules/procurement/Page";
import FinanceWorkbench from "../modules/finance/Page";
import AiPanel from "../modules/ai-assistant/Panel";
import ReportsPanel from "../modules/reports/Page";
import ImportsPanel from "../modules/imports/Page";

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

const PAGE_LABELS: Record<string, string> = {
  overview: "每日工作台", inventory: "库存管理",
  sales: "销售表现", forecast: "预测与 MRP",
  purchaseRequests: "采购申请", purchasing: "采购订单", rfq: "供应商报价", receiving: "收货",
  procurement: "采购管理", finance: "财务协同", reports: "报表中心", imports: "数据管理",
};

function splitActive(active: string) {
  const [moduleId, viewId] = active.split(":");
  return { moduleId, viewId };
}

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
              这是一个可交互的供应链 ERP 工作台。用户登录后，系统会保存用户档案，并支持继续扩展公司级租户、权限、审批流和业务数据服务。
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
  const [aiVisible, setAiVisible] = useState(true);
  const [aiPanelMode, setAiPanelMode] = useState<"compact" | "expanded">(() =>
    localStorage.getItem("scm-demo-ai-panel-mode") === "expanded" ? "expanded" : "compact"
  );
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

  useEffect(() => {
    localStorage.setItem("scm-demo-ai-panel-mode", aiPanelMode);
  }, [aiPanelMode]);

  const { moduleId: activeModule, viewId: activeView } = splitActive(active);
  const compactAiPanelWidth = activeModule === "overview" ? "w-[300px]" : "w-[320px]";
  const activeModuleLabel = PAGE_LABELS[activeModule] || activeModule;
  const activeNavItem = navItems.find((item) => item.id === activeModule);
  const activeChildLabel = activeNavItem?.children?.find((item) => item.id === active)?.label;

  const panels: Record<string, React.ReactNode> = {
    overview:    <OverviewPanel onNavigate={setActive} onPrepareReplenishmentRequest={prepareReplenishmentRequest} onOpenAi={() => setAiVisible(true)} />,
    inventory:   <InventoryPanel initialView={activeView as any} />,
    sales:       <SalesPanel />,
    forecast:    <ForecastPanel />,
    purchaseRequests: <ProcurementPanel view="requests" intent={purchaseIntent} onOpenRfq={() => setActive("rfq")} />,
    purchasing:  <ProcurementPanel view="orders" />,
    rfq:         <ProcurementPanel view="rfq" />,
    receiving:   <ReceivingPanel />,
    procurement: <ProcurementPanel view={activeView as any} />,
    finance:     <FinanceWorkbench initialView={activeView as any} />,
    reports:     <ReportsPanel onNavigate={setActive} />,
    imports:     <ImportsPanel onNavigate={setActive} />,
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
                  const isActive = activeModule === item.id;
                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button onClick={() => setActive(item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                        style={isActive
                          ? { background: A.white, color: A.blue, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                          : { background: "transparent", color: A.gray1 }}>
                        <item.icon size={15} strokeWidth={isActive ? 2 : 1.8} />
                        <span className="truncate">{item.label}</span>
                      </button>
                      {isActive && item.children && (
                        <div className="ml-5 pl-3 py-1 space-y-0.5" style={{ borderLeft: "1px solid rgba(0,0,0,0.08)" }}>
                          {item.children.map((child) => {
                            const childActive = active === child.id || (active === item.id && child.id === item.id);
                            return (
                              <button key={child.id} onClick={() => setActive(child.id)}
                                className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                                style={childActive
                                  ? { background: "#f0f6ff", color: A.blue }
                                  : { background: "transparent", color: A.gray1 }}>
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
            <button onClick={() => exportModulePdf(activeChildLabel || activeModuleLabel, user.company)}
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
              <PanelErrorBoundary key={active} moduleLabel={activeChildLabel || activeModuleLabel}>
                {panels[activeModule] || panels[active] || panels.overview}
              </PanelErrorBoundary>
            </div>
          </main>

          {aiVisible && (
            <div className={`${aiPanelMode === "expanded" ? "w-[440px]" : compactAiPanelWidth} shrink-0 overflow-hidden flex flex-col transition-all duration-200`}>
              <div className="h-9 px-3 flex items-center justify-between bg-white" style={{ borderLeft: "0.5px solid rgba(0,0,0,0.1)", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
                <span className="text-[11px] font-medium" style={{ color: A.gray1 }}>
                  AI 助手 · {aiPanelMode === "expanded" ? "展开模式" : "紧凑模式"}
                </span>
                <button
                  onClick={() => setAiPanelMode((mode) => mode === "expanded" ? "compact" : "expanded")}
                  className="text-[11px] px-2 py-1 rounded-md font-medium"
                  style={{ background: "#f0f6ff", color: A.blue }}>
                  {aiPanelMode === "expanded" ? "收起" : "展开"}
                </button>
              </div>
              <AiPanel moduleId={activeModule} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
