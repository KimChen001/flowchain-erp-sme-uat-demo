// @ts-nocheck
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { A, Card } from "../../components/ui";
import { EntityLink } from "../../components/business/EntityLink";
import PurchasingRequests from "../purchase-requests/Page";

const fetchJson = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return response.json(); };

export default function ProcurementPanel({ intent = null, view = "workbench", focus = null, onNavigate = undefined, onActiveContextChange = undefined, onOpenRfq: _onOpenRfq = undefined }) {
  if (!view || view === "workbench" || view === "overview") return <RuntimeWorkbench onNavigate={onNavigate}/>;
  if (view === "requests") return <PurchasingRequests intent={intent} focus={focus} onNavigate={onNavigate} onActiveContextChange={onActiveContextChange}/>;
  if (view === "orders") return <RuntimeOrders focus={focus} onNavigate={onNavigate}/>;
  const empty = { rfq: ["暂无询价单", "采购申请需要询价时，记录将显示在这里。"], receiving: ["暂无采购收货记录", "采购订单收货后，记录将显示在这里。"], invoices: ["暂无供应商发票", "供应商发票录入后，记录将显示在这里。"], match: ["暂无匹配记录", "收货与发票数据完整后可进行三单匹配。"], returns: ["暂无采购退货记录", "采购退货发生后，记录将显示在这里。"], contracts: ["暂无采购合同", "当前未接通合同 runtime repository。"] };
  const copy = empty[view] || ["当前视图暂无数据", ""];
  return <Card className="py-16 text-center"><h1 className="text-base font-semibold">{copy[0]}</h1><p className="mt-2 text-xs" style={{ color: A.sub }}>{copy[1]}</p></Card>;
}

function RuntimeWorkbench({ onNavigate }) {
  const [prs, setPrs] = useState([]), [pos, setPos] = useState([]), [state, setState] = useState("loading"), [filter, setFilter] = useState("all");
  const load = async () => { setState("loading"); try { const [p, o] = await Promise.all([fetchJson("/api/procurement/requests"), fetchJson("/api/procurement/orders")]); setPrs(p); setPos(o); setState("loaded"); } catch { setState("error"); } };
  useEffect(() => { load(); }, []);
  const rows = [...prs.filter(p => ["submitted", "approved"].includes(p.status)).map(p => ({ id: p.id, type: "采购申请", status: p.status, amount: p.totalAmount, bucket: p.status === "submitted" ? "approval" : "tracking", kind: "purchase_request" })), ...pos.filter(p => p.status === "draft").map(p => ({ id: p.id, type: "采购订单", status: `${p.status} · ${p.transmissionStatus}`, amount: p.totalAmount, bucket: "tracking", kind: "purchase_order" }))];
  const shown = rows.filter(row => filter === "all" || row.bucket === filter);
  if (state === "error") return <Card className="p-12 text-center"><div>采购工作台加载失败</div><button onClick={load} className="mt-3 text-blue-600">重试</button></Card>;
  return <div className="space-y-4"><Card className="p-5"><div className="flex items-center justify-between"><div><h1 className="text-lg font-semibold">今日采购待办：{rows.length}</h1><p className="text-xs" style={{ color: A.sub }}>采购申请、审批与 Draft PO 来自采购 runtime repository。</p></div><div className="flex gap-2"><button onClick={load} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-xs"><RefreshCw size={14}/>刷新</button><button onClick={() => onNavigate?.("procurement:requests")} className="rounded bg-blue-600 px-3 py-2 text-xs text-white">新建采购申请</button></div></div></Card><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[{ id: "all", label: "全部待办", value: rows.length }, { id: "approval", label: "待我审批", value: rows.filter(r => r.bucket === "approval").length }, { id: "overdue", label: "逾期处理", value: 0 }, { id: "tracking", label: "跟进中", value: rows.filter(r => r.bucket === "tracking").length }].map(x => <button key={x.id} onClick={() => setFilter(x.id)} className="rounded border bg-white p-4 text-left"><div className="text-xs">{x.label}</div><div className="text-2xl font-semibold">{x.value}</div></button>)}</div><Card className="overflow-hidden"><div className="border-b p-4 text-sm font-semibold">待办队列</div>{state === "loading" ? <div className="py-12 text-center text-xs">加载中</div> : shown.length === 0 ? <div className="py-12 text-center text-sm" style={{ color: A.sub }}>暂无采购事项<br/><span className="text-xs">点击“新建采购申请”开始录入。</span></div> : <table className="w-full text-xs"><tbody>{shown.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.type}</td><td className="p-3 text-blue-600"><EntityLink kind={row.kind} id={row.id}>{row.id}</EntityLink></td><td className="p-3">{row.status}</td><td className="p-3">{row.amount}</td></tr>)}</tbody></table>}</Card></div>;
}

function RuntimeOrders({ focus, onNavigate }) {
  const [rows, setRows] = useState([]), [error, setError] = useState("");
  const load = () => fetchJson("/api/procurement/orders").then(data => { setRows(data); setError(""); }).catch(error => setError(error.message));
  useEffect(load, []);
  const selected = focus?.entityType === "purchase_order" ? rows.find(row => row.id === focus.entityId) : null;
  if (error) return <Card className="p-12 text-center">采购订单加载失败<button onClick={load}>重试</button></Card>;
  if (selected) return <div className="space-y-4"><button onClick={() => onNavigate?.("procurement:orders")}>返回采购订单列表</button><Card className="p-5"><h1 className="text-lg font-semibold">{selected.id}</h1><p className="mt-1 text-xs" style={{ color: A.sub }}>{selected.status} · {selected.transmissionStatus} · <EntityLink kind="supplier" id={selected.supplierId}>{selected.supplierSnapshot?.supplierName || selected.supplierId}</EntityLink></p><div className="mt-4 text-sm">金额：{selected.totalAmount} · 目标仓库：{selected.targetWarehouseId}</div><h2 className="mt-5 text-sm font-semibold">来源采购申请</h2><div className="mt-2"><EntityLink kind="purchase_request" id={selected.sourcePrId || selected.sourcePurchaseRequestId}>{selected.sourcePrId || selected.sourcePurchaseRequestId}</EntityLink></div><h2 className="mt-5 text-sm font-semibold">采购行</h2>{selected.lines.map(line => <div key={line.sourcePurchaseRequestLineId} className="border-t py-2 text-xs">{line.itemNameSnapshot} · {line.estimatedAmount} · 来源行 {line.sourcePurchaseRequestLineId}</div>)}</Card></div>;
  return <div className="space-y-4"><h1 className="text-lg font-semibold">采购订单</h1>{rows.length === 0 ? <Card className="py-14 text-center text-sm" style={{ color: A.sub }}>暂无采购订单<br/><span className="text-xs">审批通过并转换后，Draft PO 将显示在这里。</span></Card> : <Card className="overflow-hidden"><table className="w-full text-xs"><thead><tr>{["采购订单", "Supplier", "状态", "发送状态", "金额", "来源 PR"].map(h => <th key={h} className="p-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t"><td className="p-3"><EntityLink kind="purchase_order" id={row.id}>{row.id}</EntityLink></td><td className="p-3"><EntityLink kind="supplier" id={row.supplierId}>{row.supplierSnapshot?.supplierName || row.supplierId}</EntityLink></td><td className="p-3">{row.status}</td><td className="p-3">{row.transmissionStatus}</td><td className="p-3">{row.totalAmount}</td><td className="p-3"><EntityLink kind="purchase_request" id={row.sourcePrId}>{row.sourcePrId}</EntityLink></td></tr>)}</tbody></table></Card>}</div>;
}
