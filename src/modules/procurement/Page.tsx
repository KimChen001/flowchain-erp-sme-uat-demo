import { useEffect, useState } from "react";
import { Building2, Calendar, ChevronRight, ClipboardCheck, FileSpreadsheet, FileText, Handshake, PackageCheck, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { A, Card, Chip, KpiCard, SubTabs } from "../../components/ui";
import { CONTRACTS, PORTAL_SUPPLIERS, PURCHASE_RETURNS, RFQS, SUPPLIER_INVOICES, purchaseOrders, receivingDocs } from "../../data/demo-data";
import { isReturnException } from "../../domain/procurement/returns";
import type { PurchaseIntent } from "../../types/scm";
import ContractsPanel from "./ContractsPanel";
import PurchaseReturnsPanel from "./PurchaseReturnsPanel";
import SupplierInvoiceRegister from "./SupplierInvoiceRegister";
import SupplierPortalPanel from "./SupplierPortalPanel";
import ThreeWayMatchPanel from "./ThreeWayMatchPanel";
import PurchasingRequests from "../purchase-requests/Page";
import PurchasingOrders from "../purchasing/Page";
import PurchasingRFQ from "../rfq/Page";
import ReceivingPanel from "../receiving/Page";

type PurTab = "overview" | "requests" | "rfq" | "orders" | "contracts" | "receiving" | "invoices" | "match" | "returns" | "portal";
type WorkbenchFilter = "all" | "approval" | "overdue" | "tracking";

type ProcurementPanelProps = {
  intent?: PurchaseIntent | null;
  onOpenRfq?: () => void;
  view?: PurTab;
};

export default function ProcurementPanel({ intent = null, onOpenRfq, view }: ProcurementPanelProps) {
  if (view === "requests") return <PurchasingRequests intent={intent} onOpenRfq={onOpenRfq} />;
  if (view === "orders") return <PurchasingOrders />;
  if (view === "rfq") return <PurchasingRFQ />;
  if (view === "contracts") return <ContractsPanel />;
  if (view === "invoices") return <SupplierInvoiceRegister mode="procurement" />;
  if (view === "match") return <ThreeWayMatchPanel />;
  if (view === "returns") return <PurchaseReturnsPanel />;
  if (view === "receiving") return <ReceivingPanel />;
  if (view === "portal") return <SupplierPortalPanel />;

  return <PurchasingPanel intent={intent} />;
}

function PurchasingPanel({ intent }: { intent: PurchaseIntent | null }) {
  const [tab, setTab] = useState<PurTab>("overview");
  const tabs = [
    { id: "overview",  label: "工作台",     icon: ClipboardCheck },
    { id: "requests",  label: "采购申请",   icon: ClipboardCheck },
    { id: "rfq",       label: "寻源 / RFx", icon: FileSpreadsheet, count: RFQS.length },
    { id: "orders",    label: "采购订单",   icon: FileText },
    { id: "contracts", label: "框架合同",   icon: Handshake,       count: CONTRACTS.length },
    { id: "receiving", label: "收货协同",   icon: PackageCheck },
    { id: "invoices",  label: "发票协同",   icon: FileText,        count: SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配" || invoice.varianceType !== "无差异").length },
    { id: "match",     label: "三单匹配",   icon: ShieldCheck,     count: SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配").length },
    { id: "returns",   label: "采购退货 / 贷项", icon: RotateCcw,  count: PURCHASE_RETURNS.filter((row) => isReturnException(row)).length },
    { id: "portal",    label: "供应商门户", icon: Building2,       count: PORTAL_SUPPLIERS.length },
  ] as const;

  useEffect(() => {
    if (intent) setTab("requests");
  }, [intent?.createdAt]);

  return (
    <div className="space-y-4">
      {tab !== "overview" && <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as PurTab)} />}
      {tab === "overview" && <ProcurementOverview onOpenTab={setTab} onOpenDetailViews={() => setTab("requests")} />}
      {tab === "requests"  && <PurchasingRequests intent={intent} />}
      {tab === "orders"    && <PurchasingOrders />}
      {tab === "rfq"       && <PurchasingRFQ />}
      {tab === "contracts" && <ContractsPanel />}
      {tab === "receiving" && <ReceivingPanel />}
      {tab === "invoices"  && <SupplierInvoiceRegister mode="procurement" />}
      {tab === "match"     && <ThreeWayMatchPanel />}
      {tab === "returns"   && <PurchaseReturnsPanel />}
      {tab === "portal"    && <SupplierPortalPanel />}
    </div>
  );
}

function parseLooseDate(value?: string | null) {
  if (!value) return null;
  const normalized = value
    .replace(/\u5e74/g, "-")
    .replace(/\u6708/g, "-")
    .replace(/\u65e5/g, "")
    .replace(/\//g, "-")
    .replace(/\s+/g, " ");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDueLabel(value?: string | null) {
  const date = parseLooseDate(value);
  if (!date) return value || "—";
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  return `${diffDays} 天后`;
}

function dueTone(value?: string | null) {
  const date = parseLooseDate(value);
  if (!date) return { color: A.gray1, bg: A.gray6 };
  const today = new Date();
  const diffDays = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diffDays < 0) return { color: A.red, bg: "#fff1f0" };
  if (diffDays <= 1) return { color: A.orange, bg: "#fff8f0" };
  return { color: A.blue, bg: "#f0f6ff" };
}

function queueTone(kind: string, dueValue?: string | null) {
  const overdue = dueValue ? formatDueLabel(dueValue).startsWith("逾期") : false;
  if (overdue) return { color: A.red, bg: "#fff1f0" };
  if (kind === "发票协同" || kind === "三单匹配" || kind === "采购退货 / 贷项") return { color: A.orange, bg: "#fff8f0" };
  return { color: A.blue, bg: "#f0f6ff" };
}

type WorkbenchRow = {
  id: string;
  bucket: WorkbenchFilter[];
  kind: string;
  docNo: string;
  title: string;
  supplier: string;
  amount: string;
  due: string;
  status: string;
  moduleId: PurTab;
  note?: string;
  tone: { color: string; bg: string };
};

function ProcurementOverview({ onOpenTab, onOpenDetailViews }: { onOpenTab: (tab: PurTab) => void; onOpenDetailViews: () => void }) {
  const [filter, setFilter] = useState<WorkbenchFilter>("all");
  const [refreshStamp, setRefreshStamp] = useState(() => new Date());

  const invoiceExceptions = SUPPLIER_INVOICES.filter((invoice) => invoice.matchStatus !== "自动匹配" || invoice.varianceType !== "无差异");
  const returnExceptions = PURCHASE_RETURNS.filter((row) => isReturnException(row));
  const openPos = purchaseOrders.filter((order) => !["已关闭", "已取消"].includes(order.status));
  const pendingReceiving = receivingDocs.filter((doc) => !["已完成", "已关闭"].includes(doc.status));
  const queueRows = [...purchaseOrders]
    .filter((order) => order.status === "待审批" || ["已审批", "已发出", "部分到货"].includes(order.status))
    .slice(0, 4)
    .map<WorkbenchRow>((order) => {
      const due = order.eta || order.created;
      const isApproval = order.status === "待审批";
      const isTracking = order.status === "已发出" || order.status === "部分到货";
      return {
        id: `po-${order.po}`,
        bucket: [isApproval ? "approval" : "tracking", formatDueLabel(due).startsWith("逾期") ? "overdue" : "tracking"],
        kind: isApproval ? "采购申请" : "采购订单",
        docNo: isApproval ? (order.sourceRequest || order.po) : order.po,
        title: isApproval
          ? `${order.sourceName || order.supplier} · 待审批`
          : isTracking
            ? `${order.supplier} · 供应商待回函`
            : `${order.supplier} · 已审批`,
        supplier: order.supplier,
        amount: `${order.amount.toLocaleString("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).replace("CNY", "¥")}`,
        due: formatDueLabel(due),
        status: order.status,
        moduleId: "requests",
        note: order.reason || `${order.items} 行 · ${order.owner}`,
        tone: queueTone(isApproval ? "采购申请" : "采购订单", due),
      };
    });

  const rfqRows = RFQS
    .filter((rfq) => ["进行中", "比价中"].includes(rfq.status))
    .slice(0, 1)
    .map<WorkbenchRow>((rfq) => ({
      id: `rfq-${rfq.id}`,
      bucket: [formatDueLabel(rfq.due).startsWith("逾期") ? "overdue" : "tracking", "tracking"],
      kind: "寻源 / RFx",
      docNo: rfq.id,
      title: `${rfq.title} · ${rfq.suppliers} 家供应商`,
      supplier: rfq.bestSupplier,
      amount: `¥${Number(rfq.bestPrice || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      due: formatDueLabel(rfq.due),
      status: rfq.status,
      moduleId: "rfq",
      note: rfq.category,
      tone: queueTone("寻源 / RFx", rfq.due),
    }));

  const invoiceRows = invoiceExceptions
    .slice(0, 2)
    .map<WorkbenchRow>((invoice) => ({
      id: `invoice-${invoice.id}`,
      bucket: ["approval", "overdue"],
      kind: "发票协同",
      docNo: invoice.invoiceNumber,
      title: `${invoice.supplier} · ${invoice.varianceType}`,
      supplier: invoice.supplier,
      amount: `¥${Number(invoice.varianceAmount || invoice.total || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      due: invoice.matchStatus === "自动匹配" ? "待复核" : "逾期处理",
      status: invoice.matchStatus,
      moduleId: "invoices",
      note: `${invoice.relatedPo || "缺少 PO"} · ${invoice.relatedGrn || "缺少 GRN"}`,
      tone: queueTone("发票协同"),
    }));

  const receivingRows = pendingReceiving
    .slice(0, 1)
    .map<WorkbenchRow>((doc) => ({
      id: `grn-${doc.grn}`,
      bucket: ["tracking"],
      kind: "收货确认",
      docNo: doc.grn,
      title: `${doc.supplier} · ${doc.status}`,
      supplier: doc.supplier,
      amount: `¥${Number(purchaseOrders.find((order) => order.po === doc.po)?.amount || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      due: formatDueLabel(doc.arrived),
      status: doc.status,
      moduleId: "receiving",
      note: `${doc.po} · ${doc.receiver}`,
      tone: queueTone("收货确认", doc.arrived),
    }));

  const returnRows = returnExceptions
    .slice(0, 1)
    .map<WorkbenchRow>((row) => ({
      id: `return-${row.id}`,
      bucket: ["approval", "overdue"],
      kind: "退货 / 贷项",
      docNo: row.returnNo,
      title: `${row.supplier} · ${row.reason}`,
      supplier: row.supplier,
      amount: `¥${Number(row.total || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      due: formatDueLabel(row.createdDate),
      status: row.status,
      moduleId: "returns",
      note: `${row.relatedPo} · 贷项冲减`,
      tone: queueTone("采购退货 / 贷项", row.createdDate),
    }));

  const portalRow = PORTAL_SUPPLIERS
    .find((item) => item.flag === "整改") || PORTAL_SUPPLIERS[0];

  const portalRows: WorkbenchRow[] = portalRow ? [{
    id: `portal-${portalRow.name}`,
    bucket: ["tracking"],
    kind: "供应商",
    docNo: portalRow.name,
    title: `${portalRow.name} · ${portalRow.flag || "待复核"}`,
    supplier: portalRow.name,
    amount: "—",
    due: portalRow.flag === "整改" ? "本月" : "本周",
    status: portalRow.flag || "待复核",
    moduleId: "portal",
    note: `准时率 ${portalRow.onTime}% · 质量 ${portalRow.quality}%`,
    tone: queueTone("供应商"),
  }] : [];

  const queue = [...queueRows, ...rfqRows, ...invoiceRows, ...receivingRows, ...returnRows, ...portalRows].sort((a, b) => {
    const score = (row: WorkbenchRow) => (row.bucket.includes("overdue") ? 100 : row.bucket.includes("approval") ? 80 : 50);
    return score(b) - score(a);
  });

  const filteredQueue = queue.filter((row) => filter === "all" ? true : row.bucket.includes(filter));
  const overdueCount = queue.filter((row) => row.bucket.includes("overdue")).length;
  const approvalCount = queue.filter((row) => row.bucket.includes("approval")).length;
  const trackingCount = queue.filter((row) => row.bucket.includes("tracking")).length;
  const arrivingSoon = pendingReceiving.filter((doc) => !formatDueLabel(doc.arrived).startsWith("逾期")).length + openPos.filter((order) => !formatDueLabel(order.eta || order.created).startsWith("逾期")).length;
  const dateLabel = refreshStamp.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: A.label }}>采购工作台</h1>
            <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: A.gray1 }}>
              <Calendar size={13} />
              <span>{dateLabel} · 今日共 {queue.length} 项待办</span>
            </div>
            <p className="text-xs leading-5 mt-2 max-w-3xl" style={{ color: A.sub }}>
              管理 PR、RFx、PO、收货协同、发票协同、三单匹配和退货贷项。
            </p>
            <div className="mt-3 rounded-lg px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.blue }}>
              今日重点集中在采购审批、订单跟进和发票 / 收货差异，先处理高优先级与逾期单据。
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setRefreshStamp(new Date())}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: A.white, color: A.label, boxShadow: `0 0 0 0.5px ${A.border}` }}
            >
              <RefreshCw size={13} /> 刷新
            </button>
            <button onClick={() => onOpenTab("requests")} className="text-xs px-3 py-1.5 rounded-lg font-medium text-white" style={{ background: A.blue }}>
              新建采购申请
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="待我审批" value={String(approvalCount)} sub={`${overdueCount} 项逾期`} icon={ClipboardCheck} color={A.red} />
        <KpiCard label="逾期未跟进" value={String(overdueCount)} sub="需要优先处理" icon={ShieldCheck} color={A.orange} />
        <KpiCard label="本周预计到货" value={String(arrivingSoon)} sub={`${trackingCount} 项跟进中`} icon={PackageCheck} color={A.blue} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3" style={{ borderBottom: `1px solid ${A.border}` }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: A.label }}>待办队列</h2>
              <Chip label={`${filteredQueue.length} 项`} color={A.blue} bg="#f0f6ff" />
            </div>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>按审批节点、截止时间和异常状态排序，详细表格留在各自子页面。</p>
          </div>
          <Chip label="审批节点优先" color={A.gray1} bg={A.gray6} />
        </div>
        <div className="px-5 pt-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all" as const, label: "全部待办", count: queue.length },
              { id: "approval" as const, label: "待我审批", count: approvalCount },
              { id: "overdue" as const, label: "逾期处理", count: overdueCount },
              { id: "tracking" as const, label: "跟进中", count: trackingCount },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  background: filter === item.id ? "#0f172a" : A.gray6,
                  color: filter === item.id ? A.white : A.gray1,
                }}
              >
                {item.label}
                <span className="min-w-[20px] rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums"
                  style={{ background: filter === item.id ? "rgba(255,255,255,0.14)" : A.white, color: filter === item.id ? A.white : A.blue }}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                {["类型", "单号", "说明 / 供应商", "金额", "截止时间"].map((header) => (
                  <th key={header} className="text-left px-5 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredQueue.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => onOpenTab(row.moduleId)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderBottom: index < filteredQueue.length - 1 ? `1px solid ${A.border}` : "none", background: row.bucket.includes("overdue") ? "#fffaf9" : "transparent" }}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.tone.color }} />
                      <Chip label={row.kind} color={row.tone.color} bg={row.tone.bg} />
                    </div>
                  </td>
                  <td className="px-5 py-3 font-medium" style={{ color: A.gray1 }}>{row.docNo}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium" style={{ color: A.label }}>{row.title}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: A.gray2 }}>{row.note}</div>
                  </td>
                  <td className="px-5 py-3 font-semibold" style={{ color: A.label }}>{row.amount}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Chip label={row.due} color={dueTone(row.due).color} bg={dueTone(row.due).bg} />
                      <ChevronRight size={13} style={{ color: A.gray3 }} />
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: A.gray2 }}>{row.status}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredQueue.length === 0 && (
            <div className="py-14 text-center text-xs" style={{ color: A.gray2 }}>当前筛选没有待办项</div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>详细视图</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>需要查看完整列表、导出和单据细节时再进入。</p>
          </div>
          <button onClick={onOpenDetailViews}
            className="text-[11px] px-3 py-1.5 rounded-md font-medium"
            style={{ background: A.gray6, color: A.blue }}>
            打开采购申请
          </button>
        </div>
      </Card>
    </div>
  );
}
