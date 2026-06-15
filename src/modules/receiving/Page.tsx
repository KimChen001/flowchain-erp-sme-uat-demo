import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck,
  Clock, DollarSign, Inbox, MapPin, PackageCheck, Plus, ScanLine, ShieldCheck, Truck,
  Undo2, XCircle,
} from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import { arrivalSchedule, purchaseOrders, qcExceptions, receivingDocs, SUPPLIER_INVOICES } from "../../data/demo-data";
import type { PurchaseOrder, ReceivingDoc, ReceivingDocLine, RecvStatus } from "../../types/scm";
import { lineRemaining, poLinesOf, toNumber } from "../../domain/purchasing/helpers";
import { grnLinesOf, isPostedGrn } from "../../domain/receiving/helpers";
import { QCModal } from "./components/QCModal";
import { ScanReceiveModal } from "./components/ScanReceiveModal";
import { A, Card, Chip, DocumentHistoryPanel, KpiCard, Modal, SectionHeader, SubTabs } from "../../components/ui";
import {
  DocumentActionBar,
  DocumentEvidencePanel,
  DocumentHeader,
  DocumentLinesTable,
  DocumentShell,
  DocumentStatusTimeline,
  DocumentTotals,
  statusTone,
  type TimelineStep,
} from "../../components/document/DocumentShell";
import { getGrnLinkedDocuments } from "../../domain/procurement/document-links";

const recvStatusMeta: Record<RecvStatus, { color: string; bg: string }> = {
  "待收货": { color: A.gray1, bg: A.gray6 },
  "已签收": { color: A.blue, bg: "#eef6ff" },
  "质检中": { color: A.orange, bg: "#fff7e8" },
  "已入库": { color: A.green, bg: "#f0faf4" },
  "异常处理": { color: A.red, bg: "#fff1f0" },
};

function RecvStatusPill({ status }: { status: string }) {
  const displayStatus = status || "未知状态";
  const m = recvStatusMeta[displayStatus as RecvStatus] ?? { color: A.gray1, bg: A.gray6 };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}>{displayStatus}</span>
  );
}

function receivingTimeline(grn: ReceivingDoc): TimelineStep[] {
  const statusOrder = ["待收货", "已签收", "质检中", "已入库"] as const;
  const currentIndex = Math.max(0, statusOrder.indexOf(grn.status as any));
  const hasRejected = Number(grn.failed || 0) > 0;
  return [
    { label: "待收货", status: currentIndex > 0 || grn.status === "异常处理" ? "done" : "current", helper: grn.arrived },
    { label: "质检中", status: grn.status === "质检中" ? "current" : currentIndex > 2 || grn.status === "异常处理" ? "done" : "pending", helper: `合格 ${grn.passed} / 拒收 ${grn.failed}` },
    { label: "已签收 / 已入库", status: grn.status === "已入库" ? "done" : grn.status === "异常处理" ? "warning" : currentIndex > 0 ? "current" : "pending", helper: grn.inventoryApplied ? "已应用库存" : grn.warehouse },
    { label: "异常处理", status: grn.status === "异常处理" ? "blocked" : hasRejected ? "warning" : "pending", helper: hasRejected ? `拒收 ${grn.failed}` : "无异常" },
    { label: "已关闭", status: grn.status === "已入库" && grn.inventoryApplied ? "done" : "pending", helper: grn.postedAt ? new Date(grn.postedAt).toLocaleString("zh-CN") : "待关闭" },
  ];
}

function exportReceivingDetail(grn: ReceivingDoc) {
  const lines = grnLinesOf(grn);
  const headerRows = [
    ["GRN编号", grn.grn],
    ["供应商", grn.supplier],
    ["PO", grn.po],
    ["收货日期", grn.arrived],
    ["仓库", grn.warehouse],
    ["状态", grn.status],
    ["负责人", grn.receiver],
    ["关联发票", SUPPLIER_INVOICES.filter((invoice) => invoice.relatedGrn === grn.grn || invoice.relatedPo === grn.po).map((invoice) => invoice.invoiceNumber).join(", ")],
    ["拒收数量", grn.failed],
    ["库存移动", grn.inventoryMovementIds?.join(", ") || ""],
  ].map(([field, value]) => ({ section: "header", field, value }));
  const lineRows = lines.map((line) => ({
    section: "line",
    field: line.grnLineId || line.poLineId || line.sku,
    value: `${line.sku} ${line.itemName || ""}`.trim(),
    订单数量: "",
    收货数量: line.receivedQty,
    合格数量: line.acceptedQty,
    拒收数量: line.rejectedQty,
    单位: line.unit || "",
    仓库: line.warehouseId || grn.warehouse,
    状态: line.status || "",
  }));
  exportRowsToCsv(`receiving-detail-${grn.grn}.csv`, [...headerRows, ...lineRows]);
  toast.success("收货单详情 CSV 已导出");
}

