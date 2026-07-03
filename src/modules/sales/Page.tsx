import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Boxes, ClipboardList, PackageSearch, ShoppingCart, Truck, Users } from "lucide-react";
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

export default function SalesDemandPage({ initialView, focus, onNavigate, onOpenAi }: SalesDemandPageProps) {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [availability, setAvailability] = useState<InventoryAvailability[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const view = initialView === "evidence" ? "evidence" : initialView === "risks" ? "risks" : "orders";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      apiJson<{ orders: SalesOrder[]; summary: SalesSummary }>("/api/sales-demand/orders"),
      apiJson<{ availability: InventoryAvailability[] }>("/api/inventory/availability"),
    ])
      .then(([payload, allocationPayload]) => {
        if (!alive) return;
        setOrders(payload.orders || []);
        setSummary(payload.summary || null);
        setAvailability(allocationPayload.availability || []);
        setError("");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "销售需求读取失败");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const focusedOrder = useMemo(() => {
    if (!focus?.entityId) return null;
    return orders.find((order) => order.salesOrderId === focus.entityId) || null;
  }, [focus, orders]);
  const availabilityBySku = useMemo(() => new Map(availability.map((item) => [item.sku, item])), [availability]);
  const visibleOrders = useMemo(() => {
    const rows = view === "risks" ? orders.filter((order) => order.deliveryRiskLevel !== "low") : orders;
    if (!focusedOrder) return rows;
    return [focusedOrder, ...rows.filter((order) => order.salesOrderId !== focusedOrder.salesOrderId)];
  }, [view, orders, focusedOrder]);

  const activeSummary = summary || {
    totalOrders: orders.length,
    riskOrderCount: orders.filter((order) => order.deliveryRiskLevel !== "low").length,
    highRiskOrderCount: orders.filter((order) => order.deliveryRiskLevel === "high" || order.deliveryRiskLevel === "blocked").length,
    shortageQty: orders.reduce((sum, order) => sum + order.shortageQty, 0),
    reservedQty: orders.reduce((sum, order) => sum + order.reservedQty, 0),
    affectedCustomerCount: new Set(orders.filter((order) => order.deliveryRiskLevel !== "low").map((order) => order.customerName)).size,
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f6ff", color: A.blue }}>
                <ClipboardList size={17} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>销售需求</h1>
                <p className="text-xs mt-0.5" style={{ color: A.sub }}>客户订单与交付风险</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.blue }}>
              <span className="font-semibold">销售需求使用边界：</span>
              当前页面基于工作区内的客户订单、库存、采购、收货和供应商记录识别交付风险。系统仅提供库存可用量、采购在途和供应商风险的辅助分析，不会自动确认订单、自动出库或自动通知客户。
            </div>
          </div>
          <button onClick={onOpenAi}
            className="text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5"
            style={{ background: A.gray6, color: A.blue }}>
            <Bot size={13} /> 询问 AI
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="交付风险订单" value={String(activeSummary.riskOrderCount)} sub={`${activeSummary.highRiskOrderCount} 个高风险`} icon={AlertTriangle} color={activeSummary.highRiskOrderCount ? A.red : A.orange} />
        <KpiCard label="缺口数量" value={qty(activeSummary.shortageQty)} sub="按当前订单汇总" icon={PackageSearch} color={A.red} />
        <KpiCard label="已预留数量" value={qty(activeSummary.reservedQty)} sub="当前库存分配" icon={Boxes} color={A.green} />
        <KpiCard label="受影响客户" value={String(activeSummary.affectedCustomerCount)} sub="需人工复核" icon={Users} color={A.blue} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionHeader title="库存预留建议" />
          <div className="mt-3 space-y-2">
            {availability.slice(0, 3).map((item) => (
              <div key={`reservation-${item.sku}`} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold tabular-nums" style={{ color: A.blue }}>{item.sku} · {item.itemName}</div>
                  <Chip label={`建议 ${qty(item.reservationSuggestedQty)}`} color={item.reservationShortageQty > 0 ? A.orange : A.green} bg={item.reservationShortageQty > 0 ? "#fff8f0" : "#f0faf4"} />
                </div>
                <div className="mt-2 text-[11px] leading-5" style={{ color: A.sub }}>
                  可预留 {qty(item.reservableQty)}，预留缺口 {qty(item.reservationShortageQty)}；仅预览，不会自动锁库。
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <SectionHeader title="供需缺口" />
          <div className="mt-3 space-y-2">
            {availability.filter((item) => item.shortageQty > 0 || item.projectedAvailableQty < 0).slice(0, 3).map((item) => (
              <div key={`gap-${item.sku}`} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold tabular-nums" style={{ color: A.label }}>{item.sku}</div>
                  <Chip label={item.riskLabel} color={item.riskLevel === "medium" ? A.orange : A.red} bg={item.riskLevel === "medium" ? "#fff8f0" : "#fff1f0"} />
                </div>
                <div className="mt-2 text-[11px] leading-5" style={{ color: A.sub }}>
                  销售需求 {qty(item.salesDemandQty)}，在途采购 {qty(item.incomingPurchaseQty)}，预计可用 {qty(item.projectedAvailableQty)}，缺口 {qty(item.shortageQty)}。
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {error && <Card className="p-4 text-sm" style={{ color: A.red }}>{error}</Card>}
      {loading && <Card className="p-6 text-sm" style={{ color: A.sub }}>正在读取销售需求...</Card>}

      {!loading && (
        <div className="grid grid-cols-[1.25fr_0.75fr] gap-5">
          <Card>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${A.border}` }}>
              <SectionHeader title={view === "risks" ? "风险订单列表" : "客户订单列表"} />
              <span className="text-[11px]" style={{ color: A.sub }}>{visibleOrders.length} 条</span>
            </div>
            <div className="divide-y" style={{ borderColor: A.border }}>
              {visibleOrders.map((order) => {
                const focused = focusedOrder?.salesOrderId === order.salesOrderId;
                const allocation = availabilityBySku.get(order.sku);
                return (
                  <div key={order.salesOrderId} data-testid={`sales-order-${order.salesOrderId}`} className="p-4" style={{ background: focused ? "#f0f6ff" : A.white }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm tabular-nums" style={{ color: A.label }}>{order.salesOrderId}</span>
                          <Chip label={order.customerTier} color={A.blue} bg="#f0f6ff" />
                          <Chip label={order.deliveryRiskLabel} color={riskColor[order.deliveryRiskLevel] || A.gray1} bg={`${riskColor[order.deliveryRiskLevel] || A.gray1}16`} />
                        </div>
                        <div className="mt-1 text-xs" style={{ color: A.sub }}>{order.customerName} · {order.sku} / {order.itemName}</div>
                      </div>
                      <div className="text-right text-[11px]" style={{ color: A.gray1 }}>
                        <div>承诺日期</div>
                        <div className="font-semibold" style={{ color: A.label }}>{order.promisedDate || "待确认"}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      {[
                        ["订单数量", qty(order.orderedQty)],
                        ["已预留", qty(order.reservedQty)],
                        ["缺口", qty(order.shortageQty)],
                        ["状态", order.statusLabel],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                          <div className="text-[9px]" style={{ color: A.gray2 }}>{label}</div>
                          <div className="text-sm font-semibold tabular-nums" style={{ color: label === "缺口" && order.shortageQty > 0 ? A.red : A.label }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl p-3" style={{ background: "#f0f6ff" }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold" style={{ color: A.label }}>库存分配信息</div>
                        <Chip label={allocation?.riskLabel || "需复核"} color={allocation?.riskLevel === "low" ? A.green : allocation?.riskLevel === "medium" ? A.orange : A.red} bg={allocation?.riskLevel === "low" ? "#f0faf4" : allocation?.riskLevel === "medium" ? "#fff8f0" : "#fff1f0"} />
                      </div>
                      {allocation ? (
                        <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] lg:grid-cols-8">
                          {[
                            ["实物库存", allocation.onHandQty],
                            ["已预留", allocation.reservedQty],
                            ["当前订单分配量", order.reservedQty],
                            ["可承诺量", allocation.availableToPromiseQty],
                            ["缺口", allocation.shortageQty],
                            ["在途采购", allocation.incomingPurchaseQty],
                            ["预计可用", allocation.projectedAvailableQty],
                            ["预留建议", Math.min(Math.max(order.orderedQty - order.reservedQty - order.fulfilledQty, 0), allocation.reservableQty)],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg px-2 py-2" style={{ background: A.white }}>
                              <div className="text-[9px]" style={{ color: A.gray2 }}>{label}</div>
                              <div className="font-semibold tabular-nums" style={{ color: (label === "缺口" || label === "预计可用") && Number(value) > 0 && label === "缺口" ? A.red : A.label }}>{Number(value).toLocaleString("zh-CN")}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] leading-5" style={{ color: A.orange }}>当前工作区缺少完整库存分配记录，因此可承诺量和预留建议需人工复核。</div>
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5" style={{ color: A.gray1 }}>{order.deliveryRiskReason}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => onNavigate?.("inventory")}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: A.gray6, color: A.blue }}>查看库存</button>
                      <button onClick={() => onNavigate?.("procurement:orders")}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: A.gray6, color: A.blue }}>查看采购订单</button>
                      <button onClick={() => onNavigate?.("srm:master")}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: A.gray6, color: A.blue }}>查看供应商</button>
                      <button onClick={onOpenAi}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium"
                        style={{ background: "#f0f6ff", color: A.blue }}>询问 AI</button>
                      <button disabled
                        className="text-[11px] px-2.5 py-1.5 rounded-lg font-medium cursor-not-allowed"
                        style={{ background: A.gray6, color: A.gray2 }}>交付风险草稿预览待接入</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${A.border}` }}>
              <SectionHeader title="证据链预览" />
              <p className="text-[11px] mt-1" style={{ color: A.sub }}>客户订单 → SKU → 库存可用量 → 采购订单 → 供应商 → 收货单</p>
            </div>
            <div className="p-4 space-y-3">
              {(focusedOrder ? [focusedOrder] : visibleOrders.slice(0, 4)).map((order) => (
                <div key={`evidence-${order.salesOrderId}`} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="font-semibold text-xs tabular-nums" style={{ color: A.label }}>{order.salesOrderId}</div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] leading-5">
                    <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><PackageSearch size={12} /> {order.sku} / {order.itemName}</div>
                    <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><ShoppingCart size={12} /> {order.linkedPurchaseOrders.map((po) => `${po.id} ${po.status || ""}`).join("；") || "暂无完整采购订单关联"}</div>
                    <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><Users size={12} /> {order.linkedSuppliers.map((supplier) => `${supplier.name}${supplier.risk ? ` · ${supplier.risk}` : ""}`).join("；") || "暂无完整供应商风险记录"}</div>
                    <div className="flex items-center gap-1.5" style={{ color: A.gray1 }}><Truck size={12} /> {order.linkedReceivingDocs.map((grn) => `${grn.id} ${grn.status || ""}`).join("；") || "暂无完整收货记录"}</div>
                  </div>
                  <div className="mt-2 text-[11px] leading-5" style={{ color: A.sub }}>
                    当前证据链基于工作区内的客户订单、库存、采购、供应商、收货和发票协同记录生成。系统只展示关联证据，不会自动创建、修改或关闭任何业务单据。
                  </div>
                  {!!order.dataLimitations.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {order.dataLimitations.map((item) => (
                        <span key={item} className={typography.compactMetadata} style={{ color: A.orange }}>{limitationLabel(item)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
