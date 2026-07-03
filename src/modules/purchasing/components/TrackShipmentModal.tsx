import { Check, Loader2 } from "lucide-react";
import { fmt } from "../../../lib/format";
import type { PurchaseOrder } from "../../../types/scm";
import { A, Modal } from "../../../components/ui";

export function TrackShipmentModal({ open, onClose, po }: {
  open: boolean; onClose: () => void; po: PurchaseOrder | null;
}) {
  if (!po) return null;
  const steps = [
    { label: "供应商确认", time: "5月26日 10:14", done: true,                                                  loc: po.supplier },
    { label: "已发货",     time: "5月26日 16:48", done: po.status !== "草稿" && po.status !== "待审批" && po.status !== "已审批", loc: "供应商出库口" },
    { label: "运输中",     time: "5月27日 03:22", done: ["部分到货", "已完成"].includes(po.status),              loc: "G42 京沪高速 · 距 280km" },
    { label: "抵达月台",   time: po.eta + " 09:00", done: ["部分到货", "已完成"].includes(po.status),             loc: "月台-02" },
    { label: "完成签收",   time: po.eta + " 11:30", done: po.status === "已完成",                                loc: "WMS 入库完成" },
  ];
  return (
    <Modal open={open} onClose={onClose} title={`物流跟踪 · ${po.po}`} subtitle={`${po.supplier} · ${fmt(po.amount)}`}>
      <div className="space-y-0">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-4 pb-5">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: s.done ? A.green : A.gray5, color: A.white }}>
                {s.done ? <Check size={13} /> : <Loader2 size={11} className={i === steps.findIndex((x) => !x.done) ? "animate-spin" : ""} />}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: s.done ? A.green : A.gray5 }} />
              )}
            </div>
            <div className="flex-1 -mt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: s.done ? A.label : A.gray1 }}>{s.label}</span>
                <span className="text-[11px] tabular-nums" style={{ color: A.gray2 }}>{s.time}</span>
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>{s.loc}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