// ─── Receiving · ERP Data ─────────────────────────────────────────────────────
const ASNS: {
  id: string; po: string; supplier: string; eta: string; carrier: string;
  awb: string; cartons: number; weight: number; status: "在途" | "已抵港" | "清关中" | "已签收" | "延误";
}[] = [
  { id: "ASN-26-0421", po: "PO-2026-0142", supplier: "江苏铝合金集团", eta: "2026-05-28 14:00", carrier: "顺丰冷链", awb: "SF-26052812", cartons: 18, weight: 1280, status: "在途" },
  { id: "ASN-26-0422", po: "PO-2026-0148", supplier: "深圳新元电气",   eta: "2026-05-28 09:30", carrier: "京东物流", awb: "JD-26052804", cartons: 42, weight:  620, status: "已抵港" },
  { id: "ASN-26-0423", po: "PO-2026-0151", supplier: "佛山标准件",     eta: "2026-05-29 11:00", carrier: "德邦快运", awb: "DB-26052914", cartons: 12, weight:  840, status: "清关中" },
  { id: "ASN-26-0424", po: "PO-2026-0156", supplier: "上海仪表科技",   eta: "2026-05-30 16:30", carrier: "顺丰速运", awb: "SF-26053016", cartons:  6, weight:  120, status: "在途" },
  { id: "ASN-26-0425", po: "PO-2026-0162", supplier: "广州化工耗材",   eta: "2026-05-27 18:00", carrier: "中通快运", awb: "ZT-26052718", cartons:  9, weight:  360, status: "延误" },
  { id: "ASN-26-0426", po: "PO-2026-0164", supplier: "华东精工机械",   eta: "2026-05-31 10:00", carrier: "京东物流", awb: "JD-26053110", cartons: 24, weight: 1860, status: "在途" },
];

const QC_PLANS: {
  id: string; name: string; aql: string; sampleSize: string; criticalAQL: number; majorAQL: number; minorAQL: number;
  applies: string; method: string;
}[] = [
  { id: "QCP-001", name: "电子元器件 AQL 标准",   aql: "GB/T 2828.1 II", sampleSize: "N=125 → n=20",  criticalAQL: 0,    majorAQL: 1.0, minorAQL: 2.5, applies: "PCB / 控制板 / 传感器", method: "全项电测 + 外观" },
  { id: "QCP-002", name: "原材料抽检",            aql: "GB/T 2828.1 II", sampleSize: "N=500 → n=50",  criticalAQL: 0,    majorAQL: 1.5, minorAQL: 4.0, applies: "铝合金型材",            method: "光谱分析 + 力学" },
  { id: "QCP-003", name: "通用件免检",            aql: "供应商免检",     sampleSize: "N=∞ → n=0",     criticalAQL: 0,    majorAQL: 0,   minorAQL: 0,   applies: "M3~M12 紧固件",         method: "COA 核查" },
  { id: "QCP-004", name: "化工耗材",              aql: "GB/T 2828.1 II", sampleSize: "N=80 → n=13",   criticalAQL: 0,    majorAQL: 1.0, minorAQL: 2.5, applies: "切削液 / 防锈油",        method: "理化指标全检" },
  { id: "QCP-005", name: "精密工具",              aql: "GB/T 2828.1 III", sampleSize: "N=50 → n=20", criticalAQL: 0,    majorAQL: 0.65, minorAQL: 1.5, applies: "刀具 / 测量仪表",       method: "尺寸 + 硬度抽检" },
];

const EXCEPTIONS: {
  id: string; grn: string; type: "数量短缺" | "外观破损" | "型号错发" | "AQL 拒收" | "单据不符" | "运输异常";
  detail: string; severity: "高" | "中" | "低"; owner: string; status: "待处理" | "处理中" | "已闭环"; createdAt: string;
}[] = [
  { id: "EX-26-0184", grn: "GRN-2026-0518", type: "AQL 拒收",   detail: "Major 缺陷 3 件 > AQL 1.0, 批次整体拒收", severity: "高", owner: "李婷",   status: "处理中", createdAt: "2026-05-25" },
  { id: "EX-26-0185", grn: "GRN-2026-0521", type: "数量短缺",   detail: "实收 18 / 应收 20 (托盘 #4 缺失)",         severity: "中", owner: "刘建华", status: "处理中", createdAt: "2026-05-26" },
  { id: "EX-26-0186", grn: "GRN-2026-0522", type: "外观破损",   detail: "8 件包装受潮, 已隔离待评估",                severity: "中", owner: "王志强", status: "待处理", createdAt: "2026-05-26" },
  { id: "EX-26-0187", grn: "GRN-2026-0523", type: "型号错发",   detail: "实收 6061-T651 / 应收 6061-T6",             severity: "高", owner: "陈思远", status: "待处理", createdAt: "2026-05-27" },
  { id: "EX-26-0188", grn: "GRN-2026-0516", type: "单据不符",   detail: "发票金额与 PO 不符 (差异 ¥8,600)",          severity: "低", owner: "周浩",   status: "已闭环", createdAt: "2026-05-22" },
  { id: "EX-26-0189", grn: "GRN-2026-0509", type: "运输异常",   detail: "冷链温度记录超标 1.4°C × 4h",                severity: "高", owner: "李婷",   status: "已闭环", createdAt: "2026-05-19" },
];

