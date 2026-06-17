import { useEffect, useMemo, useState } from "react";
import { Database, FileSpreadsheet, Package, Search, Tags, Truck, Warehouse } from "lucide-react";
import { toast } from "sonner";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { A, Card, Chip, KpiCard, Modal, SubTabs } from "../../components/ui";
import { ITEM_MASTER, PAYMENT_TERMS, SUPPLIER_MASTER, TAX_CODES, WAREHOUSE_BINS } from "../../data/master-data";
import { itemUsageSummary, masterDataQualitySignals, supplierUsageSummary, warehouseUsageSummary } from "../../domain/master-data/helpers";
import { exportRowsToCsv } from "../../lib/data-export";
import { fmt } from "../../lib/format";
import type { ItemMaster, PaymentTerm, SupplierMaster, TaxCode, WarehouseBin } from "../../types/scm";

type MasterDataTab = "overview" | "items" | "suppliers" | "warehouses" | "tax-codes" | "payment-terms";
type DetailRecord =
  | { type: "items"; item: ItemMaster }
  | { type: "suppliers"; item: SupplierMaster }
  | { type: "warehouses"; item: WarehouseBin }
  | { type: "tax-codes"; item: TaxCode }
  | { type: "payment-terms"; item: PaymentTerm };

const tabs = [
  { id: "overview", label: "主数据总览", icon: Database },
  { id: "items", label: "物料主数据", icon: Package },
  { id: "suppliers", label: "供应商主数据", icon: Truck },
  { id: "warehouses", label: "仓库 / 库位", icon: Warehouse },
  { id: "tax-codes", label: "税码", icon: Tags },
  { id: "payment-terms", label: "付款条款", icon: FileSpreadsheet },
] as const;

function statusStyle(status: string) {
  if (["启用", "已认证", "可用"].includes(status)) return { color: A.green, bg: "#f0faf4" };
  if (["停用", "冻结", "高"].includes(status)) return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}

function BoolText({ value }: { value: boolean }) {
  return <span style={{ color: value ? A.green : A.gray2 }}>{value ? "是" : "否"}</span>;
}

