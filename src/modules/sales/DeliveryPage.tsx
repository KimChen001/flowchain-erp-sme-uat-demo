import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, PackageCheck, Printer, Search, Truck } from "lucide-react";
import { A, Card, Chip, KpiCard, Modal, SectionHeader } from "../../components/ui";
import PrintLayoutEditor from "../print-layout/PrintLayoutEditor";
import { adaptDeliveryNote } from "../print-layout/printDataAdapters";
import { DELIVERY_NOTES, deliveryCustomers } from "./deliveryData";
import type { DeliveryNote, DeliveryStatus } from "./deliveryTypes";

const statuses: Array<"全部" | DeliveryStatus> = ["全部", "待拣货", "待发货", "运输中", "已送达", "已签收", "异常"];
const statusColor = (status: DeliveryStatus) => status === "异常" ? A.red : status === "已签收" ? A.green : status === "运输中" || status === "已送达" ? A.blue : A.orange;

export default function DeliveryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("全部");
  const [customer, setCustomer] = useState("全部客户");
  const [selected, setSelected] = useState<DeliveryNote | null>(null);
  const [printNote, setPrintNote] = useState<DeliveryNote | null>(null);
  const rows = useMemo(() => DELIVERY_NOTES.filter((note) => {
    const query = search.trim().toLowerCase();
    return (!query || [note.deliveryNo, note.salesOrderNo, note.customerName, note.warehouse].some((value) => value.toLowerCase().includes(query)))
      && (status === "全部" || note.status === status) && (customer === "全部客户" || note.customerName === customer);
  }), [customer, search, status]);
  const counts = (values: DeliveryStatus[]) => DELIVERY_NOTES.filter((note) => values.includes(note.status)).length;

  return (
    <div className="space-y-4" data-testid="delivery-page">
      <Card className="p-5 flex items-start justify-between gap-4">
        <div><h1 className="text-xl font-semibold" style={{ color: A.label }}>销售出库单 / 发货单</h1><p className="text-xs mt-1" style={{ color: A.sub }}>管理从销售订单出库、装运到客户签收的发货记录。</p></div>
        <button className="h-9 px-4 rounded-lg text-xs font-semibold text-white" style={{ background: A.blue }}>新建发货单</button>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="待发货" value={String(counts(["待拣货", "待发货"]))} icon={PackageCheck} color={A.orange} />
        <KpiCard label="运输中" value={String(counts(["运输中", "已送达"]))} icon={Truck} color={A.blue} />
        <KpiCard label="已签收" value={String(counts(["已签收"]))} icon={CheckCircle2} color={A.green} />
        <KpiCard label="异常" value={String(counts(["异常"]))} icon={AlertTriangle} color={A.red} />
      </div>
      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2" style={{ borderBottom: `1px solid ${A.border}` }}>
          <div className="h-9 px-3 rounded-lg flex items-center gap-2 min-w-[260px]" style={{ background: A.gray6 }}><Search size={13} style={{ color: A.gray2 }} /><input aria-label="搜索发货单" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索发货单号、销售订单、客户" className="bg-transparent outline-none text-xs w-full" /></div>
          <select aria-label="发货状态" value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])} className="h-9 rounded-lg px-3 text-xs" style={{ border: `1px solid ${A.border}` }}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="客户筛选" value={customer} onChange={(event) => setCustomer(event.target.value)} className="h-9 rounded-lg px-3 text-xs" style={{ border: `1px solid ${A.border}` }}><option>全部客户</option>{deliveryCustomers.map((item) => <option key={item}>{item}</option>)}</select>
          <span className="ml-auto text-[11px]" style={{ color: A.gray2 }}>{rows.length} 张发货单</span>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-xs">
          <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["发货单号", "销售订单号", "发货日期", "客户", "仓库", "发货数量", "物流状态", "预计到达", "操作"].map((header) => <th key={header} className="px-3 py-3 text-left font-semibold" style={{ color: A.gray1 }}>{header}</th>)}</tr></thead>
          <tbody>{rows.map((note) => <tr key={note.id} data-testid={`delivery-row-${note.deliveryNo}`} style={{ borderBottom: `1px solid ${A.border}` }}>
            <td className="px-3 py-3 font-semibold" style={{ color: A.blue }}>{note.deliveryNo}</td><td className="px-3 py-3">{note.salesOrderNo}</td><td className="px-3 py-3">{note.deliveryDate}</td>
            <td className="px-3 py-3 font-medium">{note.customerName}</td><td className="px-3 py-3">{note.warehouse}</td><td className="px-3 py-3 tabular-nums">{note.totalQuantity.toLocaleString()}</td>
            <td className="px-3 py-3"><Chip label={note.status} color={statusColor(note.status)} bg={`${statusColor(note.status)}16`} /></td><td className="px-3 py-3">{note.expectedArrivalDate || "—"}</td>
            <td className="px-3 py-3"><div className="flex gap-2"><button onClick={() => setSelected(note)} className="px-2.5 py-1.5 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>查看详情</button><button aria-label={`打印发货单 ${note.deliveryNo}`} onClick={() => setPrintNote(note)} className="px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1" style={{ background: "#f0f6ff", color: A.blue }}><Printer size={12} />打印</button></div></td>
          </tr>)}</tbody>
        </table></div>
      </Card>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="发货单详情" subtitle={selected?.deliveryNo} width={1080} footer={selected && <><button onClick={() => setSelected(null)} className="px-3 py-2 rounded-lg text-xs" style={{ background: A.white }}>关闭</button><button onClick={() => setPrintNote(selected)} className="px-3 py-2 rounded-lg text-xs text-white flex items-center gap-1" style={{ background: A.blue }}><Printer size={13} />打印发货单</button></>}>
        {selected && <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["发货单号", selected.deliveryNo], ["销售订单", selected.salesOrderNo], ["发货日期", selected.deliveryDate], ["状态", selected.status], ["客户", selected.customerName], ["仓库", selected.warehouse], ["物流公司", selected.logisticsCompany || "—"], ["预计到达", selected.expectedArrivalDate || "—"], ["司机", selected.driver || "—"], ["联系电话", selected.driverPhone || "—"], ["车辆", selected.vehicleNo || "—"], ["箱数", selected.cartonCount ?? "—"]].map(([label, value]) => <div key={label} className="rounded-lg p-3" style={{ background: A.gray6 }}><div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div><div className="text-xs font-semibold mt-1" style={{ color: A.label }}>{value}</div></div>)}</div>
          <div><SectionHeader title="商品明细" /><div className="overflow-x-auto rounded-xl border" style={{ borderColor: A.border }}><table className="w-full text-xs"><thead><tr>{["SKU", "商品名称", "订单数量", "发货数量", "单位", "批次", "箱数", "备注"].map((item) => <th key={item} className="px-3 py-2 text-left" style={{ color: A.gray1 }}>{item}</th>)}</tr></thead><tbody>{selected.lines.map((line) => <tr key={line.sku} style={{ borderTop: `1px solid ${A.border}` }}><td className="px-3 py-2" style={{ color: A.blue }}>{line.sku}</td><td className="px-3 py-2 font-medium">{line.itemName}</td><td className="px-3 py-2">{line.orderedQty}</td><td className="px-3 py-2">{line.shippedQty}</td><td className="px-3 py-2">{line.unit}</td><td className="px-3 py-2">{line.batchNo || "—"}</td><td className="px-3 py-2">{line.cartonCount || "—"}</td><td className="px-3 py-2">{line.remarks || "—"}</td></tr>)}</tbody></table></div></div>
          <div className="grid lg:grid-cols-3 gap-3"><Card className="p-4"><SectionHeader title="关联单据" /><div className="text-xs leading-6" style={{ color: A.sub }}><div>销售订单：<span style={{ color: A.blue }}>{selected.salesOrderNo}</span></div><div>库存流水：IM-{selected.deliveryNo.slice(-7)}</div><div>签收单：{selected.status === "已签收" ? "SR-2026-0710-001" : "待生成"}</div></div></Card><Card className="p-4"><SectionHeader title="操作记录" /><div className="text-xs leading-6" style={{ color: A.sub }}><div>{selected.deliveryDate} · {selected.createdBy} 创建</div><div>{selected.reviewedBy ? `${selected.reviewedBy} 审核` : "等待审核"}</div></div></Card><Card className="p-4"><SectionHeader title="业务分析" /><div className="text-xs leading-5" style={{ color: selected.status === "异常" ? A.red : A.sub }}>{selected.status === "异常" ? selected.remarks : "当前发货记录无阻断风险。风险分析作为次级信息，不影响单据主体。"}</div></Card></div>
        </div>}
      </Modal>
      {printNote && <PrintLayoutEditor open documentType="delivery_note" documentNo={printNote.deliveryNo} data={adaptDeliveryNote(printNote)} onClose={() => setPrintNote(null)} />}
    </div>
  );
}