const SUPPLIER_RETURNS: {
  id: string; po: string; supplier: string; reason: string; qty: number; amount: number;
  status: "已开单" | "已发出" | "已确认" | "已结案"; createdAt: string;
}[] = [
  { id: "SRN-26-082", po: "PO-2026-0128", supplier: "广州化工耗材",   reason: "理化指标不合格", qty:  12, amount:  18400, status: "已确认", createdAt: "2026-05-18" },
  { id: "SRN-26-083", po: "PO-2026-0136", supplier: "佛山标准件",     reason: "尺寸超差",        qty: 280, amount:   4200, status: "已发出", createdAt: "2026-05-22" },
  { id: "SRN-26-084", po: "PO-2026-0142", supplier: "江苏铝合金集团", reason: "AQL Major 超标",  qty:   3, amount:  86400, status: "已开单", createdAt: "2026-05-26" },
  { id: "SRN-26-085", po: "PO-2026-0118", supplier: "上海仪表科技",   reason: "校准证书缺失",    qty:   4, amount:  24800, status: "已结案", createdAt: "2026-05-10" },
];

// ─── Receiving · Master Wrapper ───────────────────────────────────────────────
type RecvTab = "ops" | "asn" | "qc" | "exceptions" | "returns";
export default function ReceivingPanel() {
  const [tab, setTab] = useState<RecvTab>("ops");
  const tabs = [
    { id: "ops",        label: "收货操作", icon: PackageCheck, count: receivingDocs.length },
    { id: "asn",        label: "ASN 预到货", icon: Inbox,      count: ASNS.length },
    { id: "qc",         label: "质检计划",   icon: ShieldCheck, count: QC_PLANS.length },
    { id: "exceptions", label: "异常工单",   icon: AlertOctagon, count: EXCEPTIONS.filter(e => e.status !== "已闭环").length },
    { id: "returns",    label: "退货供应商", icon: Undo2,        count: SUPPLIER_RETURNS.length },
  ] as const;

  return (
    <div className="space-y-4">
      <SubTabs tabs={tabs as any} value={tab} onChange={(v) => setTab(v as RecvTab)} />
      {tab === "ops"        && <ReceivingOps />}
      {tab === "asn"        && <ReceivingASN />}
      {tab === "qc"         && <ReceivingQC />}
      {tab === "exceptions" && <ReceivingExceptions />}
      {tab === "returns"    && <ReceivingReturns />}
    </div>
  );
}

