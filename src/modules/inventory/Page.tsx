import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, Boxes, RefreshCw } from "lucide-react";
import { apiJson } from "../../lib/api-client";
import { A, Card, Chip } from "../../components/ui";
import { EntityLink } from "../../components/business/EntityLink";

type Item = { itemId?: string; sku: string; itemName?: string; name?: string; category?: string; availableQuantity?: number; onHandQuantity?: number; reservedQuantity?: number; safetyStock?: number; reorderPoint?: number; status?: string; riskLevel?: string; defaultWarehouseId?: string; location?: string; unit?: string };
type Lot = { lotId?: string; lot?: string; sku: string; itemName?: string; quantity?: number; expiryDate?: string; status?: string; warehouseId?: string };
type Serial = { serialId?: string; sn?: string; sku: string; status?: string; warehouseId?: string };
type Movement = { movementId?: string; sku?: string; itemName?: string; quantityIn?: number; quantityOut?: number; adjustmentQty?: number; date?: string; sourceDocument?: string; status?: string };
type InventoryException = { id: string; sku?: string; itemName?: string; quantityImpact?: number; status?: string; reason?: string };
type Relationship = { active?: boolean; approved?: boolean; preferred?: boolean; supplierId?: string; supplier?: { id?: string; supplierName?: string; name?: string } };
type Focus = { entityType: string; entityId: string; entityLabel?: string } | null;

const endpointFor: Record<string, { url: string; key: string }> = {
  overview: { url: "/api/inventory/items", key: "items" }, warnings: { url: "/api/inventory/items", key: "items" },
  lots: { url: "/api/inventory/lots", key: "lots" }, serials: { url: "/api/inventory/serials", key: "serials" },
  movements: { url: "/api/inventory/movements", key: "movements" }, exceptions: { url: "/api/inventory/exceptions", key: "exceptions" },
};

function quantity(item: Item) { return Number(item.availableQuantity ?? item.onHandQuantity ?? 0); }
function reorder(item: Item) { return Number(item.reorderPoint ?? item.safetyStock ?? 0); }
function isShort(item: Item) { return quantity(item) < reorder(item); }

function ReplenishmentAction({ item }: { item: Item }) {
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const itemId = item.itemId || item.sku;
  useEffect(() => {
    let alive = true;
    apiJson<{ relationships: Relationship[] }>(`/api/master-data/items/${encodeURIComponent(itemId)}/suppliers`)
      .then(({ relationships = [] }) => { if (alive) setState(relationships.some(row => row.active !== false && row.approved !== false && (row.supplierId || row.supplier?.id)) ? "ready" : "missing"); })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [itemId]);
  if (state === "loading") return <span className="text-xs" style={{ color: A.sub }}>校验供应关系...</span>;
  if (state !== "ready") return <EntityLink kind="item" id={itemId} className="text-xs" >维护供应商关系</EntityLink>;
  const suggested = Math.max(1, reorder(item) - quantity(item));
  return <Link className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: "#eef5ff", color: A.blue }} to={`/app/procurement/requests?itemId=${encodeURIComponent(itemId)}&sku=${encodeURIComponent(item.sku)}&quantity=${suggested}&source=inventory`}>新建采购申请</Link>;
}

