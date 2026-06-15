import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardList, FileSpreadsheet, Inbox, PackageMinus, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { A, Card, Chip, inputStyle, KpiCard, Modal, SectionHeader } from "../../components/ui";
import { INVENTORY_MOVEMENT_LEDGER } from "../../data/demo-data";
import {
  filterInventoryMovements,
  INVENTORY_MOVEMENT_STATUS_FILTERS,
  INVENTORY_MOVEMENT_TYPE_FILTERS,
  INVENTORY_MOVEMENT_TYPE_LABELS,
  inventoryMovementExportRows,
  inventoryMovementSummary,
  isInventoryMovementException,
  netInventoryImpact,
} from "../../domain/inventory/movements";
import { exportRowsToCsv } from "../../lib/data-export";
import type { InventoryMovement, InventoryMovementStatus, InventoryMovementType } from "../../types/scm";

function statusTone(status: InventoryMovementStatus) {
  if (status === "已确认" || status === "已关闭") return { color: A.green, bg: "#f0faf4" };
  if (status === "待复核" || status === "已登记") return { color: A.orange, bg: "#fff8f0" };
  if (status === "异常处理" || status === "已取消") return { color: A.red, bg: "#fff1f0" };
  return { color: A.gray1, bg: A.gray6 };
}

function typeColor(type: InventoryMovementType) {
  return ({
    PurchaseReceipt: A.green,
    PurchaseReturn: A.orange,
    SalesDelivery: A.blue,
    SalesReturn: A.teal,
    StockAdjustment: A.purple,
    StockTransfer: A.indigo,
    CycleCountVariance: A.red,
  } satisfies Record<InventoryMovementType, string>)[type];
}

function quantityText(value: number) {
  if (!value) return "—";
  return value.toLocaleString("zh-CN");
}

