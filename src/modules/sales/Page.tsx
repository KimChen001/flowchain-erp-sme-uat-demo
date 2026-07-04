import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, ClipboardList, FileText, GitBranch, PackageSearch, ShoppingCart, Truck, Users } from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { A, Card, Chip, KpiCard, SectionHeader } from "../../components/ui";
import { typography } from "../../components/ui/typography";
import type { InventoryAvailability } from "../inventory/api";

type SalesOrder = {
  salesOrderId: string;
  customerName: string;
  customerTier: string;
  sku: string;
  itemName: string;
  orderedQty: number;
  reservedQty: number;
  fulfilledQty: number;
  shortageQty: number;
  promisedDate: string;
  statusLabel: string;
  priority: string;
  deliveryRiskLevel: "blocked" | "high" | "medium" | "low";
  deliveryRiskLabel: string;
  deliveryRiskReason: string;
  linkedInventory?: { availableQuantity?: number; safetyStock?: number; status?: string } | null;
  linkedPurchaseOrders: Array<{ id: string; supplierName?: string; status?: string; expectedDate?: string }>;
  linkedSuppliers: Array<{ id: string; name: string; risk?: string; status?: string }>;
  linkedReceivingDocs: Array<{ id: string; status?: string; poId?: string }>;
  linkedExceptionCases: string[];
  evidence: Array<{ type: string; id: string; label: string; summary?: string; status?: string }>;
  dataLimitations: string[];
};

type SalesSummary = {
  totalOrders: number;
  riskOrderCount: number;
  highRiskOrderCount: number;
  shortageQty: number;
  reservedQty: number;
  affectedCustomerCount: number;
};

type FocusTarget = {
  entityType: string;
  entityId: string;
  entityLabel?: string;
} | null;

type SalesView = "orders" | "risks" | "evidence";

type SalesDemandPageProps = {
  initialView?: "risks" | "evidence" | string;
  focus?: FocusTarget;
  onNavigate?: (moduleId: string) => void;
  onOpenAi?: () => void;
};

const riskColor: Record<string, string> = {
  blocked: A.red,
  high: A.red,
  medium: A.orange,
  low: A.green,
};

