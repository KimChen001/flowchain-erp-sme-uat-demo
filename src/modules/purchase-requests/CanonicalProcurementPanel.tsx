import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { A, Card, Field, inputStyle } from "../../components/ui";

type Item = {
  itemId: string;
  sku: string;
  itemName: string;
  purchaseUnit: string;
  baseUnit: string;
  specification: string;
  defaultWarehouseId: string;
  defaultSupplierId: string;
};
type Line = {
  lineType: "catalog_item" | "non_catalog_item";
  itemId: string | null;
  sku: string | null;
  itemNameSnapshot: string;
  unitSnapshot: string;
  specificationSnapshot: string;
  quantity: number;
  unitPrice: number;
  needByDate: string;
  warehouseId: string;
  suggestedSupplierId: string;
  lineComment: string;
};
type PR = {
  id: string;
  status: string;
  procurementPath: string;
  version: number;
  totalAmount: number;
  comments?: string;
  lines: Line[];
};
const newLine = (): Line => ({
  lineType: "catalog_item",
  itemId: "",
  sku: "",
  itemNameSnapshot: "",
  unitSnapshot: "",
  specificationSnapshot: "",
  quantity: 1,
  unitPrice: 0,
  needByDate: "",
  warehouseId: "",
  suggestedSupplierId: "",
  lineComment: "",
});
const initial = () => ({
  requesterId: "",
  departmentId: "",
  buyerId: "",
  supplierId: "",
  currency: "CNY",
  paymentTermsId: "",
  expectedDeliveryDate: "",
  comments: "",
  lines: [newLine()],
});
const request = <T,>(url: string, method = "GET", body?: unknown) =>
  apiJson<T>(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export default function CanonicalProcurementPanel({
  onNavigate,
}: {
  onNavigate?: (id: string, focus?: unknown) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [rows, setRows] = useState<PR[]>([]);
  const [draft, setDraft] = useState(initial());
  const [editing, setEditing] = useState<PR | null>(null);
  const [recommendation, setRecommendation] = useState<{
    recommendation: string;
    recommendationReasons?: string[];
  } | null>(null);
  const load = async () => {
    const [prs, catalog] = await Promise.all([
      request<PR[]>("/api/procurement/requests"),
      request<{ items: Item[] }>("/api/master-data/items?purchasable=true"),
    ]);
    setRows(prs);
    setItems(catalog.items);
  };
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);
  const patchLine = (index: number, patch: Partial<Line>) =>
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }));
  const selectItem = (index: number, value: string) => {
    if (value === "other")
      return patchLine(index, {
        lineType: "non_catalog_item",
        itemId: null,
        sku: null,
        itemNameSnapshot: "",
        unitSnapshot: "",
        specificationSnapshot: "",
        warehouseId: "",
        suggestedSupplierId: "",
      });
    const item = items.find((row) => row.itemId === value);
    if (!item) return patchLine(index, { ...newLine() });
    patchLine(index, {
      lineType: "catalog_item",
      itemId: item.itemId,
      sku: item.sku,
      itemNameSnapshot: item.itemName,
      unitSnapshot: item.purchaseUnit || item.baseUnit,
      specificationSnapshot: item.specification || "",
      warehouseId: item.defaultWarehouseId || "",
      suggestedSupplierId: item.defaultSupplierId || "",
    });
  };
  const save = async (submit = false) => {
    try {
      const totalAmount = draft.lines.reduce(
        (sum, line) => sum + line.quantity * line.unitPrice,
        0,
      );
      const pr = editing
        ? await request<PR>(
            `/api/procurement/requests/${editing.id}`,
            "PATCH",
            { ...draft, totalAmount, expectedVersion: editing.version },
          )
        : await request<PR>("/api/procurement/requests", "POST", {
            ...draft,
            totalAmount,
          });
      if (submit)
        await request(`/api/procurement/requests/${pr.id}/submit`, "POST", {
          expectedVersion: pr.version,
        });
      setEditing(null);
      setDraft(initial());
      await load();
      toast.success(submit ? "采购申请已提交" : "采购申请草稿已保存");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    }
  };
  const edit = (pr: PR) => {
    setEditing(pr);
    setDraft((current) => ({
      ...current,
      comments: pr.comments || "",
      lines: pr.lines,
    }));
  };
  const act = async (pr: PR, action: string) => {
    try {
      const reason =
        action === "reject" ? window.prompt("请输入拒绝原因") || "" : "";
      if (action === "reject" && !reason) return;
      const result: any =
        action === "path-recommendation"
          ? await request(
              `/api/procurement/requests/${pr.id}/path-recommendation`,
            )
          : await request(
              `/api/procurement/requests/${pr.id}/${action}`,
              "POST",
              {
                expectedVersion: pr.version,
                reason,
                title: `询价 ${pr.id}`,
                dueDate: new Date().toISOString().slice(0, 10),
              },
            );
      if (action === "path-recommendation") setRecommendation(result);
      if (result.purchaseOrder)
        onNavigate?.("procurement:orders", {
          entityType: "purchase_order",
          entityId: result.purchaseOrder.id,
        });
      if (result.rfq)
        onNavigate?.("procurement:rfq", {
          entityType: "rfq",
          entityId: result.rfq.id,
        });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  };
  return (
    <div className="space-y-4 pb-20">
      <Card className="p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              {editing ? `编辑采购申请 ${editing.id}` : "新建采购申请"}
            </h2>
            <p className="text-[11px]" style={{ color: A.sub }}>
              目录物料引用 SKU 主数据；非目录采购保存独立描述。
            </p>
          </div>
          <div className="flex gap-2">
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setDraft(initial());
                }}
              >
                取消编辑
              </button>
            )}
            <button
              onClick={() => save(false)}
              className="rounded-md bg-slate-100 px-3 py-2 text-xs"
            >
              保存草稿
            </button>
            <button
              onClick={() => save(true)}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white"
            >
              保存并提交
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(
            [
              ["requesterId", "申请人"],
              ["departmentId", "部门"],
              ["buyerId", "采购负责人"],
              ["supplierId", "建议供应商"],
              ["currency", "币种"],
              ["paymentTermsId", "付款条款"],
              ["expectedDeliveryDate", "需求日期"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type={key === "expectedDeliveryDate" ? "date" : "text"}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                style={inputStyle}
              />
            </Field>
          ))}
        </div>
        <Field label="申请单 Comments">
          <textarea
            aria-label="申请单 Comments"
            className="mt-2 w-full rounded-md border p-2 text-xs"
            value={draft.comments}
            onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
          />
        </Field>
        <div className="mt-3 space-y-3">
          {draft.lines.map((line, index) => (
            <div key={index} className="rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="物料选择">
                  <select
                    aria-label={`物料选择 ${index + 1}`}
                    value={
                      line.lineType === "non_catalog_item"
                        ? "other"
                        : line.itemId || ""
                    }
                    onChange={(e) => selectItem(index, e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">搜索或选择 SKU</option>
                    {items.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {item.sku} · {item.itemName}
                      </option>
                    ))}
                    <option value="other">Other / 非目录采购</option>
                  </select>
                </Field>
                <Field label="物料名称">
                    <input
                      aria-label="物料名称"
                      readOnly={line.lineType === "catalog_item"}
                    value={line.itemNameSnapshot}
                    onChange={(e) =>
                      patchLine(index, { itemNameSnapshot: e.target.value })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="单位">
                    <input
                      aria-label="单位"
                      readOnly={line.lineType === "catalog_item"}
                    value={line.unitSnapshot}
                    onChange={(e) =>
                      patchLine(index, { unitSnapshot: e.target.value })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="规格 / 描述">
                  <input
                    readOnly={line.lineType === "catalog_item"}
                    value={line.specificationSnapshot}
                    onChange={(e) =>
                      patchLine(index, {
                        specificationSnapshot: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="数量">
                  <input
                    type="number"
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(index, { quantity: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="单价">
                  <input
                    type="number"
                    value={line.unitPrice}
                    onChange={(e) =>
                      patchLine(index, { unitPrice: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="目标仓库">
                  <input
                    value={line.warehouseId}
                    onChange={(e) =>
                      patchLine(index, { warehouseId: e.target.value })
                    }
                    style={inputStyle}
                  />
                </Field>
                <Field label="行级备注">
                    <input
                      aria-label="行级备注"
                      value={line.lineComment}
                    onChange={(e) =>
                      patchLine(index, { lineComment: e.target.value })
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
              {draft.lines.length > 1 && (
                <button
                  className="mt-2 text-xs text-red-600"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.filter((_, i) => i !== index),
                    })
                  }
                >
                  删除行
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          className="mt-3 text-xs text-blue-600"
          onClick={() =>
            setDraft({ ...draft, lines: [...draft.lines, newLine()] })
          }
        >
          + 新增物料行
        </button>
      </Card>
      <Card className="p-4">
        <h2 className="text-sm font-semibold">采购申请</h2>
        <div className="mt-3 space-y-2">
          {rows.map((pr) => (
            <div key={pr.id} className="rounded-lg border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <b>{pr.id}</b>
                <span>
                  {pr.status} · {pr.procurementPath} · v{pr.version}
                </span>
                <span className="ml-auto">
                  ¥{pr.totalAmount.toLocaleString()}
                </span>
                {pr.status === "draft" && (
                  <>
                    <button onClick={() => edit(pr)}>编辑</button>
                    <button onClick={() => act(pr, "submit")}>提交</button>
                  </>
                )}
                {pr.status === "submitted" && (
                  <>
                    <button onClick={() => act(pr, "approve")}>批准</button>
                    <button onClick={() => act(pr, "reject")}>拒绝</button>
                  </>
                )}
                {pr.status === "approved" && (
                  <>
                    <button onClick={() => act(pr, "path-recommendation")}>
                      路径建议
                    </button>
                    <button onClick={() => act(pr, "direct-purchase-order")}>
                      创建采购订单
                    </button>
                    <button onClick={() => act(pr, "rfqs")}>发起询价</button>
                  </>
                )}
              </div>
              {pr.comments && <p className="mt-2">Comments：{pr.comments}</p>}
              {pr.lines?.map((line, i) => (
                <div key={i} className="mt-1 text-slate-600">
                  {line.sku || "Other"} · {line.itemNameSnapshot} ·{" "}
                  {line.unitSnapshot} · {line.specificationSnapshot}
                  {line.lineComment && ` · 备注：${line.lineComment}`}
                </div>
              ))}
            </div>
          ))}
        </div>
        {recommendation && (
          <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs">
            推荐：{recommendation.recommendation} ·{" "}
            {recommendation.recommendationReasons?.join("；")}
          </div>
        )}
      </Card>
    </div>
  );
}