function DetailModal({ detail, onClose }: { detail: DetailRecord | null; onClose: () => void }) {
  if (!detail) return null;
  const title = detail.type === "items" ? detail.item.name
    : detail.type === "suppliers" ? detail.item.name
      : detail.type === "warehouses" ? `${detail.item.warehouseName} ${detail.item.bin}`
        : detail.type === "tax-codes" ? detail.item.name
          : detail.item.name;

  return (
    <Modal open={Boolean(detail)} onClose={onClose} title={title} subtitle="主数据详情" width={760}>
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
                    <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
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
                    <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
                    <div className="text-xs font-semibold mt-1 truncate" style={{ color: A.label }}>{value}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-5" style={{ color: A.sub }}>
                准时率 {item.onTimeRate}% · 质量合格率 {item.qualityRate}% · 风险状态 {item.riskStatus} · 认证状态 {item.certificationStatus}
              </p>
              <p className="text-xs leading-5" style={{ color: A.sub }}>
                主数据维护供应商编码、付款条款、默认税码、联系人和启停状态；供应商绩效、风险、认证与协同证据集中在供应商管理中复核。
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
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{label}</div>
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

export default function MasterDataPage({ initialView = "overview" }: { initialView?: MasterDataTab }) {
  const [tab, setTab] = useState<MasterDataTab>(initialView);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailRecord | null>(null);

  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(() => ITEM_MASTER.filter((item) =>
    !query || [item.sku, item.name, item.category, item.defaultSupplier, item.defaultBin, item.defaultTaxCode].some((value) => value.toLowerCase().includes(query))
  ), [query]);
  const filteredSuppliers = useMemo(() => SUPPLIER_MASTER.filter((item) =>
    !query || [item.code, item.name, item.category, item.contact, item.paymentTerms, item.defaultTaxCode].some((value) => value.toLowerCase().includes(query))
  ), [query]);
  const filteredWarehouses = useMemo(() => WAREHOUSE_BINS.filter((item) =>
    !query || [item.warehouseCode, item.warehouseName, item.zone, item.bin, item.owner].some((value) => value.toLowerCase().includes(query))
  ), [query]);
  const filteredTaxCodes = useMemo(() => TAX_CODES.filter((item) =>
    !query || [item.code, item.name, item.type, item.region, item.description].some((value) => value.toLowerCase().includes(query))
  ), [query]);
  const filteredPaymentTerms = useMemo(() => PAYMENT_TERMS.filter((item) =>
    !query || [item.code, item.name, item.description].some((value) => value.toLowerCase().includes(query))
  ), [query]);

  function exportCurrent() {
    const configs = {
      items: {
        filename: "master-data-items-export.csv",
        rows: filteredItems.map((item) => ({
          SKU: item.sku,
          物料名称: item.name,
          物料分类: item.category,
          规格型号: item.specification,
          单位: item.unit,
          默认仓库: item.defaultWarehouse,
          默认库位: item.defaultBin,
          安全库存: item.safetyStock,
          最大库存: item.maxStock,
          ROP: item.reorderPoint,
          采购提前期: item.leadTimeDays,
          批次管理: item.batchManaged ? "是" : "否",
          序列号管理: item.serialManaged ? "是" : "否",
          质检要求: item.qaRequired ? "是" : "否",
          默认供应商: item.defaultSupplier,
          默认税码: item.defaultTaxCode,
          状态: item.status,
        })),
      },
      suppliers: {
        filename: "master-data-suppliers-export.csv",
        rows: filteredSuppliers.map((item) => ({
          供应商编码: item.code,
          供应商名称: item.name,
          品类: item.category,
          联系人: item.contact,
          邮箱: item.email,
          电话: item.phone,
          付款条款: item.paymentTerms,
          币种: item.currency,
          税号: item.taxId,
          默认税码: item.defaultTaxCode,
          评级: item.rating,
          准时率: item.onTimeRate,
          质量合格率: item.qualityRate,
          风险状态: item.riskStatus,
          认证状态: item.certificationStatus,
          状态: item.status,
        })),
      },
      warehouses: {
        filename: "master-data-warehouse-bins-export.csv",
        rows: filteredWarehouses.map((item) => ({
          仓库编码: item.warehouseCode,
          仓库名称: item.warehouseName,
          库区: item.zone,
          库位: item.bin,
          容量: item.capacity,
          利用率: item.utilization,
          温控要求: item.temperatureRequirement,
          QA状态: item.qaStatus,
          可用: item.available ? "是" : "否",
          负责人: item.owner,
        })),
      },
      "tax-codes": {
        filename: "master-data-tax-codes-export.csv",
        rows: filteredTaxCodes.map((item) => ({
          税码: item.code,
          税码名称: item.name,
          税率: item.rate,
          税种: item.type,
          区域: item.region,
          默认: item.isDefault ? "是" : "否",
          状态: item.status,
          描述: item.description,
        })),
      },
      "payment-terms": {
        filename: "master-data-payment-terms-export.csv",
        rows: filteredPaymentTerms.map((item) => ({
          条款编码: item.code,
          条款名称: item.name,
          净账期天数: item.netDays,
          折扣规则: item.discountRule,
          到期规则: item.dueDateRule,
          状态: item.status,
          描述: item.description,
        })),
      },
    } satisfies Record<Exclude<MasterDataTab, "overview">, { filename: string; rows: Record<string, unknown>[] }>;
    if (tab === "overview") {
      toast("请选择一个主数据视图导出");
      return;
    }
    const current = configs[tab];
    exportRowsToCsv(current.filename, current.rows);
    toast.success("CSV 已导出");
  }

  const importLabels = {
    overview: ["主数据", "主数据"],
    items: ["物料主数据", "物料"],
    suppliers: ["供应商主数据", "供应商"],
    warehouses: ["仓库库位", "库位"],
    "tax-codes": ["税码", "税码"],
    "payment-terms": ["付款条款", "付款条款"],
  } satisfies Record<MasterDataTab, [string, string]>;

  const [entityLabel, templateName] = importLabels[tab];

  return (
    <div className="space-y-4">
      <DetailModal detail={detail} onClose={() => setDetail(null)} />
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>主数据</h1>
            <p className="text-xs leading-5 mt-1 max-w-3xl" style={{ color: A.sub }}>
              统一维护物料、供应商、仓库库位、税码与付款条款，为采购、库存、发票和 SRM 流程提供基础数据。
            </p>
            <div className="mt-3 rounded-xl px-3 py-2 text-[11px] leading-5" style={{ background: "#f0f6ff", color: A.blue }}>
              首屏先看质量摘要和控制范围，再进入具体主数据表。
            </div>
          </div>
          <ContextualImportActions entityLabel={entityLabel} templateName={templateName} compact />
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="物料主数据" value={String(ITEM_MASTER.length)} sub={`${ITEM_MASTER.filter((item) => item.status === "待完善").length} 条待完善`} icon={Package} color={A.blue} />
        <KpiCard label="供应商主数据" value={String(SUPPLIER_MASTER.length)} sub={`${SUPPLIER_MASTER.filter((item) => item.riskStatus === "高").length} 个高风险`} icon={Truck} color={A.purple} />
        <KpiCard label="仓库 / 库位" value={String(WAREHOUSE_BINS.length)} sub={`${WAREHOUSE_BINS.filter((item) => item.available).length} 个可用`} icon={Warehouse} color={A.green} />
        <KpiCard label="税码" value={String(TAX_CODES.length)} sub={`${TAX_CODES.filter((item) => item.status === "启用").length} 个启用`} icon={Tags} color={A.orange} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <SubTabs tabs={tabs as any} value={tab} onChange={(value) => setTab(value as MasterDataTab)} />
        <div className="flex items-center gap-2">
          <div className="h-8 px-2 rounded-lg flex items-center gap-1.5" style={{ background: A.white, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.08)" }}>
            <Search size={12} style={{ color: A.gray2 }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索主数据"
              className="w-44 bg-transparent outline-none text-xs"
              style={{ color: A.label }} />
          </div>
          <button onClick={exportCurrent}
            className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5"
            style={{ background: "#f0f6ff", color: A.blue }}>
            <FileSpreadsheet size={13} /> 导出 CSV
          </button>
        </div>
      </div>

      <Card>
        {tab === "overview" && (
          <MasterDataOverview onOpenTab={setTab} />
        )}
        {tab === "items" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["SKU", "物料名称", "物料分类", "单位", "默认仓库", "默认库位", "ROP", "默认供应商", "默认税码", "批次", "序列", "质检", "状态", "操作"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredItems.map((item, index) => {
                const style = statusStyle(item.status);
                return (
                  <tr key={item.sku} style={{ borderBottom: index < filteredItems.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{item.sku}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.label }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.category}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.unit}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.defaultWarehouse}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.defaultBin}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.reorderPoint.toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: A.sub }}>{item.defaultSupplier}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.defaultTaxCode}</td>
                    <td className="px-4 py-3"><BoolText value={item.batchManaged} /></td>
                    <td className="px-4 py-3"><BoolText value={item.serialManaged} /></td>
                    <td className="px-4 py-3"><BoolText value={item.qaRequired} /></td>
                    <td className="px-4 py-3"><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3"><button onClick={() => setDetail({ type: "items", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {tab === "suppliers" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["供应商编码", "供应商名称", "品类", "联系人", "付款条款", "币种", "税号", "默认税码", "评级", "准时率", "质量合格率", "风险", "认证", "状态", "操作"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredSuppliers.map((item, index) => {
                const style = statusStyle(item.status);
                const riskStyle = statusStyle(item.riskStatus);
                return (
                  <tr key={item.code} style={{ borderBottom: index < filteredSuppliers.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{item.code}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.label }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.category}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.contact}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.paymentTerms}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.currency}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.taxId}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.defaultTaxCode}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.rating.toFixed(1)}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.onTimeRate}%</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.qualityRate}%</td>
                    <td className="px-4 py-3"><Chip label={item.riskStatus} color={riskStyle.color} bg={riskStyle.bg} /></td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.certificationStatus}</td>
                    <td className="px-4 py-3"><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3"><button onClick={() => setDetail({ type: "suppliers", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {tab === "warehouses" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["仓库编码", "仓库名称", "库区", "库位", "容量", "利用率", "温控要求", "QA状态", "可用", "负责人", "操作"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredWarehouses.map((item, index) => {
                const style = statusStyle(item.qaStatus);
                return (
                  <tr key={`${item.warehouseCode}-${item.bin}`} style={{ borderBottom: index < filteredWarehouses.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{item.warehouseCode}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.label }}>{item.warehouseName}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.zone}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.bin}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.capacity.toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: item.utilization > 0.85 ? A.red : A.label }}>{Math.round(item.utilization * 100)}%</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.temperatureRequirement}</td>
                    <td className="px-4 py-3"><Chip label={item.qaStatus} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3"><BoolText value={item.available} /></td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.owner}</td>
                    <td className="px-4 py-3"><button onClick={() => setDetail({ type: "warehouses", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {tab === "tax-codes" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["税码", "税码名称", "税率", "税种", "区域", "默认", "状态", "描述", "操作"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredTaxCodes.map((item, index) => {
                const style = statusStyle(item.status);
                return (
                  <tr key={item.code} style={{ borderBottom: index < filteredTaxCodes.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{item.code}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{Math.round(item.rate * 100)}%</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.type}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.region}</td>
                    <td className="px-4 py-3"><BoolText value={item.isDefault} /></td>
                    <td className="px-4 py-3"><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3 max-w-[320px] truncate" style={{ color: A.sub }}>{item.description}</td>
                    <td className="px-4 py-3"><button onClick={() => setDetail({ type: "tax-codes", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
        {tab === "payment-terms" && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["条款编码", "条款名称", "净账期天数", "折扣规则", "到期规则", "状态", "描述", "操作"].map((h) => <th key={h} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
              <tbody>{filteredPaymentTerms.map((item, index) => {
                const style = statusStyle(item.status);
                return (
                  <tr key={item.code} style={{ borderBottom: index < filteredPaymentTerms.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: A.blue }}>{item.code}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: A.label }}>{item.name}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.netDays}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.discountRule}</td>
                    <td className="px-4 py-3" style={{ color: A.sub }}>{item.dueDateRule}</td>
                    <td className="px-4 py-3"><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                    <td className="px-4 py-3 max-w-[360px] truncate" style={{ color: A.sub }}>{item.description}</td>
                    <td className="px-4 py-3"><button onClick={() => setDetail({ type: "payment-terms", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MasterDataOverview({ onOpenTab }: { onOpenTab: (tab: MasterDataTab) => void }) {
  const quality = masterDataQualitySignals();
  const entries = [
    { tab: "items" as const, title: "物料主数据", desc: "SKU、规格、库存策略、默认仓库、默认供应商和税码。", signal: `${ITEM_MASTER.length} 条记录`, icon: Package },
    { tab: "suppliers" as const, title: "供应商主数据", desc: "供应商编码、付款条款、默认税码、联系人和启停状态。", signal: `${SUPPLIER_MASTER.length} 条记录`, icon: Truck },
    { tab: "warehouses" as const, title: "仓库 / 库位", desc: "仓库、库区、库位容量、QA 状态和负责人。", signal: `${WAREHOUSE_BINS.length} 个库位`, icon: Warehouse },
    { tab: "tax-codes" as const, title: "税码", desc: "采购与发票协同使用的税码、税率和默认状态。", signal: `${TAX_CODES.length} 个税码`, icon: Tags },
    { tab: "payment-terms" as const, title: "付款条款", desc: "供应商协同和 AP 可见性使用的付款规则。", signal: `${PAYMENT_TERMS.length} 个条款`, icon: FileSpreadsheet },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#f0f6ff" }}>
        <div className="text-sm font-semibold" style={{ color: A.label }}>主数据控制范围</div>
        <p className="text-xs leading-5 mt-1" style={{ color: A.sub }}>
          主数据只维护源头记录，为采购、库存、发票和 SRM 提供基础数据；供应商风险解释和交易处理仍回到对应业务工作台。
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "缺少默认税码", value: quality.missingTaxCode, color: A.red },
          { label: "缺少默认供应商", value: quality.missingSupplier, color: A.orange },
          { label: "待复核记录", value: quality.totalIssues, color: A.blue },
        ].map((item) => (
          <div key={item.label} className="rounded-xl p-4" style={{ background: A.gray6 }}>
            <div className="text-[11px]" style={{ color: A.gray2 }}>{item.label}</div>
            <div className="text-xl font-semibold mt-1" style={{ color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <div key={entry.tab} className="rounded-xl p-4" style={{ background: A.gray6 }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: A.white, color: A.blue }}>
                <Icon size={15} />
              </div>
              <div className="text-sm font-semibold" style={{ color: A.label }}>{entry.title}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>{entry.desc}</div>
              <div className="text-[11px] font-medium mt-2" style={{ color: A.blue }}>{entry.signal}</div>
              <button onClick={() => onOpenTab(entry.tab)} className="mt-3 w-full text-[11px] px-2.5 py-1.5 rounded-md font-medium" style={{ background: A.white, color: A.blue }}>
                进入
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