const riskRank: Record<SalesOrder["deliveryRiskLevel"], number> = {
  blocked: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function limitationLabel(code: string) {
  return ({
    missing_inventory_allocation: "当前工作区缺少完整库存分配记录",
    missing_purchase_order_links: "当前工作区缺少完整采购订单关联",
    missing_receiving_records: "当前工作区缺少完整收货记录",
    missing_supplier_risk_records: "当前工作区缺少完整供应商风险记录",
    current_workspace_data_limited: "当前数据范围有限，需人工复核",
    record_not_found: "未找到对应记录",
  } as Record<string, string>)[code] || code;
}

function qty(value: number) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function viewFromInitial(initialView?: string): SalesView {
  if (initialView === "evidence") return "evidence";
  if (initialView === "risks") return "risks";
  return "orders";
}

export default function SalesDemandPage({ initialView, focus, onNavigate, onOpenAi }: SalesDemandPageProps) {
  const view = viewFromInitial(initialView);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [availability, setAvailability] = useState<InventoryAvailability[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [allocationWarning, setAllocationWarning] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");

  useEffect(() => {
    let alive = true;
    setLoadingOrders(true);
    setOrdersError("");
    apiJson<{ orders: SalesOrder[]; summary: SalesSummary }>("/api/sales-demand/orders")
      .then((payload) => {
        if (!alive) return;
        setOrders(payload.orders || []);
        setSummary(payload.summary || null);
      })
      .catch(() => {
        if (!alive) return;
        setOrdersError("当前未读取到客户订单记录，请检查工作区数据或刷新后重试。");
      })
      .finally(() => { if (alive) setLoadingOrders(false); });

    apiJson<{ availability: InventoryAvailability[] }>("/api/inventory/availability")
      .then((payload) => {
        if (!alive) return;
        setAvailability(payload.availability || []);
        setAllocationWarning("");
      })
      .catch(() => {
        if (!alive) return;
        setAvailability([]);
        setAllocationWarning("当前工作区暂未读取到完整库存分配记录，因此可承诺量和预留建议需人工复核。");
      });

    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!focus?.entityId) return;
    setSelectedOrderId(focus.entityId);
  }, [focus?.entityId]);

  const focusedOrder = useMemo(() => {
    if (!focus?.entityId) return null;
    return orders.find((order) => order.salesOrderId === focus.entityId) || null;
  }, [focus, orders]);
  const selectedOrder = useMemo(() => {
    return orders.find((order) => order.salesOrderId === selectedOrderId) || focusedOrder || null;
  }, [focusedOrder, orders, selectedOrderId]);
  const availabilityBySku = useMemo(() => new Map(availability.map((item) => [item.sku, item])), [availability]);
  const visibleOrders = useMemo(() => {
    if (!focusedOrder) return orders;
    return [focusedOrder, ...orders.filter((order) => order.salesOrderId !== focusedOrder.salesOrderId)];
  }, [orders, focusedOrder]);
  const riskOrders = useMemo(() => {
    return orders
      .filter((order) => order.deliveryRiskLevel !== "low")
      .sort((a, b) => riskRank[a.deliveryRiskLevel] - riskRank[b.deliveryRiskLevel] || b.shortageQty - a.shortageQty);
  }, [orders]);
  const evidenceOrders = useMemo(() => {
    if (selectedOrder) return [selectedOrder];
    if (focusedOrder) return [focusedOrder];
    return riskOrders.length ? riskOrders.slice(0, 3) : orders.slice(0, 3);
  }, [focusedOrder, orders, riskOrders, selectedOrder]);

  const activeSummary = summary || {
    totalOrders: orders.length,
    riskOrderCount: riskOrders.length,
    highRiskOrderCount: orders.filter((order) => order.deliveryRiskLevel === "high" || order.deliveryRiskLevel === "blocked").length,
    shortageQty: orders.reduce((sum, order) => sum + order.shortageQty, 0),
    reservedQty: orders.reduce((sum, order) => sum + order.reservedQty, 0),
    affectedCustomerCount: new Set(riskOrders.map((order) => order.customerName)).size,
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#f0f6ff", color: A.blue }}>
            <ClipboardList size={17} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>销售需求</h1>
            <p className="text-xs mt-0.5" style={{ color: A.sub }}>
              {view === "orders" ? "客户订单" : view === "risks" ? "交付风险" : "订单证据链"}
            </p>
            <div className="mt-3 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.blue }}>
              <span className="font-semibold">销售需求使用边界：</span>
              当前页面基于工作区内的客户订单、库存、采购、收货和供应商记录识别交付风险。系统仅提供库存可用量、采购在途和供应商风险的辅助分析，不会自动确认订单、自动出库或自动通知客户。
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="客户订单" value={String(activeSummary.totalOrders)} sub="当前订单视图" icon={ClipboardList} color={A.blue} />
        <KpiCard label="交付风险" value={String(activeSummary.riskOrderCount)} sub={`${activeSummary.highRiskOrderCount} 个高风险`} icon={AlertTriangle} color={activeSummary.highRiskOrderCount ? A.red : A.orange} />
        <KpiCard label="缺口数量" value={qty(activeSummary.shortageQty)} sub="按当前订单汇总" icon={PackageSearch} color={A.red} />
        <KpiCard label="已预留数量" value={qty(activeSummary.reservedQty)} sub="当前库存分配" icon={Boxes} color={A.green} />
      </div>

      {ordersError && <Card className="p-4 text-sm" style={{ color: A.red }}>{ordersError}</Card>}
      {loadingOrders && <Card className="p-6 text-sm" style={{ color: A.sub }}>正在读取客户订单...</Card>}
      {!loadingOrders && !ordersError && orders.length === 0 && (
        <Card className="p-6 text-sm" style={{ color: A.sub }}>
          当前工作区暂无客户订单记录。后续可通过订单导入或业务数据接入生成客户订单视图。
        </Card>
      )}

      {!loadingOrders && !ordersError && orders.length > 0 && view === "orders" && (
        <div className="grid grid-cols-[1.3fr_0.7fr] gap-5">
          <Card>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
              <SectionHeader title="客户订单列表" />
              <span className="text-[11px]" style={{ color: A.sub }}>{visibleOrders.length} 条</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${A.border}` }}>
                    {["客户订单号", "客户", "SKU / 物料", "订单数量", "已预留", "缺口", "承诺日期", "风险等级", "状态", "操作"].map((header) => (
                      <th key={header} className="px-3 py-3 text-left font-semibold" style={{ color: A.gray1 }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order, index) => (
                    <tr key={order.salesOrderId} data-testid={`sales-order-${order.salesOrderId}`} style={{ borderBottom: index < visibleOrders.length - 1 ? `1px solid ${A.border}` : "none", background: selectedOrder?.salesOrderId === order.salesOrderId ? "#f0f6ff" : A.white }}>
                      <td className="px-3 py-3 font-semibold tabular-nums" style={{ color: A.blue }}>{order.salesOrderId}</td>
                      <td className="px-3 py-3" style={{ color: A.label }}>{order.customerName}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold tabular-nums" style={{ color: A.label }}>{order.sku}</div>
                        <div className="text-[10px] truncate max-w-[180px]" style={{ color: A.sub }}>{order.itemName}</div>
                      </td>
                      <td className="px-3 py-3 tabular-nums" style={{ color: A.label }}>{qty(order.orderedQty)}</td>
                      <td className="px-3 py-3 tabular-nums" style={{ color: A.green }}>{qty(order.reservedQty)}</td>
                      <td className="px-3 py-3 tabular-nums font-semibold" style={{ color: order.shortageQty > 0 ? A.red : A.gray2 }}>{qty(order.shortageQty)}</td>
                      <td className="px-3 py-3" style={{ color: A.sub }}>{order.promisedDate || "待确认"}</td>
                      <td className="px-3 py-3"><Chip label={order.deliveryRiskLabel} color={riskColor[order.deliveryRiskLevel] || A.gray1} bg={`${riskColor[order.deliveryRiskLevel] || A.gray1}16`} /></td>
                      <td className="px-3 py-3" style={{ color: A.sub }}>{order.statusLabel}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => setSelectedOrderId(order.salesOrderId)} className="px-2.5 py-1.5 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>查看详情</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <OrderDetailPanel
            order={selectedOrder}
            allocation={selectedOrder ? availabilityBySku.get(selectedOrder.sku) : undefined}
            allocationWarning={allocationWarning}
            onNavigate={onNavigate}
          />
        </div>
      )}

      {!loadingOrders && !ordersError && orders.length > 0 && view === "risks" && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
            <SectionHeader title="交付风险队列" />
            <span className="text-[11px]" style={{ color: A.sub }}>仅显示中高风险和阻断订单</span>
          </div>
          <div className="divide-y" style={{ borderColor: A.border }}>
            {riskOrders.map((order) => (
              <div key={order.salesOrderId} className="p-4">
                <div className="grid grid-cols-[120px_1fr_120px_160px] gap-3 items-start">
                  <Chip label={order.deliveryRiskLabel} color={riskColor[order.deliveryRiskLevel] || A.gray1} bg={`${riskColor[order.deliveryRiskLevel] || A.gray1}16`} />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm tabular-nums" style={{ color: A.label }}>{order.salesOrderId} · {order.customerName}</div>
                    <div className="mt-1 text-xs truncate" style={{ color: A.sub }}>{order.sku} / {order.itemName} · 缺口 {qty(order.shortageQty)} · 承诺日期 {order.promisedDate || "待确认"}</div>
                    <div className="mt-1 text-[11px] leading-5 line-clamp-2" style={{ color: A.gray1 }}>{order.deliveryRiskReason}</div>
                  </div>
                  <div className="text-[11px] leading-5" style={{ color: A.orange }}>建议动作：复核库存分配、在途采购和供应商交付承诺。</div>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <button onClick={() => { setSelectedOrderId(order.salesOrderId); onNavigate?.("sales"); }} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>查看订单</button>
                    <button onClick={() => onNavigate?.("inventory")} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>查看库存</button>
                    <button onClick={() => onNavigate?.("procurement:orders")} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>查看采购订单</button>
                    <button onClick={() => { setSelectedOrderId(order.salesOrderId); onNavigate?.("sales:evidence"); }} className="px-2 py-1 rounded-md font-medium" style={{ background: "#f0f6ff", color: A.blue }}>查看证据链</button>
                    <button onClick={onOpenAi} className="px-2 py-1 rounded-md font-medium" style={{ background: "#fff8f0", color: A.orange }}>让 AI 解释此风险</button>
                  </div>
                </div>
              </div>
            ))}
            {riskOrders.length === 0 && (
              <div className="p-6 text-sm" style={{ color: A.sub }}>当前没有需要进入风险队列的客户订单。</div>
            )}
          </div>
        </Card>
      )}

      {!loadingOrders && !ordersError && orders.length > 0 && view === "evidence" && (
        <EvidenceChainView orders={evidenceOrders} onNavigate={onNavigate} />
      )}
    </div>
  );
}

function OrderDetailPanel({
  order,
  allocation,
  allocationWarning,
  onNavigate,
}: {
  order: SalesOrder | null;
  allocation?: InventoryAvailability;
  allocationWarning: string;
  onNavigate?: (moduleId: string) => void;
}) {
  if (!order) {
    return (
      <Card className="p-6 text-sm leading-6" style={{ color: A.sub }}>
        请选择一个客户订单查看库存分配和证据链详情。
      </Card>
    );
  }
  return (
    <Card>
      <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
        <SectionHeader title="客户订单详情" />
        <p className="text-[11px] mt-1 tabular-nums" style={{ color: A.sub }}>{order.salesOrderId} · {order.customerName}</p>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {[
            ["订单数量", qty(order.orderedQty)],
            ["已预留", qty(order.reservedQty)],
            ["缺口", qty(order.shortageQty)],
            ["状态", order.statusLabel],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg p-2" style={{ background: A.gray6 }}>
              <div style={{ color: A.gray2 }}>{label}</div>
              <div className="mt-1 font-semibold tabular-nums" style={{ color: label === "缺口" && order.shortageQty > 0 ? A.red : A.label }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-3" style={{ background: "#f0f6ff" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold" style={{ color: A.label }}>库存分配摘要</div>
            <Chip label={allocation?.riskLabel || "需人工复核"} color={allocation?.riskLevel === "low" ? A.green : allocation?.riskLevel === "medium" ? A.orange : A.red} bg={allocation?.riskLevel === "low" ? "#f0faf4" : allocation?.riskLevel === "medium" ? "#fff8f0" : "#fff1f0"} />
          </div>
          {allocation ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["可承诺量", allocation.availableToPromiseQty],
                ["可预留", allocation.reservableQty],
                ["在途采购", allocation.incomingPurchaseQty],
                ["预计可用", allocation.projectedAvailableQty],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg px-2 py-2" style={{ background: A.white }}>
                  <div style={{ color: A.gray2 }}>{label}</div>
                  <div className="font-semibold tabular-nums" style={{ color: A.label }}>{Number(value).toLocaleString("zh-CN")}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-[11px] leading-5" style={{ color: A.orange }}>
              {allocationWarning || "当前工作区暂未读取到完整库存分配记录，因此可承诺量和预留建议需人工复核。"}
            </div>
          )}
        </div>

        <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
          <div className="text-xs font-semibold" style={{ color: A.label }}>数据限制</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(order.dataLimitations.length ? order.dataLimitations : ["current_workspace_data_limited"]).map((item) => (
              <span key={item} className={typography.compactMetadata} style={{ color: A.orange }}>{limitationLabel(item)}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onNavigate?.("sales:evidence")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>进入证据链</button>
          <button onClick={() => onNavigate?.("sales:risks")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#fff8f0", color: A.orange }}>进入交付风险</button>
        </div>
      </div>
    </Card>
  );
}

function EvidenceChainView({ orders, onNavigate }: { orders: SalesOrder[]; onNavigate?: (moduleId: string) => void }) {
  return (
    <div className="grid grid-cols-[0.9fr_1.1fr] gap-5">
      <Card className="p-5">
        <SectionHeader title="主证据链" right={<Chip label="只读证据" color={A.blue} bg="#f0f6ff" />} />
        <div className="mt-4 grid grid-cols-1 gap-2">
          {[
            ["客户订单", ClipboardList],
            ["SKU", PackageSearch],
            ["库存可用量", Boxes],
            ["采购订单", ShoppingCart],
            ["供应商", Users],
            ["收货单", Truck],
          ].map(([label, Icon], index) => {
            const NextIcon = Icon as typeof ClipboardList;
            return (
              <div key={label as string} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: A.gray6, color: A.blue }}>
                  <NextIcon size={14} />
                </div>
                <div className="flex-1 rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: A.white, color: A.label, boxShadow: `0 0 0 0.5px ${A.border}` }}>{label as string}</div>
                {index < 5 && <GitBranch size={14} style={{ color: A.gray2 }} />}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[11px] leading-5" style={{ color: A.sub }}>
          客户订单 → SKU → 库存可用量 → 采购订单 → 供应商 → 收货单。这里只展示关联证据、相关记录和返回路径，不会自动创建、修改或关闭任何业务单据。
        </p>
      </Card>

      <Card>
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
          <SectionHeader title="相关记录与返回路径" />
        </div>
        <div className="p-4 space-y-3">
          {orders.map((order) => (
            <div key={`evidence-${order.salesOrderId}`} className="rounded-xl p-3" style={{ background: A.gray6 }}>
              <div className="font-semibold text-xs tabular-nums" style={{ color: A.label }}>{order.salesOrderId}</div>
              <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] leading-5">
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><ClipboardList size={12} /> 客户订单：{order.customerName} · {order.statusLabel}</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><PackageSearch size={12} /> SKU / 库存可用量：{order.sku} / {order.itemName}</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><ShoppingCart size={12} /> 采购订单：{order.linkedPurchaseOrders.map((po) => `${po.id} ${po.status || ""}`).join("；") || "暂无完整采购订单关联"}</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><Users size={12} /> 供应商：{order.linkedSuppliers.map((supplier) => `${supplier.name}${supplier.risk ? ` · ${supplier.risk}` : ""}`).join("；") || "暂无完整供应商记录"}</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><Truck size={12} /> 收货单 / GRN：{order.linkedReceivingDocs.map((grn) => `${grn.id} ${grn.status || ""}`).join("；") || "暂无完整收货记录"}</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><FileText size={12} /> 发票 / 财务协同：按当前采购和收货记录人工追溯</div>
                <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><AlertTriangle size={12} /> 异常工单：{order.linkedExceptionCases.join("；") || "暂无关联异常工单"}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(order.dataLimitations.length ? order.dataLimitations : ["current_workspace_data_limited"]).map((item) => (
                  <span key={item} className={typography.compactMetadata} style={{ color: A.orange }}>{limitationLabel(item)}</span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => onNavigate?.("sales")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue }}>返回客户订单</button>
                <button onClick={() => onNavigate?.("inventory")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue }}>查看库存</button>
                <button onClick={() => onNavigate?.("procurement:orders")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue }}>查看采购订单</button>
                <button onClick={() => onNavigate?.("srm:master")} className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: A.white, color: A.blue }}>查看供应商</button>
                <button className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#f0f6ff", color: A.blue }}>生成内部通知草稿预览</button>
                <button className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "#fff8f0", color: A.orange }}>生成异常工单草稿预览</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
