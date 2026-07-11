import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { Card } from "../ui";
export default function CanonicalDownstreamPanel({
  kind,
}: {
  kind: "orders" | "rfqs";
}) {
  const [rows, setRows] = useState<any[]>([]);
  const load = () =>
    apiJson<any[]>(`/api/procurement/${kind}`)
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);
  const act = async (row: any, action: string) => {
    try {
      await apiJson(`/api/procurement/${kind}/${row.id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-flowchain-user": "procurement-manager",
        },
        body: JSON.stringify({ expectedVersion: row.version }),
      });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">
        {kind === "orders" ? "真实采购订单" : "真实询价单"}
      </h2>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap gap-2 rounded-lg border p-3 text-xs"
          >
            <b>{r.id}</b>
            <span>
              {r.status} · v{r.version}
            </span>
            <span>来源 PR：{r.sourcePrId}</span>
            <span className="ml-auto">{r.currency}</span>
            {kind === "orders" && r.status === "draft" && (
              <button onClick={() => act(r, "submit")}>提交审批</button>
            )}
            {kind === "orders" && r.status === "pending_approval" && (
              <>
                <button onClick={() => act(r, "approve")}>批准</button>
                <button onClick={() => act(r, "cancel")}>取消</button>
              </>
            )}
            {kind === "orders" && r.status === "approved" && (
              <button onClick={() => act(r, "issue")}>下达</button>
            )}
            {kind === "rfqs" && r.status === "draft" && (
              <>
                <button onClick={() => act(r, "open")}>开启询价</button>
                <button onClick={() => act(r, "cancel")}>取消</button>
              </>
            )}
          </div>
        ))}
      </div>
      {kind === "rfqs" && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
          尚未录入供应商报价
        </div>
      )}
    </Card>
  );
}
