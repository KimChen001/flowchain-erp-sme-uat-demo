import { useEffect, useMemo, useState } from "react";
import { Database, FileSpreadsheet, Package, Search, Tags, Truck, Warehouse } from "lucide-react";
import ContextualImportActions from "../../components/import/ContextualImportActions";
import { A, Card, KpiCard, SubTabs } from "../../components/ui";
import { ITEM_MASTER, PAYMENT_TERMS, SUPPLIER_MASTER, TAX_CODES, WAREHOUSE_BINS } from "../../data/master-data";
import type { ActiveContext } from "../ai-assistant/Panel";
import MasterDataDetailModal, { type DetailRecord } from "./MasterDataDetailModal";
import MasterDataOverview from "./MasterDataOverview";
import MasterDataTables from "./MasterDataTables";
import { fetchMasterDataSnapshot, type MasterDataSnapshot } from "./api";
import { exportMasterDataCsv } from "./export";

export type MasterDataTab = "overview" | "items" | "suppliers" | "warehouses" | "tax-codes" | "payment-terms";
export type MasterDataTableTab = Exclude<MasterDataTab, "overview">;

const tabs = [
  { id: "overview", label: "主数据总览", icon: Database },
  { id: "items", label: "物料主数据", icon: Package },
  { id: "suppliers", label: "供应商主数据", icon: Truck },
  { id: "warehouses", label: "仓库 / 库位", icon: Warehouse },
  { id: "tax-codes", label: "税码", icon: Tags },
  { id: "payment-terms", label: "付款条款", icon: FileSpreadsheet },
] as const;

const fallbackMasterData: MasterDataSnapshot = {
  items: ITEM_MASTER,
  suppliers: SUPPLIER_MASTER,
  warehouses: WAREHOUSE_BINS,
  taxCodes: TAX_CODES,
  paymentTerms: PAYMENT_TERMS,
};

export default function MasterDataPage({
  initialView = "overview",
  focus,
  onActiveContextChange,
}: {
  initialView?: MasterDataTab;
  focus?: { entityType: string; entityId: string; at: number } | null;
  onActiveContextChange?: (context: ActiveContext | null) => void;
}) {
  const [tab, setTab] = useState<MasterDataTab>(initialView);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [masterData, setMasterData] = useState<MasterDataSnapshot>(fallbackMasterData);

  useEffect(() => {
    if (initialView) setTab(initialView);
  }, [initialView]);

  useEffect(() => {
    if (!focus?.entityId) return;
    const normalized = focus.entityId.toLowerCase();
    if (focus.entityType === "item") {
      const item = masterData.items.find((entry) =>
        entry.sku.toLowerCase() === normalized ||
        entry.name.toLowerCase() === normalized
      );
      if (!item) return;
      setTab("items");
      setDetail({ type: "items", item });
      return;
    }
    if (focus.entityType === "supplier") {
      const supplier = masterData.suppliers.find((entry) =>
        entry.code.toLowerCase() === normalized ||
        entry.name.toLowerCase() === normalized
      );
      if (!supplier) return;
      setTab("suppliers");
      setDetail({ type: "suppliers", item: supplier });
      return;
    }
    if (focus.entityType === "warehouse" || focus.entityType === "bin") {
      setTab("warehouses");
      setSearch(focus.entityId);
    }
  }, [focus?.at, focus?.entityType, focus?.entityId, masterData]);

  useEffect(() => {
    let alive = true;
    fetchMasterDataSnapshot(fallbackMasterData)
      .then((snapshot) => { if (alive) setMasterData(snapshot); })
      .catch(() => { if (alive) setMasterData(fallbackMasterData); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!detail || (detail.type !== "items" && detail.type !== "suppliers")) {
      onActiveContextChange?.(null);
      return;
    }
    if (detail.type === "items") {
      onActiveContextChange?.({
        module: "master-data",
        entityType: "item",
        entityId: detail.item.sku,
        entityLabel: detail.item.name || detail.item.sku,
        view: "items",
      });
      return () => onActiveContextChange?.(null);
    }
    onActiveContextChange?.({
      module: "master-data",
      entityType: "supplier",
      entityId: detail.item.code,
      entityLabel: detail.item.name,
      view: "suppliers",
    });
    return () => onActiveContextChange?.(null);
  }, [detail, onActiveContextChange]);

  const query = search.trim().toLowerCase();
  const filteredItems = useMemo(() => masterData.items.filter((item) =>
    !query || [item.sku, item.name, item.category, item.defaultSupplier, item.defaultBin, item.defaultTaxCode].some((value) => value.toLowerCase().includes(query))
  ), [masterData.items, query]);
  const filteredSuppliers = useMemo(() => masterData.suppliers.filter((item) =>
    !query || [item.code, item.name, item.category, item.contact, item.paymentTerms, item.defaultTaxCode].some((value) => value.toLowerCase().includes(query))
  ), [masterData.suppliers, query]);
  const filteredWarehouses = useMemo(() => masterData.warehouses.filter((item) =>
    !query || [item.warehouseCode, item.warehouseName, item.zone, item.bin, item.owner].some((value) => value.toLowerCase().includes(query))
  ), [masterData.warehouses, query]);
  const filteredTaxCodes = useMemo(() => masterData.taxCodes.filter((item) =>
    !query || [item.code, item.name, item.type, item.region, item.description].some((value) => value.toLowerCase().includes(query))
  ), [masterData.taxCodes, query]);
  const filteredPaymentTerms = useMemo(() => masterData.paymentTerms.filter((item) =>
    !query || [item.code, item.name, item.description].some((value) => value.toLowerCase().includes(query))
  ), [masterData.paymentTerms, query]);

  function exportCurrent() {
    exportMasterDataCsv(tab, {
      items: filteredItems,
      suppliers: filteredSuppliers,
      warehouses: filteredWarehouses,
      taxCodes: filteredTaxCodes,
      paymentTerms: filteredPaymentTerms,
    });
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
      <MasterDataDetailModal detail={detail} onClose={() => setDetail(null)} />
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
        <KpiCard label="物料主数据" value={String(masterData.items.length)} sub={`${masterData.items.filter((item) => item.status === "待完善").length} 条待完善`} icon={Package} color={A.blue} />
        <KpiCard label="供应商主数据" value={String(masterData.suppliers.length)} sub={`${masterData.suppliers.filter((item) => item.riskStatus === "高").length} 个高风险`} icon={Truck} color={A.purple} />
        <KpiCard label="仓库 / 库位" value={String(masterData.warehouses.length)} sub={`${masterData.warehouses.filter((item) => item.available).length} 个可用`} icon={Warehouse} color={A.green} />
        <KpiCard label="税码" value={String(masterData.taxCodes.length)} sub={`${masterData.taxCodes.filter((item) => item.status === "启用").length} 个启用`} icon={Tags} color={A.orange} />
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
            <FileSpreadsheet size={13} /> 导出当前结果
          </button>
        </div>
      </div>

      <Card>
        {tab === "overview" ? (
          <MasterDataOverview data={masterData} onOpenTab={setTab} />
        ) : (
          <MasterDataTables
            tab={tab as MasterDataTableTab}
            items={filteredItems}
            suppliers={filteredSuppliers}
            warehouses={filteredWarehouses}
            taxCodes={filteredTaxCodes}
            paymentTerms={filteredPaymentTerms}
            onDetail={setDetail}
          />
        )}
      </Card>
    </div>
  );
}