function ReceivingASN() {
  const [asns, setAsns] = useState(ASNS);
  const checkin = (id: string) => {
    setAsns(prev => prev.map(a => a.id === id ? { ...a, status: "已签收" as const } : a));
    toast.success(`${id} 已签收`, { description: "已生成 GRN 单据, 进入质检流程" });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="预到货" value={String(asns.filter(a => a.status === "在途" || a.status === "已抵港").length)} sub="未来 48h" delta={`+${asns.filter(a => a.status === "在途").length}`} icon={Truck} color={A.blue} />
        <KpiCard label="今日到货" value={String(asns.filter(a => a.eta.startsWith("2026-05-27") || a.eta.startsWith("2026-05-28")).length)} sub="预计抵达" icon={Inbox} color={A.green} />
        <KpiCard label="延误"     value={String(asns.filter(a => a.status === "延误").length)} sub="超 ETA"  icon={AlertTriangle} color={A.red} />
        <KpiCard label="清关中"   value={String(asns.filter(a => a.status === "清关中").length)} sub="海关 / 国检" icon={Clock} color={A.orange} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>ASN 预到货通知</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["ASN 编号", "PO", "供应商", "预计到达", "承运", "运单号", "件数", "重量(kg)", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {asns.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: i < asns.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{a.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.po}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.supplier}</td>
                <td className="px-5 py-3" style={{ color: a.status === "延误" ? A.red : A.label }}>{a.eta}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.carrier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{a.awb}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.cartons}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{a.weight}</td>
                <td className="px-5 py-3">
                  <Chip label={a.status}
                    color={a.status === "已签收" ? A.green : a.status === "已抵港" ? A.blue : a.status === "清关中" ? A.purple : a.status === "延误" ? A.red : A.orange}
                    bg={a.status === "已签收" ? "rgba(52,199,89,0.1)" : a.status === "已抵港" ? "rgba(0,113,227,0.1)" : a.status === "清关中" ? "rgba(175,82,222,0.1)" : a.status === "延误" ? "rgba(255,59,48,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {(a.status === "已抵港" || a.status === "清关中") &&
                    <button onClick={() => checkin(a.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>签收</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingQC() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="质检计划"    value={String(QC_PLANS.length)}                        sub="生效中"                          icon={ShieldCheck} color={A.blue} />
        <KpiCard label="本月抽检批次" value="86"                                              sub="GB/T 2828.1"                     icon={ClipboardCheck} color={A.green} />
        <KpiCard label="一次合格率"   value="98.4%"                                           sub="FPY" delta="+0.6pts" positive    icon={CheckCircle2} color={A.purple} />
        <KpiCard label="拒收批次"     value="4"                                               sub="本月" delta="-2"  positive       icon={XCircle}    color={A.red} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>AQL 抽样计划 (GB/T 2828.1)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["计划编号", "名称", "AQL 等级", "抽样方案", "Critical", "Major", "Minor", "适用范围", "检验方法"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QC_PLANS.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < QC_PLANS.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.id}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{p.name}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.aql}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{p.sampleSize}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.red }}>{p.criticalAQL}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.orange }}>{p.majorAQL}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{p.minorAQL}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.applies}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{p.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <SectionHeader title="AQL 接收 / 拒收判定示意" />
        <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
          {[
            { label: "Critical (致命缺陷)", value: "AQL = 0",      desc: "零容忍, 发现即拒收整批", color: A.red },
            { label: "Major (主要缺陷)",     value: "AQL 1.0~1.5",  desc: "影响功能 / 使用, 抽样判定", color: A.orange },
            { label: "Minor (次要缺陷)",     value: "AQL 2.5~4.0",  desc: "外观 / 标识, 抽样判定",     color: A.blue },
          ].map(b => (
            <div key={b.label} className="p-4 rounded-xl" style={{ background: `${b.color}0d`, border: `0.5px solid ${b.color}33` }}>
              <div className="text-[11px] font-medium" style={{ color: b.color }}>{b.label}</div>
              <div className="text-base font-semibold mt-1" style={{ color: A.label }}>{b.value}</div>
              <div className="text-[11px] mt-1.5" style={{ color: A.sub }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReceivingExceptions() {
  const [exs, setExs] = useState(EXCEPTIONS);
  const advance = (id: string) => {
    setExs(prev => prev.map(e => {
      if (e.id !== id) return e;
      const next = e.status === "待处理" ? "处理中" : "已闭环";
      return { ...e, status: next as any };
    }));
    toast.success("工单状态已更新");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="开单异常" value={String(exs.length)} sub="近 30 天" icon={AlertOctagon} color={A.red} />
        <KpiCard label="待处理"   value={String(exs.filter(e => e.status === "待处理").length)} sub="待响应"   icon={AlertCircle} color={A.orange} />
        <KpiCard label="高优先级" value={String(exs.filter(e => e.severity === "高").length)} sub="需 24h 内闭环" icon={AlertTriangle} color={A.purple} />
        <KpiCard label="闭环率"   value={`${((exs.filter(e => e.status === "已闭环").length / exs.length) * 100).toFixed(0)}%`} sub="月度" delta="+8pts" positive icon={CheckCircle2} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>收货异常工单</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["工单编号", "GRN", "异常类型", "详情", "严重度", "责任人", "创建", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exs.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < exs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{e.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.grn}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.label }}>{e.type}</td>
                <td className="px-5 py-3" style={{ color: A.sub, maxWidth: 280 }}>{e.detail}</td>
                <td className="px-5 py-3">
                  <Chip label={e.severity}
                    color={e.severity === "高" ? A.red : e.severity === "中" ? A.orange : A.blue}
                    bg={e.severity === "高" ? "rgba(255,59,48,0.1)" : e.severity === "中" ? "rgba(255,149,0,0.1)" : "rgba(0,113,227,0.1)"} />
                </td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.owner}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{e.createdAt}</td>
                <td className="px-5 py-3">
                  <Chip label={e.status}
                    color={e.status === "已闭环" ? A.green : e.status === "处理中" ? A.blue : A.orange}
                    bg={e.status === "已闭环" ? "rgba(52,199,89,0.1)" : e.status === "处理中" ? "rgba(0,113,227,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {e.status !== "已闭环" && <button onClick={() => advance(e.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>{e.status === "待处理" ? "受理" : "闭环"}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingReturns() {
  const [returns, setReturns] = useState(SUPPLIER_RETURNS);
  const advance = (id: string) => {
    setReturns(prev => prev.map(r => {
      if (r.id !== id) return r;
      const order = ["已开单", "已发出", "已确认", "已结案"] as const;
      const idx = order.indexOf(r.status as any);
      const next = order[Math.min(order.length - 1, idx + 1)];
      return { ...r, status: next };
    }));
    toast.success("退货状态已更新");
  };

  const totalAmt = returns.reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="退货工单" value={String(returns.length)}                              sub="近 30 天"           icon={Undo2}        color={A.orange} />
        <KpiCard label="退货金额" value={`¥${(totalAmt / 1e4).toFixed(1)}万`}                 sub="累计"               icon={DollarSign}    color={A.red} />
        <KpiCard label="在途"     value={String(returns.filter(r => r.status === "已发出").length)} sub="待供应商确认" icon={Truck}        color={A.blue} />
        <KpiCard label="已结案"   value={String(returns.filter(r => r.status === "已结案").length)} sub="完成"           icon={CheckCircle2} color={A.green} />
      </div>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>退货供应商 (SRN)</h2>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["SRN 编号", "原 PO", "供应商", "原因", "数量", "金额", "创建", "状态", "操作"].map(h => (
                <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < returns.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className="px-5 py-3 font-medium" style={{ color: A.blue }}>{r.id}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.po}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{r.supplier}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.reason}</td>
                <td className="px-5 py-3" style={{ color: A.label }}>{r.qty}</td>
                <td className="px-5 py-3 font-medium" style={{ color: A.red }}>¥{r.amount.toLocaleString()}</td>
                <td className="px-5 py-3" style={{ color: A.sub }}>{r.createdAt}</td>
                <td className="px-5 py-3">
                  <Chip label={r.status}
                    color={r.status === "已结案" ? A.green : r.status === "已确认" ? A.purple : r.status === "已发出" ? A.blue : A.orange}
                    bg={r.status === "已结案" ? "rgba(52,199,89,0.1)" : r.status === "已确认" ? "rgba(175,82,222,0.1)" : r.status === "已发出" ? "rgba(0,113,227,0.1)" : "rgba(255,149,0,0.1)"} />
                </td>
                <td className="px-5 py-3">
                  {r.status !== "已结案" && <button onClick={() => advance(r.id)} className="px-2 py-1 text-[11px] font-medium rounded-md text-white" style={{ background: A.blue }}>推进</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ReceivingOps() {
  const [docs, setDocs] = useState<ReceivingDoc[]>(receivingDocs);
  const [orders, setOrders] = useState<PurchaseOrder[]>(purchaseOrders);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [activeGrn, setActiveGrn] = useState<ReceivingDoc | null>(null);
  const [selectedGrnId, setSelectedGrnId] = useState(receivingDocs[0]?.grn ?? "");
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      apiJson<ReceivingDoc[]>("/api/receiving-docs"),
      apiJson<PurchaseOrder[]>("/api/purchase-orders"),
    ])
      .then(([receiving, purchase]) => {
        if (!alive) return;
        setDocs(receiving);
        setOrders(purchase);
        setSelectedGrnId((current) => receiving.some((item) => item.grn === current) ? current : receiving[0]?.grn ?? "");
      })
      .catch(() => toast.error("收货 API 未连接", { description: "请先运行 npm run api，再运行 npm run dev" }))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const todayReceived = docs.filter((d) => d.status === "已入库").length;
  const inQC          = docs.filter((d) => d.status === "质检中").length;
  const exceptions    = docs.filter((d) => d.status === "异常处理").length;
  const pending       = docs.filter((d) => d.status === "待收货").length;
  const selectedGrn = docs.find((item) => item.grn === selectedGrnId) ?? docs[0] ?? null;

  async function startReceive(grnId: string, poId: string, lines: ReceivingDocLine[]) {
    const po = orders.find((p) => p.po === poId);
    const receivedQty = lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
    const acceptedQty = lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
    const rejectedQty = lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);
    const created = await apiJson<ReceivingDoc>("/api/receiving-docs", {
      method: "POST",
      body: JSON.stringify({
        grn: grnId,
        po: poId,
        supplier: po?.supplier,
        items: receivedQty,
        passed: acceptedQty,
        failed: rejectedQty,
        lines,
        status: "质检中",
      }),
    });
    setDocs((arr) => [created, ...arr]);
    setSelectedGrnId(created.grn);
    setOrders((arr) => arr.map((o) => o.po === poId && o.status === "已发出" ? { ...o, status: "部分到货" } : o));
  }

  function openQC(grn: ReceivingDoc) {
    if (grn.status === "待收货") { toast.error(`${grn.grn} 尚未签收，请先签收`); return; }
    setSelectedGrnId(grn.grn);
    setActiveGrn(grn);
    setQcOpen(true);
  }

  async function signIn(grn: ReceivingDoc) {
    const updated = await apiJson<ReceivingDoc>(`/api/receiving-docs/${encodeURIComponent(grn.grn)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "质检中", receiver: "刘建华" }),
    });
    setDocs((arr) => arr.map((d) => d.grn === grn.grn ? updated : d));
    setSelectedGrnId(updated.grn);
    toast.success(`${grn.grn} 已签收`, { description: "已转入质检流程" });
  }

  async function completeQC(grnId: string, lines: ReceivingDocLine[], warehouse: string) {
    const passed = lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
    const failed = lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);
    const items = lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
    const updated = await apiJson<ReceivingDoc>(`/api/receiving-docs/${encodeURIComponent(grnId)}`, {
      method: "PATCH",
      body: JSON.stringify({ lines, passed, failed, items, warehouse, status: failed > 0 ? "异常处理" : "已入库" }),
    });
    setDocs((arr) => arr.map((d) => d.grn === grnId ? updated : d));
    setSelectedGrnId(updated.grn);
    const refreshedOrders = await apiJson<PurchaseOrder[]>("/api/purchase-orders");
    setOrders(refreshedOrders);
  }

  async function resolveException(grnId: string, action: string) {
    toast.warning(`异常处理需要退货/冲销流程：${action}`, {
      description: `${grnId} 已过账数据不能直接改为已入库，避免重复加库存。`,
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="今日已入库" value={String(todayReceived)} sub="¥482 万 入库价值" delta="+18%" positive icon={PackageCheck} color={A.green}  />
        <KpiCard label="待收货"     value={String(pending)}      sub="未来 24 小时"      delta="6 个 Dock" positive icon={Truck}        color={A.blue}   />
        <KpiCard label="质检中"     value={String(inQC)}         sub="平均 1.8 小时"     delta="-0.4h"      positive icon={ScanLine}     color={A.orange} />
        <KpiCard label="异常处理"   value={String(exceptions)}   sub="本月累计 12 起"    delta="+1 vs 昨日" positive={false} icon={AlertCircle} color={A.red}    />
      </div>

      {/* Schedule + Dock */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3 p-5">
          <SectionHeader title="今日到货排期"
            right={<span className="text-[11px]" style={{ color: A.gray2 }}>{arrivalSchedule.length} 车 · 4 个月台</span>} />
          <div className="space-y-0">
            {arrivalSchedule.map((s, i) => {
              const arrived = s.status === "已到达";
              const enroute = s.status === "在途";
              return (
                <div key={i} className="flex items-center gap-4 py-2.5"
                  style={{ borderBottom: i < arrivalSchedule.length - 1 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
                  <div className="w-12 text-xs font-semibold tabular-nums shrink-0" style={{ color: A.label }}>{s.time}</div>
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: arrived ? A.green : enroute ? A.orange : A.gray3 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium" style={{ color: A.label }}>{s.supplier}</div>
                    <div className="text-[11px]" style={{ color: A.gray2 }}>{s.po} · {s.driver}</div>
                  </div>
                  <Chip label={s.dock} color={A.indigo} bg="#eef0ff" />
                  <span className="text-[11px] font-medium w-14 text-right"
                    style={{ color: arrived ? A.green : enroute ? A.orange : A.gray1 }}>{s.status}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-2 p-5">
          <SectionHeader title="月台利用率"
            right={<span className="text-[11px]" style={{ color: A.gray2 }}>实时</span>} />
          <div className="space-y-3.5">
            {[
              { dock: "Dock-01", used: 78, jobs: 4, status: "占用中", color: A.green },
              { dock: "Dock-02", used: 62, jobs: 3, status: "占用中", color: A.green },
              { dock: "Dock-03", used: 51, jobs: 2, status: "等待",   color: A.orange },
              { dock: "Dock-04", used: 41, jobs: 2, status: "空闲",   color: A.gray2 },
            ].map((d) => (
              <div key={d.dock}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={11} style={{ color: A.gray2 }} />
                    <span className="text-xs font-medium" style={{ color: A.label }}>{d.dock}</span>
                    <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                      style={{ background: `${d.color}18`, color: d.color }}>{d.status}</span>
                  </div>
                  <span className="text-[11px]" style={{ color: A.gray1 }}>{d.jobs} 单 · {d.used}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: A.gray5 }}>
                  <div className="h-full rounded-full" style={{ width: `${d.used}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
            <div>
              <div className="text-[10px]" style={{ color: A.gray2 }}>平均利用率</div>
              <div className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>58%</div>
            </div>
            <button className="text-[11px] px-3 py-1.5 rounded-lg font-medium" style={{ background: A.gray6, color: A.label }}>
              排程优化
            </button>
          </div>
        </Card>
      </div>

      {/* GRN list */}
      <Card>
        <div className="flex items-center px-5 py-3.5 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <h2 className="text-sm font-semibold" style={{ color: A.label }}>收货单 (GRN)</h2>
          <span className="text-xs" style={{ color: A.gray2 }}>{loading ? "加载中" : `${docs.length} 条`}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setScanOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium hover:bg-gray-200 transition-colors"
              style={{ background: A.gray6, color: A.label }}>
              <ScanLine size={11} /> 扫码收货
            </button>
            <button onClick={() => setScanOpen(true)}
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
              style={{ background: A.blue }}>
              <Plus size={11} /> 新建收货单
            </button>
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {["GRN", "关联 PO", "供应商", "到货时间", "Dock", "收货人", "质检", "入库", "状态", "操作"].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((r, i) => {
              const lines = grnLinesOf(r);
              const receivedQty = lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
              const acceptedQty = lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
              const rejectedQty = lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);
              return (
              <tr key={r.grn} onClick={() => setSelectedGrnId(r.grn)}
                className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                style={{
                  borderBottom: i < docs.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none",
                  background: selectedGrn?.grn === r.grn ? "rgba(0,113,227,0.06)" : "transparent",
                }}>
                <td className="px-4 py-3 font-medium" style={{ color: A.blue }}>
                  <div>{r.grn}</div>
                  {isPostedGrn(r) && (
                    <div className="text-[9px] font-normal truncate" style={{ color: A.gray2 }}>
                      {r.postedAt ? `posted ${new Date(r.postedAt).toLocaleString("zh-CN")}` : "posted"}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: A.indigo }}>{r.po}</td>
                <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{r.supplier}</td>
                <td className="px-4 py-3" style={{ color: A.sub }}>{r.arrived}</td>
                <td className="px-4 py-3"><Chip label={r.dock} color={A.indigo} bg="#eef0ff" /></td>
                <td className="px-4 py-3" style={{ color: A.label }}>{r.receiver}</td>
                <td className="px-4 py-3 tabular-nums">
                  <span style={{ color: A.green }}>{acceptedQty}</span>
                  <span style={{ color: A.gray3 }}> / </span>
                  <span style={{ color: rejectedQty > 0 ? A.red : A.gray3 }}>{rejectedQty}</span>
                  <span style={{ color: A.gray3 }}> / </span>
                  <span style={{ color: A.label }}>{receivedQty}</span>
                  <div className="text-[9px]" style={{ color: A.gray2 }}>{lines.length} lines</div>
                </td>
                <td className="px-4 py-3" style={{ color: r.warehouse === "—" ? A.gray3 : A.label }}>{r.warehouse}</td>
                <td className="px-4 py-3"><RecvStatusPill status={r.status} /></td>
                <td className="px-4 py-3">
                  {r.status === "待收货" && (
                    <button onClick={() => signIn(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ background: A.blue }}>签收</button>
                  )}
                  {r.status === "质检中" && (
                    <button onClick={() => openQC(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-1"
                      style={{ background: A.orange }}>
                      <ScanLine size={10} /> 开始质检
                    </button>
                  )}
                  {r.status === "异常处理" && (
                    <button onClick={() => openQC(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium hover:bg-red-100 transition-colors"
                      style={{ background: "#fff1f0", color: A.red }}>查看异常</button>
                  )}
                  {r.status === "已入库" && (
                    <button onClick={() => openQC(r)}
                      className="text-[11px] px-2 py-1 rounded-md font-medium hover:bg-gray-200 transition-colors"
                      style={{ background: A.gray6, color: A.label }}>查看</button>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </Card>

      {selectedGrn && (
        <Card className="p-5">
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: A.gray2 }}>收货单详情</div>
              <div className="flex items-center gap-2 mb-3">
                <div className="text-base font-semibold tracking-tight" style={{ color: A.label }}>{selectedGrn.grn}</div>
                <RecvStatusPill status={selectedGrn.status} />
              </div>
              <div className="space-y-2 text-xs">
                {[
                  ["关联 PO", selectedGrn.po],
                  ["供应商", selectedGrn.supplier],
                  ["收货人", selectedGrn.receiver || "—"],
                  ["入库库位", selectedGrn.warehouse || "—"],
                  ["库存移动", selectedGrn.inventoryMovementIds?.join(", ") || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span style={{ color: A.gray1 }}>{label}</span>
                    <span className="font-medium text-right truncate" style={{ color: A.label }}>{value}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
                {(() => {
                  const lines = grnLinesOf(selectedGrn);
                  return [
                    ["收货", lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0)],
                    ["合格", lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0)],
                    ["拒收", lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg px-2 py-1.5" style={{ background: A.gray6 }}>
                      <div style={{ color: A.gray2 }}>{label}</div>
                      <div className="font-semibold tabular-nums" style={{ color: A.label }}>{Number(value).toLocaleString()}</div>
                    </div>
                  ));
                })()}
              </div>
              <button onClick={() => setDetailOpen(true)}
                className="mt-3 h-8 px-3 rounded-lg text-xs font-semibold"
                style={{ background: "#f0f6ff", color: A.blue }}>
                查看 ERP 单据
              </button>
            </div>
            <div className="col-span-3">
              <DocumentHistoryPanel
                entityType="receivingDoc"
                entityId={selectedGrn.grn}
                title="收货单历史"
                refreshKey={selectedGrn.lastAuditId || selectedGrn.auditTrailIds?.join(",") || selectedGrn.status}
              />
            </div>
          </div>
        </Card>
      )}

      {/* QC exceptions */}
      <Card className="p-5">
        <SectionHeader title="质检异常处理"
          right={<span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#fff1f0", color: A.red }}>{qcExceptions.length} 项待跟进</span>} />
        <div className="space-y-2.5">
          {qcExceptions.map((q, i) => {
            const sev = q.severity === "高" ? A.red : q.severity === "中" ? A.orange : A.gray1;
            return (
              <div key={i} className="flex items-center gap-4 p-3 rounded-xl"
                style={{ background: A.gray6, border: `1px solid ${sev}20` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${sev}18` }}>
                  <AlertCircle size={14} style={{ color: sev }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: A.label }}>{q.item}</span>
                    <Chip label={q.severity} color={sev} bg={`${sev}18`} />
                  </div>
                  <div className="text-[11px]" style={{ color: A.sub }}>
                    {q.grn} · {q.po} · 不合格 {q.failed}/{q.qty} · {q.type}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => resolveException(q.grn, q.action)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1 transition-opacity hover:opacity-80"
                    style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
                    {q.action} <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <ScanReceiveModal open={scanOpen} onClose={() => setScanOpen(false)}
        candidates={orders.filter((p) => ["已发出", "部分到货"].includes(p.status) && poLinesOf(p).some((line) => lineRemaining(line) > 0))}
        onReceive={startReceive} />
      <Modal open={detailOpen && Boolean(selectedGrn)} onClose={() => setDetailOpen(false)} width={980}
        title="收货单" subtitle="GRN · ERP document form">
        {selectedGrn && (() => {
          const lines = grnLinesOf(selectedGrn);
          const receivedQty = lines.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
          const acceptedQty = lines.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
          const rejectedQty = lines.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);
          const relatedPo = orders.find((item) => item.po === selectedGrn.po) || purchaseOrders.find((item) => item.po === selectedGrn.po);
          const estimatedAmount = relatedPo ? Math.round((relatedPo.amount || 0) * (acceptedQty / Math.max(1, poLinesOf(relatedPo).reduce((sum, line) => sum + toNumber(line.quantityOrdered), 0)))) : 0;
          return (
            <DocumentShell
              title="收货单"
              documentNo={selectedGrn.grn}
              moduleLabel="收货 / GRN"
              status={selectedGrn.status}
              subtitle={`${selectedGrn.supplier} · PO ${selectedGrn.po}`}
            >
              <DocumentHeader
                fields={[
                  { label: "GRN编号", value: selectedGrn.grn },
                  { label: "供应商", value: selectedGrn.supplier },
                  { label: "PO", value: selectedGrn.po, tone: "info" },
                  { label: "收货日期", value: selectedGrn.arrived },
                  { label: "仓库", value: selectedGrn.warehouse || "—" },
                  { label: "状态", value: selectedGrn.status, tone: statusTone(selectedGrn.status) },
                  { label: "质检状态", value: selectedGrn.failed > 0 ? "存在拒收" : selectedGrn.status === "质检中" ? "质检中" : "通过", tone: selectedGrn.failed > 0 ? "danger" : selectedGrn.status === "质检中" ? "warning" : "success" },
                  { label: "负责人", value: selectedGrn.receiver || "—" },
                  { label: "Dock", value: selectedGrn.dock || "—" },
                  { label: "库存过账", value: selectedGrn.inventoryApplied ? "已应用" : "未应用", tone: selectedGrn.inventoryApplied ? "success" : "warning" },
                  { label: "库存移动", value: selectedGrn.inventoryMovementIds?.join(", ") || "—" },
                  { label: "过账时间", value: selectedGrn.postedAt ? new Date(selectedGrn.postedAt).toLocaleString("zh-CN") : "—" },
                ]}
                columns={4}
              />
              <DocumentStatusTimeline steps={receivingTimeline(selectedGrn)} />
              <DocumentLinesTable
                rows={lines.length ? lines : [{
                  grnLineId: `${selectedGrn.grn}-SUMMARY`,
                  sku: "SUMMARY",
                  itemName: "收货汇总行",
                  receivedQty: selectedGrn.items,
                  acceptedQty: selectedGrn.passed,
                  rejectedQty: selectedGrn.failed,
                  unit: "件",
                  status: selectedGrn.status,
                }]}
                columns={[
                  { key: "sku", label: "SKU", render: (line) => <span style={{ color: A.blue }}>{String(line.sku)}</span> },
                  { key: "itemName", label: "品名", render: (line) => String(line.itemName || "—") },
                  { key: "orderedQty", label: "订单数量", align: "right", render: (line) => String((line as any).orderedQty ?? "—") },
                  { key: "receivedQty", label: "收货数量", align: "right", render: (line) => Number(line.receivedQty || 0).toLocaleString() },
                  { key: "acceptedQty", label: "合格数量", align: "right", render: (line) => Number(line.acceptedQty || 0).toLocaleString() },
                  { key: "rejectedQty", label: "拒收数量", align: "right", render: (line) => Number(line.rejectedQty || 0).toLocaleString() },
                  { key: "unit", label: "单位", render: (line) => String(line.unit || "件") },
                  { key: "variance", label: "差异", render: (line) => Number(line.rejectedQty || 0) > 0 ? "拒收差异" : "无差异" },
                  { key: "status", label: "备注", render: (line) => String(line.status || selectedGrn.status) },
                ]}
              />
              <DocumentTotals
                totals={[
                  { label: "收货数量", value: receivedQty.toLocaleString() },
                  { label: "合格数量", value: acceptedQty.toLocaleString(), tone: "success" },
                  { label: "拒收数量", value: rejectedQty.toLocaleString(), tone: rejectedQty > 0 ? "danger" : "success" },
                  { label: "收货金额", value: estimatedAmount ? fmt(estimatedAmount) : "—" },
                ]}
              />
              <DocumentEvidencePanel
                linkedDocuments={getGrnLinkedDocuments(selectedGrn, purchaseOrders, SUPPLIER_INVOICES)}
                provenance="receivingDocs · demo-data / API fallback"
                notes={selectedGrn.status === "异常处理" ? "异常收货需要退货/冲销流程，本页不直接修改库存，并会影响供应商发票匹配。" : "收货明细用于库存可用量和三单匹配演示。"}
                evidence={[
                  { label: "关联 PO", value: selectedGrn.po },
                  { label: "关联发票", value: SUPPLIER_INVOICES.filter((invoice) => invoice.relatedGrn === selectedGrn.grn || invoice.relatedPo === selectedGrn.po).length },
                  { label: "三单匹配", value: SUPPLIER_INVOICES.some((invoice) => invoice.relatedGrn === selectedGrn.grn && invoice.varianceType !== "无差异") ? "存在差异" : "待复核", tone: SUPPLIER_INVOICES.some((invoice) => invoice.relatedGrn === selectedGrn.grn && invoice.varianceType !== "无差异") ? "danger" : "info" },
                  { label: "发票影响", value: rejectedQty > 0 ? "拒收数量需 AP 复核" : "无拒收影响", tone: rejectedQty > 0 ? "warning" : "success" },
                  { label: "仓库", value: selectedGrn.warehouse || "—" },
                  { label: "合格率", value: `${receivedQty ? Math.round((acceptedQty / receivedQty) * 100) : 0}%`, tone: rejectedQty > 0 ? "warning" : "success" },
                  { label: "库存应用", value: selectedGrn.inventoryApplied ? "已应用" : "未应用", tone: selectedGrn.inventoryApplied ? "success" : "warning" },
                ]}
              />
              <DocumentActionBar>
                <button onClick={() => toast("供应商发票位于采购工作台", { description: "可在供应商发票 tab 查看 GRN 关联发票。" })} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#faf3ff", color: A.purple }}>打开发票</button>
                <button onClick={() => toast("三单匹配位于采购工作台", { description: "可在三单匹配 tab 查看 PO / GRN / Invoice 对比。" })} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>打开三单匹配</button>
                <button onClick={() => exportReceivingDetail(selectedGrn)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>导出 CSV</button>
                <button onClick={() => setDetailOpen(false)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>关闭</button>
              </DocumentActionBar>
            </DocumentShell>
          );
        })()}
      </Modal>
      <QCModal open={qcOpen} onClose={() => setQcOpen(false)} grn={activeGrn} onComplete={completeQC} />
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
