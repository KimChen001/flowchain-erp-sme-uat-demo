import { useEffect, useState } from "react";
import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { PurchaseOrder, ReceivingDocLine } from "../../../types/scm";
import { lineRemaining, poLinesOf, poTotals, toNumber } from "../../../domain/purchasing/helpers";
import { A, Field, inputStyle, Modal } from "../../../components/ui";

export function ScanReceiveModal({ open, onClose, candidates, onReceive }: {
  open: boolean; onClose: () => void;
  candidates: PurchaseOrder[];
  onReceive: (grn: string, po: string, lines: ReceivingDocLine[]) => void | Promise<void>;
}) {
  const [scan, setScan] = useState("");
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const selectedPO = candidates.find((c) => c.po === scan);
  const openLines = poLinesOf(selectedPO).filter((line) => lineRemaining(line) > 0);
  const [lineDrafts, setLineDrafts] = useState<ReceivingDocLine[]>([]);

  useEffect(() => {
    if (!selectedPO) {
      setLineDrafts([]);
      return;
    }
    setLineDrafts(openLines.map((line) => {
      const remaining = lineRemaining(line);
      return {
        poLineId: line.poLineId,
        poId: selectedPO.po,
        sku: line.sku,
        itemName: line.itemName,
        receivedQty: remaining,
        acceptedQty: remaining,
        rejectedQty: 0,
        warehouseId: line.warehouseId || "MAIN",
        unit: line.unit,
      };
    }));
  }, [selectedPO?.po]);

  function simulateScan() {
    if (candidates.length === 0) {
      toast.error("暂无可收货 PO", { description: "请先在采购订单中把订单下发至供应商" });
      return;
    }
    setScanning(true);
    setTimeout(() => {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      setScan(pick.po);
      setScanning(false);
    }, 900);
  }

  function updateLine(index: number, field: keyof ReceivingDocLine, value: string | number) {
    setLineDrafts((arr) => arr.map((line, i) => i === index ? { ...line, [field]: value } : line));
  }

  function validationMessage() {
    if (!selectedPO) return "PO 编号无效或不在可收货状态";
    if (lineDrafts.length === 0) return "该 PO 没有剩余可收货明细";
    for (const [index, line] of lineDrafts.entries()) {
      const received = toNumber(line.receivedQty);
      const accepted = toNumber(line.acceptedQty);
      const rejected = toNumber(line.rejectedQty);
      const sourceLine = openLines[index];
      if ([received, accepted, rejected].some((n) => n < 0)) return `${line.sku} 数量不能为负数`;
      if (accepted + rejected !== received) return `${line.sku} 合格 + 拒收必须等于本次收货`;
      if (received > lineRemaining(sourceLine)) return `${line.sku} 超过剩余可收货数量`;
    }
    return "";
  }

  async function confirm() {
    const po = candidates.find((c) => c.po === scan);
    if (!po) { toast.error("PO 编号无效或不在可收货状态"); return; }
    const error = validationMessage();
    if (error) { toast.error(error); return; }
    const grn = `GRN-202605-${String(424 + recent.length).padStart(4, "0")}`;
    await onReceive(grn, po.po, lineDrafts.map((line) => ({
      ...line,
      receivedQty: toNumber(line.receivedQty),
      acceptedQty: toNumber(line.acceptedQty),
      rejectedQty: toNumber(line.rejectedQty),
    })));
    setRecent([grn, ...recent].slice(0, 5));
    setScan("");
    toast.success(`${grn} 已创建`, { description: `${po.supplier} · ${lineDrafts.length} 行待质检` });
  }

  return (
    <Modal open={open} onClose={onClose} title="扫码收货" subtitle="扫描随车单据二维码，或手动输入 PO 编号">
      <div className="rounded-xl p-8 flex flex-col items-center"
        style={{ background: A.gray6, border: `1px dashed ${A.gray3}` }}>
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden"
          style={{ background: A.white, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <Camera size={28} style={{ color: scanning ? A.blue : A.gray2 }} />
          {scanning && (
            <div className="absolute inset-x-0 h-0.5 animate-pulse"
              style={{ background: A.blue, top: "50%", boxShadow: `0 0 12px ${A.blue}` }} />
          )}
        </div>
        <button onClick={simulateScan} disabled={scanning}
          className="text-xs px-4 py-1.5 rounded-lg font-medium text-white"
          style={{ background: A.blue, opacity: scanning ? 0.6 : 1 }}>
          {scanning ? "扫描中…" : "模拟扫码"}
        </button>
        <span className="text-[10px] mt-2" style={{ color: A.gray2 }}>对准条码 5–10 cm</span>
      </div>

      <div className="mt-5">
        <Field label="PO 编号">
          <div className="flex gap-2">
            <input value={scan} onChange={(e) => setScan(e.target.value)}
              placeholder="PO-2026-xxxx" style={inputStyle} />
            <button onClick={confirm}
              className="text-xs px-4 rounded-lg font-medium text-white shrink-0"
              style={{ background: A.green }}>确认收货</button>
          </div>
        </Field>
      </div>

      {selectedPO && (
        <div className="mt-5">
          <div className="text-[11px] mb-2 font-medium" style={{ color: A.sub }}>本次收货明细</div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {lineDrafts.map((line, index) => {
              const remaining = lineRemaining(openLines[index]);
              return (
                <div key={line.poLineId || `${line.sku}-${index}`} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold truncate" style={{ color: A.blue }}>{line.poLineId}</div>
                      <div className="text-xs font-medium truncate" style={{ color: A.label }}>{line.sku} · {line.itemName}</div>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: A.gray2 }}>剩余 {remaining} {line.unit}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      ["receivedQty", "收货"],
                      ["acceptedQty", "合格"],
                      ["rejectedQty", "拒收"],
                    ].map(([field, label]) => (
                      <Field key={field} label={label}>
                        <input type="number" min={0}
                          value={String((line as any)[field] ?? 0)}
                          onChange={(e) => updateLine(index, field as keyof ReceivingDocLine, Number(e.target.value))}
                          style={inputStyle} />
                      </Field>
                    ))}
                    <Field label="仓库">
                      <input value={line.warehouseId || ""}
                        onChange={(e) => updateLine(index, "warehouseId", e.target.value)}
                        style={inputStyle} />
                    </Field>
                  </div>
                </div>
              );
            })}
            {lineDrafts.length === 0 && (
              <div className="rounded-xl p-4 text-center text-xs" style={{ background: A.gray6, color: A.gray2 }}>
                该 PO 没有剩余可收货明细。
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="text-[11px] mb-2 font-medium" style={{ color: A.sub }}>可收货 PO ({candidates.length})</div>
        <div className="space-y-1.5 max-h-40 overflow-auto">
          {candidates.map((p) => {
            const totals = poTotals(p);
            return (
              <button key={p.po} onClick={() => setScan(p.po)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors"
                style={{
                  background: scan === p.po ? "#f0f6ff" : A.gray6,
                  border: `1px solid ${scan === p.po ? A.blue + "40" : "transparent"}`,
                }}>
                <span className="font-medium" style={{ color: A.blue }}>{p.po}</span>
                <span style={{ color: A.label }}>{p.supplier}</span>
                <span style={{ color: A.sub }}>{totals.totalReceivedQty}/{totals.totalOrderedQty}</span>
              </button>
            );
          })}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-5 rounded-xl p-3" style={{ background: "#f0faf4" }}>
          <div className="text-[11px] font-medium mb-1.5" style={{ color: A.green }}>本次会话已创建</div>
          {recent.map((g) => (
            <div key={g} className="flex items-center gap-2 text-xs py-0.5" style={{ color: A.label }}>
              <CheckCircle2 size={11} style={{ color: A.green }} />
              {g}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
