import { useEffect, useState } from "react";
import { FileCheck2, Lock } from "lucide-react";
import { toast } from "sonner";
import type { ReceivingDoc, ReceivingDocLine } from "../../../types/scm";
import { toNumber } from "../../../domain/purchasing/helpers";
import { grnLinesOf, isPostedGrn } from "../../../domain/receiving/helpers";
import { A, Field, inputStyle, Modal } from "../../../components/ui";

export function QCModal({ open, onClose, grn, onComplete }: {
  open: boolean; onClose: () => void;
  grn: ReceivingDoc | null;
  onComplete: (grnId: string, lines: ReceivingDocLine[], warehouse: string) => void;
}) {
  const [lineDrafts, setLineDrafts] = useState<ReceivingDocLine[]>([]);
  const [warehouse, setWarehouse] = useState("MAIN");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!grn) return;
    const lines = grnLinesOf(grn);
    setLineDrafts(lines.map((line) => ({
      ...line,
      acceptedQty: toNumber(line.acceptedQty, toNumber(line.receivedQty)),
      rejectedQty: toNumber(line.rejectedQty),
      warehouseId: line.warehouseId || grn.warehouse || "MAIN",
    })));
    setWarehouse(lines[0]?.warehouseId || grn.warehouse || "MAIN");
  }, [grn?.grn, grn?.status]);

  if (!grn) return null;
  const posted = isPostedGrn(grn);
  const totalReceived = lineDrafts.reduce((sum, line) => sum + toNumber(line.receivedQty), 0);
  const totalAccepted = lineDrafts.reduce((sum, line) => sum + toNumber(line.acceptedQty), 0);
  const totalRejected = lineDrafts.reduce((sum, line) => sum + toNumber(line.rejectedQty), 0);

  function updateLine(index: number, field: keyof ReceivingDocLine, value: string | number) {
    if (posted) return;
    setLineDrafts((arr) => arr.map((line, i) => i === index ? { ...line, [field]: value } : line));
  }

  function validationMessage() {
    for (const line of lineDrafts) {
      const received = toNumber(line.receivedQty);
      const accepted = toNumber(line.acceptedQty);
      const rejected = toNumber(line.rejectedQty);
      if ([received, accepted, rejected].some((n) => n < 0)) return `${line.sku} 数量不能为负数`;
      if (accepted > received) return `${line.sku} 合格数不能超过收货数`;
      if (rejected > received) return `${line.sku} 拒收数不能超过收货数`;
      if (accepted + rejected !== received) return `${line.sku} 合格 + 拒收必须等于本次收货`;
      if (!line.poLineId) return `${line.sku} 缺少 PO line 引用`;
    }
    return "";
  }

  function submit() {
    const error = validationMessage();
    if (error) { toast.error(error); return; }
    onComplete(grn.grn, lineDrafts.map((line) => ({
      ...line,
      receivedQty: toNumber(line.receivedQty),
      acceptedQty: toNumber(line.acceptedQty),
      rejectedQty: toNumber(line.rejectedQty),
      warehouseId: line.warehouseId || warehouse,
    })), warehouse);
    toast.success(`${grn.grn} 质检完成`, {
      description: `合格 ${totalAccepted} · 拒收 ${totalRejected} · 收货 ${totalReceived}`,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} width={760}
      title={`质检 · ${grn.grn}`} subtitle={`${grn.supplier} · 关联 ${grn.po} · ${lineDrafts.length} 行明细`}
      footer={
        <>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: A.white, color: A.label, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.1)" }}>
            {posted ? "关闭" : "稍后处理"}
          </button>
          {!posted && (
            <button onClick={submit}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white flex items-center gap-1.5"
              style={{ background: A.blue }}>
              <FileCheck2 size={11} /> 完成质检并入库
            </button>
          )}
        </>
      }>
      {posted && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "#fff8f0", border: "1px solid rgba(255,149,0,0.18)" }}>
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: A.orange }}>
            <Lock size={12} /> 已过账 GRN 只读
          </div>
          <div className="text-[11px] mt-1 leading-5" style={{ color: A.sub }}>
            已过账收货单不能直接修改数量、SKU、PO line 或仓库；后续需要正式冲销/退货流程。
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl p-3" style={{ background: A.gray6 }}>
          <div className="text-[10px]" style={{ color: A.gray1 }}>本次收货</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.label }}>{totalReceived}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[10px]" style={{ color: A.green }}>合格入库</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.green }}>{totalAccepted}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "#fff1f0" }}>
          <div className="text-[10px]" style={{ color: A.red }}>拒收隔离</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: A.red }}>{totalRejected}</div>
        </div>
      </div>

      {(grn.postedAt || grn.postedBy || typeof grn.inventoryApplied === "boolean" || grn.inventoryMovementIds?.length) && (
        <div className="rounded-xl p-3 mb-4" style={{ background: A.gray6 }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: A.label }}>过账与库存应用</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><span style={{ color: A.gray2 }}>postedAt</span><div className="font-medium" style={{ color: A.label }}>{grn.postedAt ? new Date(grn.postedAt).toLocaleString("zh-CN") : "—"}</div></div>
            <div><span style={{ color: A.gray2 }}>postedBy</span><div className="font-medium" style={{ color: A.label }}>{grn.postedBy || "—"}</div></div>
            <div><span style={{ color: A.gray2 }}>inventoryApplied</span><div className="font-medium" style={{ color: grn.inventoryApplied ? A.green : A.gray1 }}>{grn.inventoryApplied ? "true" : "false"}</div></div>
            <div><span style={{ color: A.gray2 }}>movementIds</span><div className="font-medium truncate" style={{ color: A.blue }}>{grn.inventoryMovementIds?.join(", ") || "—"}</div></div>
          </div>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: `0.5px solid ${A.gray4}` }}>
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 px-3 py-2 text-[10px] font-medium" style={{ color: A.gray1, background: A.gray6 }}>
          <span>PO Line / SKU</span><span>收货</span><span>合格</span><span>拒收</span><span>仓库</span>
        </div>
        <div className="max-h-72 overflow-auto">
          {lineDrafts.map((line, index) => (
            <div key={line.grnLineId || line.poLineId || index}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_1fr] gap-2 px-3 py-2.5 text-xs items-center"
              style={{ borderTop: index > 0 ? "0.5px solid rgba(0,0,0,0.05)" : "none" }}>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{line.poLineId || "legacy-match-by-sku"}</div>
                <div className="font-medium truncate" style={{ color: A.label }}>{line.sku} · {line.itemName}</div>
              </div>
              {(["receivedQty", "acceptedQty", "rejectedQty"] as const).map((field) => (
                <input key={field} type="number" min={0} disabled={posted}
                  value={String(line[field] ?? 0)}
                  onChange={(e) => updateLine(index, field, Number(e.target.value))}
                  style={{ ...inputStyle, height: 32, color: posted ? A.gray1 : A.label }} />
              ))}
              <input disabled={posted} value={line.warehouseId || ""}
                onChange={(e) => updateLine(index, "warehouseId", e.target.value)}
                style={{ ...inputStyle, height: 32, color: posted ? A.gray1 : A.label }} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Field label="默认入库库区">
          <input value={warehouse} disabled={posted}
            onChange={(e) => setWarehouse(e.target.value)}
            style={{ ...inputStyle, color: posted ? A.gray1 : A.label }} />
        </Field>
        <Field label="质检员">
          <input value={grn.receiver || "刘建华"} disabled style={{ ...inputStyle, color: A.sub }} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="备注（异常说明）">
          <textarea value={notes} disabled={posted}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={posted ? "已过账记录只读" : "可记录拒收、短装、破损、让步接收原因"}
            style={{ ...inputStyle, minHeight: 72, resize: "vertical", color: posted ? A.gray1 : A.label }} />
        </Field>
      </div>
    </Modal>
  );
}
