import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiJson } from "../../lib/api-client";
import { A, Card, Field, inputStyle } from "../../components/ui";
type PR = {
  id: string;
  status: string;
  procurementPath: string;
  version: number;
  totalAmount: number;
  linkedPoId?: string;
};
const payload = {
  requesterId: "张磊",
  departmentId: "供应链计划",
  buyerId: "李婷",
  supplierId: "SUP-001",
  currency: "CNY",
  paymentTermsId: "NET30",
  expectedDeliveryDate: "2026-08-01",
  totalAmount: 29800,
  lines: [
    {
      lineId: "L1",
      itemId: "SKU-00412",
      sku: "SKU-00412",
      itemName: "高精度数控刀具",
      quantity: 10,
      unit: "件",
      unitPrice: 2980,
      amount: 29800,
      needByDate: "2026-08-01",
      warehouseId: "WH-EAST",
      suggestedSupplierId: "SUP-001",
    },
  ],
};
const post = <T,>(url: string, body: unknown) =>
  apiJson<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-flowchain-user": "procurement-manager",
    },
    body: JSON.stringify(body),
  });
export default function CanonicalProcurementPanel({
  onNavigate,
}: {
  onNavigate?: (id: string, focus?: any) => void;
}) {
  const [rows, setRows] = useState<PR[]>([]);
  const [recommendation, setRecommendation] = useState<any>();
  const [draft, setDraft] = useState(payload);
  const load = () =>
    apiJson<PR[]>("/api/procurement/requests")
      .then(setRows)
      .catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);
  const create = async (submit = true) => {
    try {
      const totalAmount = draft.lines[0].quantity * draft.lines[0].unitPrice;
      const pr = await post<PR>("/api/procurement/requests", {
        ...draft,
        totalAmount,
        lines: [{ ...draft.lines[0], amount: totalAmount }],
      });
      if (submit)
        await post(`/api/procurement/requests/${pr.id}/submit`, {
          expectedVersion: pr.version,
        });
      await load();
      toast.success(submit ? "采购申请已提交复核" : "采购申请草稿已保存");
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const act = async (pr: PR, action: string) => {
    try {
      const reason = action === "reject" ? window.prompt("请输入拒绝原因") : "";
      if (action === "reject" && !reason) return;
      const result: any =
        action === "path-recommendation"
          ? await apiJson(
              `/api/procurement/requests/${pr.id}/path-recommendation`,
            )
          : await post(`/api/procurement/requests/${pr.id}/${action}`, {
              expectedVersion: pr.version,
              reason,
              ...draft,
              title: `询价 ${pr.id}`,
              dueDate: draft.expectedDeliveryDate,
              invitedSupplierIds: [draft.supplierId],
            });
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
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <Card className="p-4 pb-20">
      <div className="flex justify-between">
        <div>
          <h2 className="text-sm font-semibold">真实采购流程</h2>
          <p className="text-[11px]" style={{ color: A.sub }}>
            PR 批准后选择直接采购或询价采购。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => create(false)}
            className="rounded-md px-3 py-2 text-xs"
            style={{ background: A.gray6 }}
          >
            保存草稿
          </button>
          <button
            onClick={() => create(true)}
            className="rounded-md px-3 py-2 text-xs text-white"
            style={{ background: A.blue }}
          >
            新建并提交 PR
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {(
          [
            "requesterId",
            "departmentId",
            "buyerId",
            "supplierId",
            "currency",
            "paymentTermsId",
            "expectedDeliveryDate",
          ] as const
        ).map((key) => (
          <Field
            key={key}
            label={
              (
                {
                  requesterId: "申请人",
                  departmentId: "部门",
                  buyerId: "采购负责人",
                  supplierId: "建议供应商",
                  currency: "币种",
                  paymentTermsId: "付款条款",
                  expectedDeliveryDate: "需求日期",
                } as const
              )[key]
            }
          >
            <input
              type={key === "expectedDeliveryDate" ? "date" : "text"}
              value={draft[key]}
              onChange={(event) =>
                setDraft({ ...draft, [key]: event.target.value })
              }
              style={inputStyle}
            />
          </Field>
        ))}
        {(["sku", "itemName", "unit", "warehouseId"] as const).map((key) => (
          <Field
            key={key}
            label={
              (
                {
                  sku: "物料",
                  itemName: "物料名称",
                  unit: "单位",
                  warehouseId: "目标仓库",
                } as const
              )[key]
            }
          >
            <input
              value={draft.lines[0][key]}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  lines: [{ ...draft.lines[0], [key]: event.target.value }],
                })
              }
              style={inputStyle}
            />
          </Field>
        ))}
        <Field label="数量">
          <input
            type="number"
            value={draft.lines[0].quantity}
            onChange={(event) =>
              setDraft({
                ...draft,
                lines: [
                  { ...draft.lines[0], quantity: Number(event.target.value) },
                ],
              })
            }
            style={inputStyle}
          />
        </Field>
        <Field label="单价">
          <input
            type="number"
            value={draft.lines[0].unitPrice}
            onChange={(event) =>
              setDraft({
                ...draft,
                lines: [
                  { ...draft.lines[0], unitPrice: Number(event.target.value) },
                ],
              })
            }
            style={inputStyle}
          />
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((pr) => (
          <div
            key={pr.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs"
          >
            <b>{pr.id}</b>
            <span>
              {pr.status} · {pr.procurementPath} · v{pr.version}
            </span>
            <span className="ml-auto">¥{pr.totalAmount.toLocaleString()}</span>
            {pr.status === "draft" && (
              <>
                <button onClick={() => act(pr, "submit")}>提交复核</button>
                <button onClick={() => act(pr, "cancel")}>取消</button>
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
        ))}
      </div>
      {recommendation && (
        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs">
          推荐：{recommendation.recommendation} ·{" "}
          {recommendation.recommendationReasons?.join("；")}
        </div>
      )}
    </Card>
  );
}