export default function InventoryPage({ initialView = "overview", focus }: { initialView?: string; focus?: Focus; onNavigate?: (...args: any[]) => void; onActiveContextChange?: (...args: any[]) => void; onReviewActionDraft?: (...args: any[]) => void }) {
  const view = endpointFor[initialView] ? initialView : "empty";
  const [rows, setRows] = useState<any[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedSku, setSelectedSku] = useState(focus?.entityId || "");
  const load = () => {
    const endpoint = endpointFor[view];
    if (!endpoint) { setRows([]); setState("ready"); return; }
    setState("loading");
    apiJson<Record<string, any[]>>(endpoint.url).then(payload => { setRows(Array.isArray(payload[endpoint.key]) ? payload[endpoint.key] : []); setState("ready"); }).catch(() => setState("error"));
  };
  useEffect(load, [view]);
  useEffect(() => { if (focus?.entityId) setSelectedSku(focus.entityId); }, [focus?.entityId]);
  const items = rows as Item[];
  const visible = useMemo(() => view === "warnings" ? items.filter(isShort) : rows, [items, rows, view]);
  const selected = view === "overview" || view === "warnings" ? items.find(row => row.sku === selectedSku || row.itemId === selectedSku) : null;

  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">库存管理</h2><p className="mt-1 text-xs" style={{ color: A.sub }}>仅显示库存运行时仓库中的正式记录；没有记录时保持为空。</p></div><button onClick={load} aria-label="刷新库存" className="rounded-md p-2" style={{ color: A.blue }}><RefreshCw size={16}/></button></div>
    {state === "loading" && <Card className="p-8 text-sm" style={{ color: A.sub }}>正在读取库存运行时数据...</Card>}
    {state === "error" && <Card className="p-8 text-sm" style={{ color: A.red }}>库存数据读取失败。请检查运行时服务后重试。</Card>}
    {state === "ready" && visible.length === 0 && <Card className="p-10 text-center"><Boxes className="mx-auto mb-3" size={28} color={A.gray2}/><div className="text-sm font-semibold">当前工作区暂无库存记录</div><p className="mt-2 text-xs" style={{ color: A.sub }}>页面不会用固定 SKU、批次、序列号或移动记录补足空数据。</p></Card>}
    {state === "ready" && visible.length > 0 && (view === "overview" || view === "warnings") && <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["SKU / 物料", "仓库", "可用量", "安全库存", "再订货点", "状态", "操作"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{(visible as Item[]).map(item => <tr key={item.sku} data-testid={`inventory-item-${item.sku}`} style={{ borderBottom: `1px solid ${A.border}` }}><td className="px-4 py-3"><EntityLink kind="item" id={item.itemId || item.sku} className="text-xs">{item.sku}</EntityLink><div className="mt-1" style={{ color: A.sub }}>{item.itemName || item.name || "—"}</div></td><td className="px-4 py-3">{item.location || item.defaultWarehouseId || "—"}</td><td className="px-4 py-3 tabular-nums">{quantity(item)} {item.unit || ""}</td><td className="px-4 py-3 tabular-nums">{Number(item.safetyStock || 0)}</td><td className="px-4 py-3 tabular-nums">{reorder(item)}</td><td className="px-4 py-3">{isShort(item) ? <Chip label="需补货" color={A.orange} bg="#fff7e8"/> : <Chip label={item.status || "正常"} color={A.green} bg="#edf9f2"/>}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><button className="rounded-md px-3 py-1.5 font-semibold" style={{ background: A.gray6, color: A.label }} onClick={() => setSelectedSku(item.sku)}>库存详情</button>{isShort(item) && <ReplenishmentAction item={item}/>}</div></td></tr>)}</tbody></table></Card>}
    {state === "ready" && visible.length > 0 && view === "lots" && <SimpleTable headers={["批次", "SKU", "物料", "数量", "到期日", "状态"]} rows={(visible as Lot[]).map(row => [row.lotId || row.lot, <EntityLink kind="item" id={row.sku}>{row.sku}</EntityLink>, row.itemName, row.quantity, row.expiryDate, row.status])}/>}
    {state === "ready" && visible.length > 0 && view === "serials" && <SimpleTable headers={["序列号", "SKU", "仓库", "状态"]} rows={(visible as Serial[]).map(row => [row.serialId || row.sn, <EntityLink kind="item" id={row.sku}>{row.sku}</EntityLink>, row.warehouseId, row.status])}/>}
    {state === "ready" && visible.length > 0 && view === "movements" && <SimpleTable headers={["移动单号", "SKU", "物料", "入库", "出库", "日期", "状态"]} rows={(visible as Movement[]).map(row => [row.movementId, <EntityLink kind="item" id={row.sku}>{row.sku}</EntityLink>, row.itemName, row.quantityIn, row.quantityOut, row.date, row.status])}/>}
    {state === "ready" && visible.length > 0 && view === "exceptions" && <SimpleTable headers={["异常单号", "SKU", "物料", "数量影响", "原因", "状态"]} rows={(visible as InventoryException[]).map(row => [row.id, <EntityLink kind="item" id={row.sku}>{row.sku}</EntityLink>, row.itemName, row.quantityImpact, row.reason, row.status])}/>}
    {selected && <Card className="p-4" data-testid="inventory-local-detail"><div className="flex items-center gap-2"><AlertTriangle size={15} color={isShort(selected) ? A.orange : A.green}/><h3 className="text-sm font-semibold">库存详情 · {selected.sku}</h3></div><div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><span>在手：{Number(selected.onHandQuantity || 0)}</span><span>预留：{Number(selected.reservedQuantity || 0)}</span><span>可用：{quantity(selected)}</span></div></Card>}
  </div>;
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: any[][] }) {
  return <Card className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{headers.map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} style={{ borderBottom: `1px solid ${A.border}` }}>{row.map((cell, j) => <td key={j} className="px-4 py-3">{cell ?? "—"}</td>)}</tr>)}</tbody></table></Card>;
}
