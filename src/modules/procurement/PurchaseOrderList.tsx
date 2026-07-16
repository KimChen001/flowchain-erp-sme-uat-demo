import { useEffect, useState } from "react";
import { Card } from "../../components/ui";
import { EntityLink } from "../../components/business/EntityLink";
import { procurementApi } from "./procurementApi";
import { PurchaseOrderDetail } from "./PurchaseOrderDetail";
import type { ProcurementFocus, ProcurementNavigate, PurchaseOrder } from "./procurementTypes";

export function PurchaseOrderList({ focus, onNavigate }: { focus?: ProcurementFocus; onNavigate?: ProcurementNavigate }) {
  const [rows, setRows] = useState<PurchaseOrder[]>([]), [error, setError] = useState("");
  const load = () => procurementApi.listOrders().then(data => { setRows(data); setError(""); }).catch((cause: Error) => setError(cause.message));
  useEffect(() => { void load(); }, []);
  const selected = focus?.entityType === "purchase_order" ? rows.find(row => row.id === focus.entityId) : undefined;
  if (error) return <Card className="p-12 text-center">采购订单加载失败<button onClick={() => void load()}>重试</button></Card>;
  if (selected) return <PurchaseOrderDetail order={selected} onNavigate={onNavigate} />;
  return <div className="space-y-4"><h1 className="text-lg font-semibold">采购订单</h1>{rows.length === 0 ? <Card className="py-14 text-center text-sm">暂无采购订单<br/><span className="text-xs">审批通过并转换后，Draft PO 将显示在这里。</span></Card> : <Card className="overflow-hidden"><table className="w-full text-xs"><thead><tr>{["采购订单", "Supplier", "状态", "发送状态", "金额", "来源 PR"].map(label => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3"><EntityLink kind="purchase_order" id={row.id}>{row.id}</EntityLink></td><td className="p-3"><EntityLink kind="supplier" id={row.supplierId}>{row.supplierSnapshot?.supplierName || row.supplierId}</EntityLink></td><td className="p-3">{row.status}</td><td className="p-3">{row.transmissionStatus}</td><td className="p-3">{row.totalAmount}</td><td className="p-3"><EntityLink kind="purchase_request" id={row.sourcePrId || row.sourcePurchaseRequestId}>{row.sourcePrId || row.sourcePurchaseRequestId}</EntityLink></td></tr>)}</tbody></table></Card>}</div>;
}
