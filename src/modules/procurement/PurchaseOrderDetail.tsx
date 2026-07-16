import { A, Card } from "../../components/ui";
import { EntityLink } from "../../components/business/EntityLink";
import type { ProcurementNavigate, PurchaseOrder } from "./procurementTypes";

export function PurchaseOrderDetail({ order, onNavigate }: { order: PurchaseOrder; onNavigate?: ProcurementNavigate }) {
  const sourceRequest = order.sourcePrId || order.sourcePurchaseRequestId;
  return <div className="space-y-4"><button onClick={() => onNavigate?.("procurement:orders")}>返回采购订单列表</button><Card className="p-5"><h1 className="text-lg font-semibold">{order.id}</h1><p className="mt-1 text-xs" style={{ color: A.sub }}>{order.status} · {order.transmissionStatus} · <EntityLink kind="supplier" id={order.supplierId}>{order.supplierSnapshot?.supplierName || order.supplierId}</EntityLink></p><div className="mt-4 text-sm">金额：{order.totalAmount} · 目标仓库：{order.targetWarehouseId || "—"}</div><h2 className="mt-5 text-sm font-semibold">来源采购申请</h2><div className="mt-2"><EntityLink kind="purchase_request" id={sourceRequest}>{sourceRequest || "—"}</EntityLink></div><h2 className="mt-5 text-sm font-semibold">采购行</h2>{order.lines.map(line => <div key={line.sourcePurchaseRequestLineId} className="border-t py-2 text-xs">{line.itemNameSnapshot} · {line.estimatedAmount} · 来源行 {line.sourcePurchaseRequestLineId}</div>)}</Card></div>;
}