export default function InventoryMovementLedger() {
  const [typeFilter, setTypeFilter] = useState<"全部" | InventoryMovementType>("全部");
  const [statusFilter, setStatusFilter] = useState<"全部" | InventoryMovementStatus>("全部");
  const [warehouseFilter, setWarehouseFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<InventoryMovement | null>(null);

  const warehouses = useMemo(() => ["全部", ...Array.from(new Set(INVENTORY_MOVEMENT_LEDGER.map((item) => item.warehouse)))], []);
  const visibleMovements = useMemo(() => filterInventoryMovements(INVENTORY_MOVEMENT_LEDGER, {
    type: typeFilter,
    status: statusFilter,
    warehouse: warehouseFilter,
    search,
  }), [search, statusFilter, typeFilter, warehouseFilter]);
  const summary = inventoryMovementSummary(visibleMovements);

  function exportLedger() {
    if (visibleMovements.length === 0) {
      toast.warning("暂无可导出的库存事务流水");
      return;
    }
    exportRowsToCsv("inventory-movement-ledger-export.csv", inventoryMovementExportRows(visibleMovements));
    toast.success("导出文件已生成", { description: "库存事务流水 CSV" });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="今日库存移动" value={String(summary.count)} sub="库存事务流水" icon={ClipboardList} color={A.blue} />
        <KpiCard label="入库数量" value={summary.inboundQty.toLocaleString("zh-CN")} sub="采购入库 / 销售退货" icon={PackagePlus} color={A.green} />
        <KpiCard label="出库数量" value={summary.outboundQty.toLocaleString("zh-CN")} sub="销售出库 / 采购退货" icon={PackageMinus} color={A.orange} />
        <KpiCard label="调整数量" value={summary.adjustmentQty.toLocaleString("zh-CN")} sub="库存调整 / 盘点差异" icon={SlidersHorizontal} color={summary.adjustmentQty < 0 ? A.red : A.purple} />
        <KpiCard label="待复核异常" value={String(summary.exceptionCount)} sub="库存异常与盘点差异" icon={AlertTriangle} color={summary.exceptionCount ? A.red : A.green} />
      </div>

      <Card>
        <div className="px-5 py-4 flex flex-wrap items-start justify-between gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>库存事务流水</h2>
            <p className="text-[11px] mt-1" style={{ color: A.sub }}>
              追踪采购入库、退货、销售出库、调拨、调整与盘点差异形成的库存影响。
            </p>
          </div>
          <button onClick={exportLedger}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all hover:opacity-90"
            style={{ background: A.gray6, color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
        </div>

        <div className="px-5 py-3 grid grid-cols-1 md:grid-cols-4 gap-3" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "全部" | InventoryMovementType)} style={inputStyle}>
            {INVENTORY_MOVEMENT_TYPE_FILTERS.map((item) => (
              <option key={item} value={item}>{item === "全部" ? "全部类型" : INVENTORY_MOVEMENT_TYPE_LABELS[item]}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "全部" | InventoryMovementStatus)} style={inputStyle}>
            {INVENTORY_MOVEMENT_STATUS_FILTERS.map((item) => <option key={item} value={item}>{item === "全部" ? "全部状态" : item}</option>)}
          </select>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} style={inputStyle}>
            {warehouses.map((item) => <option key={item} value={item}>{item === "全部" ? "全部仓库" : item}</option>)}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: A.gray2 }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索 SKU / 来源单据"
              className="pl-8"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1180px]">
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                {["单据号", "类型", "日期", "SKU", "品名", "仓库/库位", "来源单据", "入库", "出库", "调整", "状态", "负责人", "操作"].map((header) => (
                  <th key={header} className="text-left px-4 py-3 font-medium" style={{ color: A.gray1 }}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleMovements.map((item, index) => {
                const tone = statusTone(item.status);
                const net = netInventoryImpact(item);
                return (
                  <tr key={item.movementId} className="hover:bg-blue-50/40 transition-colors"
                    style={{ borderBottom: index < visibleMovements.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 tabular-nums font-medium" style={{ color: A.blue }}>{item.movementId}</td>
                    <td className="px-4 py-3"><Chip label={item.movementLabel} color={typeColor(item.movementType)} bg={`${typeColor(item.movementType)}18`} /></td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.sub }}>{item.date}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.blue }}>{item.sku}</td>
                    <td className="px-4 py-3 min-w-[150px]" style={{ color: A.label }}>{item.itemName}</td>
                    <td className="px-4 py-3 min-w-[150px]" style={{ color: A.sub }}>
                      <div style={{ color: A.label }}>{item.warehouse}</div>
                      <div className="text-[10px]">{item.location}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: A.indigo }}>{item.sourceDocument}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: item.quantityIn ? A.green : A.gray2 }}>{quantityText(item.quantityIn)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: item.quantityOut ? A.orange : A.gray2 }}>{quantityText(item.quantityOut)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: item.adjustmentQty < 0 ? A.red : item.adjustmentQty > 0 ? A.green : A.gray2 }}>
                      {item.adjustmentQty ? item.adjustmentQty.toLocaleString("zh-CN") : "—"}
                    </td>
                    <td className="px-4 py-3"><Chip label={item.status} color={tone.color} bg={tone.bg} /></td>
                    <td className="px-4 py-3" style={{ color: A.label }}>{item.owner}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(item)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium"
                        style={{ background: isInventoryMovementException(item) ? "#fff8f0" : A.gray6, color: isInventoryMovementException(item) ? A.orange : A.blue }}>
                        查看详情
                      </button>
                      <div className="text-[9px] mt-1" style={{ color: net < 0 ? A.red : net > 0 ? A.green : A.gray2 }}>
                        期末影响 {net > 0 ? "+" : ""}{net.toLocaleString("zh-CN")} {item.unit}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.movementId : "库存事务"}
        subtitle={selected ? `${selected.movementLabel} · ${selected.status}` : undefined}
        width={860}
        footer={<button onClick={() => setSelected(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: A.white, color: A.label }}>关闭</button>}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                ["来源单据", selected.sourceDocument],
                ["关联 PO", selected.relatedPo || "—"],
                ["关联 GRN / Return", selected.relatedGrn || selected.relatedReturn || "—"],
                ["负责人", selected.owner],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg p-3" style={{ background: A.gray6 }}>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
                  <div className="text-xs font-semibold mt-1 break-words" style={{ color: A.label }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4" style={{ boxShadow: "none", background: A.gray6 }}>
                <div className="text-[10px]" style={{ color: A.gray2 }}>数量影响</div>
                <div className="text-sm font-semibold mt-2" style={{ color: A.label }}>
                  入库 {quantityText(selected.quantityIn)} · 出库 {quantityText(selected.quantityOut)} · 调整 {selected.adjustmentQty || "—"}
                </div>
                <div className="text-[11px] mt-2 leading-5" style={{ color: A.sub }}>{selected.inventoryImpact}</div>
              </Card>
              <Card className="p-4 col-span-2" style={{ boxShadow: "none", background: A.gray6 }}>
                <div className="text-[10px]" style={{ color: A.gray2 }}>原因</div>
                <div className="text-xs mt-2 leading-5" style={{ color: A.label }}>{selected.reason}</div>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <SectionHeader title="关联证据" />
                <div className="space-y-2">
                  {selected.evidence.map((item) => (
                    <div key={`${item.label}-${item.value}`} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
                      <span className="text-[11px]" style={{ color: A.sub }}>{item.label}</span>
                      <span className="text-[11px] font-semibold" style={{ color: A.label }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SectionHeader title="操作记录" />
                <div className="space-y-2">
                  {selected.timeline.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex gap-2 rounded-lg px-3 py-2" style={{ background: A.gray6 }}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: A.white, color: A.blue }}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold" style={{ color: A.label }}>{item.label}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: A.sub }}>{item.value}</div>
                      </div>
                      {index < selected.timeline.length - 1 && <ArrowRight size={12} className="ml-auto mt-1" style={{ color: A.gray3 }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
