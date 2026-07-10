import { A, Modal } from "../../components/ui";
import { itemUsageSummary, supplierUsageSummary, warehouseUsageSummary } from "../../domain/master-data/helpers";
import { fmt } from "../../lib/format";
import type { ItemMaster, PaymentTerm, SupplierMaster, TaxCode, WarehouseBin } from "../../types/scm";

export type DetailRecord =
  | { type: "items"; item: ItemMaster }
  | { type: "suppliers"; item: SupplierMaster }
  | { type: "warehouses"; item: WarehouseBin }
  | { type: "tax-codes"; item: TaxCode }
  | { type: "payment-terms"; item: PaymentTerm };

export default function MasterDataDetailModal({ detail, onClose }: { detail: DetailRecord | null; onClose: () => void }) {
  if (!detail) return null;
  const title = detail.type === "items" ? detail.item.name
    : detail.type === "suppliers" ? detail.item.name
      : detail.type === "warehouses" ? `${detail.item.warehouseName} ${detail.item.bin}`
        : detail.type === "tax-codes" ? detail.item.name
          : detail.item.name;

  return (
    <Modal open={Boolean(detail)} onClose={onClose} title={title} subtitle="基础资料详情" width={760}>
      <div className="space-y-4">
        {detail.type === "items" && (() => {
          const item = detail.item;
          const usage = itemUsageSummary(item.sku);
          return (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["SKU", item.sku],
                  ["默认供应商", item.defaultSupplier],
                  ["默认仓库", item.defaultWarehouse],
                  ["默认库位", item.defaultBin],
                  ["默认税码", item.defaultTaxCode],
                  ["当前库存", usage.currentInventory.toLocaleString()],
                  ["打开 PO", usage.openPoCount],
                  ["事务流水", usage.movementCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                    <div className="fc-caption" style={{ color: A.gray2 }}>{label}</div>
                    <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5" style={{ color: A.sub }}>
                {item.specification} · 安全库存 {item.safetyStock.toLocaleString()} · ROP {item.reorderPoint.toLocaleString()} · 采购提前期 {item.leadTimeDays} 天
              </p>
            </>
          );
        })()}
        {detail.type === "suppliers" && (() => {
          const item = detail.item;
          const usage = supplierUsageSummary(item.name);
          return (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["供应商编码", item.code],
                  ["付款条款", item.paymentTerms],
                  ["默认税码", item.defaultTaxCode],
                  ["相关 PO", usage.poCount],
                  ["相关发票", usage.invoiceCount],
                  ["未结 AP", fmt(usage.openApAmount)],
                  ["贷项金额", fmt(usage.creditMemoAmount)],
                  ["对账状态", usage.reconciliationStatus],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                    <div className="fc-caption" style={{ color: A.gray2 }}>{label}</div>
                    <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5" style={{ color: A.sub }}>
                准时率 {item.onTimeRate}% · 质量合格率 {item.qualityRate}% · 风险状态 {item.riskStatus} · 认证状态 {item.certificationStatus}
              </p>
              <p className="text-xs leading-5" style={{ color: A.sub }}>
                基础资料维护供应商编码、付款条款、默认税码、联系人和启停状态；供应商绩效、风险、认证与协同证据集中在供应商管理中复核。
              </p>
            </>
          );
        })()}
        {detail.type === "warehouses" && (() => {
          const item = detail.item;
          const usage = warehouseUsageSummary(item.bin);
          return (
            <div className="grid grid-cols-4 gap-2">
              {[
                ["仓库编码", item.warehouseCode],
                ["库区", item.zone],
                ["容量", item.capacity.toLocaleString()],
                ["利用率", `${Math.round(item.utilization * 100)}%`],
                ["物料数", usage.itemCount],
                ["事务流水", usage.movementCount],
                ["盘点状态", usage.cycleCountStatus],
                ["负责人", item.owner],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="fc-caption" style={{ color: A.gray2 }}>{label}</div>
                  <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{value}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {detail.type === "tax-codes" && (
          <p className="text-xs leading-5" style={{ color: A.sub }}>
            {detail.item.code} · 税率 {Math.round(detail.item.rate * 100)}% · {detail.item.type} · {detail.item.description}
          </p>
        )}
        {detail.type === "payment-terms" && (
          <p className="text-xs leading-5" style={{ color: A.sub }}>
            {detail.item.code} · {detail.item.netDays} 天 · {detail.item.dueDateRule} · {detail.item.description}
          </p>
        )}
      </div>
    </Modal>
  );
}
