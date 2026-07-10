import { useEffect, useMemo, useState } from "react";
import { BarChart3, Boxes, CreditCard, FileSpreadsheet, Handshake, ShoppingCart, Truck, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { A, Card, KpiCard, SectionHeader } from "../../components/ui";
import { ReportsAnalyticsV2 } from "../../components/reports/ReportsAnalyticsV2";
import { fetchReportsAnalyticsV2, type ReportsAnalyticsV2 as ReportsAnalyticsPayload } from "./reportsAnalytics";
import { inventoryItems, procurementTrend, purchaseOrders, salesData, supplierData, SUPPLIER_INVOICES, SKU_CATALOG } from "../../data/demo-data";
import { THREE_WAY_MATCHES, SETTLEMENT_DOCUMENTS } from "../../data/standard-business-scenario";
import { fmt } from "../../lib/format";

type View = "overview" | "procurement" | "sales" | "inventory" | "finance" | "suppliers";
type NavigateFn = (moduleId: string, focusTarget?: { entityType: string; entityId: string } | null, options?: { returnTo?: string; entityLabel?: string; source?: string; returnContext?: unknown }) => void;
const VIEW_LABELS: Record<View, string> = { overview: "经营总览", procurement: "采购分析", sales: "销售分析", inventory: "库存分析", finance: "结算分析", suppliers: "供应商分析" };
const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

function FilterBar() {
  const [params, setParams] = useSearchParams();
  const fields = [
    { key: "from", label: "开始日期", type: "date", fallback: "2026-01-01" }, { key: "to", label: "结束日期", type: "date", fallback: "2026-07-11" },
    { key: "company", label: "公司", options: ["全部公司", "新辰智能制造"] }, { key: "warehouse", label: "仓库", options: ["全部仓库", "上海总仓", "苏州分仓"] },
    { key: "supplier", label: "供应商", options: ["全部供应商", ...supplierData.map((item) => item.name)] }, { key: "customer", label: "客户", options: ["全部客户", "华南自动化设备有限公司", "苏州精工系统集成有限公司"] },
    { key: "category", label: "品类", options: ["全部品类", "机械部件", "电气元件", "原材料", "耗材"] }, { key: "currency", label: "币种", options: ["CNY", "USD", "EUR"] },
  ];
  const set = (key: string, value: string, fallback?: string) => { const next = new URLSearchParams(params); if (!value || value === fallback || value.startsWith("全部")) next.delete(key); else next.set(key, value); setParams(next, { replace: true }); };
  return <Card className="p-4" data-testid="bi-global-filters"><div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{fields.map((field) => <label key={field.key} className="text-[11px] font-medium" style={{ color: A.gray1 }}>{field.label}{field.type === "date" ? <input aria-label={field.label} type="date" value={params.get(field.key) || field.fallback} onChange={(event) => set(field.key, event.target.value, field.fallback)} className="mt-1 h-9 w-full rounded-lg px-2" style={{ background: A.gray6, color: A.label }} /> : <select aria-label={field.label} value={params.get(field.key) || field.options?.[0]} onChange={(event) => set(field.key, event.target.value)} className="mt-1 h-9 w-full rounded-lg px-2" style={{ background: A.gray6, color: A.label }}>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>}</label>)}</div><div className="mt-3 flex justify-end"><button onClick={() => setParams({}, { replace: true })} className="text-xs font-semibold text-blue-600 hover:underline">清除筛选</button></div></Card>;
}

function ChartCard({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return <Card className="p-5" data-chart-title={title}><SectionHeader title={title} /><div className="h-64 cursor-pointer" onClick={onClick}>{children}</div></Card>;
}

export function BiDashboard({ view, onNavigate }: { view: View; onNavigate?: NavigateFn }) {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<ReportsAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { let active = true; fetchReportsAnalyticsV2().then((value) => { if (active) { setAnalytics(value); setError(false); } }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const inventoryValue = inventoryItems.reduce((sum, item) => sum + item.qty * (SKU_CATALOG.find((sku) => sku.sku === item.sku)?.price || 0), 0);
  const purchaseAmount = purchaseOrders.reduce((sum, item) => sum + item.amount, 0);
  const invoiceAmount = SUPPLIER_INVOICES.reduce((sum, item) => sum + item.total, 0);
  const matchRate = THREE_WAY_MATCHES.length ? Math.round(THREE_WAY_MATCHES.filter((item) => item.totalVariance === 0).length / THREE_WAY_MATCHES.length * 100) : 0;
  const atRiskSku = inventoryItems.filter((item) => item.qty < item.min).length;
  const supplierChart = supplierData.slice(0, 5).map((item) => ({ name: item.name.slice(0, 6), 采购金额: item.amount / 10000, OTIF: item.ontime, 质量: item.quality }));
  const inventoryRisk = [{ name: "正常", value: inventoryItems.length - atRiskSku }, { name: "低于安全库存", value: atRiskSku }, { name: "呆滞", value: 1 }];
  const financeTrend = SUPPLIER_INVOICES.map((item) => ({ date: item.invoiceDate.slice(5), 发票金额: item.total / 10000, 差异金额: item.varianceAmount / 10000 }));
  const kpis = useMemo(() => ({
    overview: [["销售订单金额", fmt(salesData.reduce((sum, row) => sum + row.revenue, 0)), "年度销售", ShoppingCart, A.blue], ["采购订单金额", fmt(purchaseAmount), "采购承诺", Handshake, A.purple], ["库存金额", fmt(inventoryValue), "现有库存", Boxes, A.green], ["到期应付", fmt(invoiceAmount), "供应商发票", CreditCard, A.orange], ["准时交付率", "96.4%", "销售履约", Truck, A.green], ["三单匹配率", `${matchRate}%`, "无差异记录", BarChart3, A.blue], ["库存风险 SKU", String(atRiskSku), "低于安全库存", Boxes, A.red], ["未关闭异常", String(THREE_WAY_MATCHES.filter((item) => item.totalVariance > 0).length), "需业务关注", BarChart3, A.orange]],
    procurement: [["采购金额", fmt(purchaseAmount), "当前订单", Handshake, A.blue], ["开放 PO", String(purchaseOrders.filter((item) => !["已完成", "已取消"].includes(item.status)).length), "履约中", FileSpreadsheet, A.orange], ["逾期 PO", "2", "需跟进", Truck, A.red], ["RFQ 响应率", "84%", "有效报价", Users, A.green]],
    sales: [["销售订单金额", fmt(salesData.reduce((sum, row) => sum + row.revenue, 0)), "年度", ShoppingCart, A.blue], ["发货完成率", "94.8%", "已发运", Truck, A.green], ["准时交付率", "96.4%", "按承诺日期", Truck, A.green], ["异常签收", "2", "需处理", BarChart3, A.red]],
    inventory: [["库存金额", fmt(inventoryValue), "当前结存", Boxes, A.blue], ["库存周转率", "7.2", "年化", BarChart3, A.green], ["覆盖天数", "38 天", "平均", Boxes, A.purple], ["风险 SKU", String(atRiskSku), "安全库存", Boxes, A.red]],
    finance: [["发票总额", fmt(invoiceAmount), "供应商发票", CreditCard, A.blue], ["三单匹配率", `${matchRate}%`, "自动/无差异", BarChart3, A.green], ["差异金额", fmt(THREE_WAY_MATCHES.reduce((sum, row) => sum + row.totalVariance, 0)), "待处理", CreditCard, A.red], ["已结算金额", fmt(SETTLEMENT_DOCUMENTS.reduce((sum, row) => sum + row.actualSettlementAmount, 0)), "结算单", CreditCard, A.purple]],
    suppliers: [["采购金额", fmt(supplierData.reduce((sum, row) => sum + row.amount, 0)), "供应商采购", Handshake, A.blue], ["RFQ 响应率", "84%", "有效报价", Users, A.green], ["准时交付率", "94.7%", "OTIF", Truck, A.green], ["风险供应商", String(supplierData.filter((item) => item.grade === "B").length), "需整改", Users, A.red]],
  })[view] as Array<[string, string, string, typeof ShoppingCart, string]>, [view, purchaseAmount, inventoryValue, invoiceAmount, matchRate, atRiskSku]);
  const drill = (path: string) => navigate(`${path}${window.location.search}`);
  return <div className="space-y-5" data-testid="bi-dashboard" data-view={view}>
    <Card className="p-5"><div className="flex items-center justify-between gap-4"><div><h1 className="text-xl font-semibold" style={{ color: A.label }}>{VIEW_LABELS[view]}</h1><p className="mt-1 text-xs" style={{ color: A.sub }}>基于标准业务数据计算，筛选状态保存在 URL，可刷新和分享。</p></div><span className="text-xs" style={{ color: A.green }}>数据口径已统一</span></div></Card>
    <FilterBar />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(([label, value, sub, icon, color]) => <KpiCard key={label} label={label} value={value} sub={sub} icon={icon} color={color} />)}</div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartCard title={view === "sales" ? "客户订单趋势" : view === "finance" ? "发票金额趋势" : "销售与采购金额趋势"} onClick={() => drill(view === "finance" ? "/app/finance/invoices" : view === "sales" ? "/app/sales/orders" : "/app/procurement/orders")}><ResponsiveContainer width="100%" height="100%"><LineChart data={view === "finance" ? financeTrend : salesData.slice(0, 8).map((row, index) => ({ month: row.month, 销售金额: row.revenue / 10000, 采购金额: (procurementTrend[index % procurementTrend.length]?.amount || 0) / 10 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={view === "finance" ? "date" : "month"} /><YAxis /><Tooltip formatter={(value) => `${value} 万元`} /><Legend /><Line type="monotone" dataKey={view === "finance" ? "发票金额" : "销售金额"} stroke={COLORS[0]} /><Line type="monotone" dataKey={view === "finance" ? "差异金额" : "采购金额"} stroke={COLORS[2]} /></LineChart></ResponsiveContainer></ChartCard>
      <ChartCard title={view === "inventory" ? "库存风险分布" : "供应商排名"} onClick={() => drill(view === "inventory" ? "/app/inventory/warnings" : "/app/reports/suppliers")}><ResponsiveContainer width="100%" height="100%">{view === "inventory" ? <PieChart><Pie data={inventoryRisk} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>{inventoryRisk.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip /><Legend /></PieChart> : <BarChart data={supplierChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="采购金额" fill={COLORS[0]} /></BarChart>}</ResponsiveContainer></ChartCard>
      <ChartCard title={view === "finance" ? "AP Aging" : "收货与发货趋势"} onClick={() => drill(view === "finance" ? "/app/finance/invoices?aging=overdue" : "/app/inventory/movements")}><ResponsiveContainer width="100%" height="100%"><AreaChart data={procurementTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Legend /><Area type="monotone" dataKey="po" name="收货" stroke={COLORS[1]} fill="#d1fae5" /><Area type="monotone" dataKey="amount" name="发货/金额" stroke={COLORS[0]} fill="#dbeafe" /></AreaChart></ResponsiveContainer></ChartCard>
      <ChartCard title={view === "suppliers" ? "供应商 OTIF 与质量" : "异常趋势"} onClick={() => drill(view === "suppliers" ? "/app/master-data/suppliers" : "/app/finance/three-way-match")}><ResponsiveContainer width="100%" height="100%"><BarChart data={view === "suppliers" ? supplierChart : financeTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={view === "suppliers" ? "name" : "date"} /><YAxis /><Tooltip /><Legend /><Bar dataKey={view === "suppliers" ? "OTIF" : "差异金额"} fill={COLORS[2]} /><Bar dataKey={view === "suppliers" ? "质量" : "发票金额"} fill={COLORS[1]} /></BarChart></ResponsiveContainer></ChartCard>
    </div>
    {view === "overview" && <ReportsAnalyticsV2 analytics={analytics} loading={loading} error={error} onNavigate={onNavigate} />}
  </div>;
}
