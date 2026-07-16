import { useEffect, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { EntityLink } from "../../components/business/EntityLink";
import { apiJson } from "../../lib/api-client";
import { A, Card, Chip } from "../../components/ui";

type Supplier = {
  id?: string;
  supplierId?: string;
  supplierCode?: string;
  code?: string;
  supplierName?: string;
  name?: string;
  category?: string;
  status?: string;
  riskLevel?: string;
};

export default function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const load = () => {
    setState("loading");
    apiJson<{ suppliers: Supplier[] }>("/api/master-data/suppliers")
      .then(payload => { setSuppliers(Array.isArray(payload.suppliers) ? payload.suppliers : []); setState("ready"); })
      .catch(() => { setSuppliers([]); setState("error"); });
  };
  useEffect(load, []);

  return <div className="space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold">供应商</h2><p className="mt-1 text-xs" style={{ color: A.sub }}>仅显示供应商主数据运行时仓库中的正式记录。</p></div>
      <button onClick={load} aria-label="刷新供应商" className="rounded-md p-2" style={{ color: A.blue }}><RefreshCw size={16}/></button>
    </div>
    {state === "loading" && <Card className="p-8 text-sm" style={{ color: A.sub }}>正在读取供应商主数据...</Card>}
    {state === "error" && <Card className="p-8 text-sm" style={{ color: A.red }}>供应商数据读取失败。请检查运行时服务后重试。</Card>}
    {state === "ready" && suppliers.length === 0 && <Card className="p-10 text-center"><Truck className="mx-auto mb-3" size={28} color={A.gray2}/><div className="text-sm font-semibold">暂无供应商</div><p className="mt-2 text-xs" style={{ color: A.sub }}>维护供应商主数据后，记录将显示在这里。</p></Card>}
    {state === "ready" && suppliers.length > 0 && <Card className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["供应商编码", "供应商名称", "品类", "状态", "风险"].map(label => <th key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{suppliers.map((supplier, index) => {
      const id = supplier.id || supplier.supplierId || supplier.supplierCode || supplier.code || "";
      const code = supplier.supplierCode || supplier.code || id;
      return <tr key={`${id}-${index}`} style={{ borderBottom: `1px solid ${A.border}` }}><td className="px-4 py-3"><EntityLink kind="supplier" id={id}>{code}</EntityLink></td><td className="px-4 py-3">{supplier.supplierName || supplier.name || "—"}</td><td className="px-4 py-3">{supplier.category || "—"}</td><td className="px-4 py-3"><Chip label={supplier.status || "active"} color={A.green} bg="#edf9f2"/></td><td className="px-4 py-3">{supplier.riskLevel || "—"}</td></tr>;
    })}</tbody></table></Card>}
  </div>;
}
