import { FileSpreadsheet, Package, Tags, Truck, Warehouse } from "lucide-react";
import { A } from "../../components/ui";
import type { MasterDataTab } from "./Page";
import type { MasterDataSnapshot } from "./api";

function masterDataQualitySignals(data: MasterDataSnapshot) {
  const missingTaxCode = data.items.filter((item) => !item.defaultTaxCode).length + data.suppliers.filter((supplier) => !supplier.defaultTaxCode).length;
  const missingSupplier = data.items.filter((item) => !item.defaultSupplier).length;
  const inactiveBins = data.warehouses.filter((bin) => !bin.available || bin.qaStatus !== "可用").length;
  const incompleteItems = data.items.filter((item) => item.status === "待完善").length;
  const supplierReview = data.suppliers.filter((supplier) => ["整改中", "待复核"].includes(supplier.certificationStatus)).length;
  const taxCodeReview = data.taxCodes.filter((taxCode) => taxCode.status === "待复核").length;
  const paymentTermReview = data.paymentTerms.filter((term) => term.status === "待复核").length;
  return {
    missingTaxCode,
    missingSupplier,
    inactiveBins,
    totalIssues: missingTaxCode + missingSupplier + inactiveBins + incompleteItems + supplierReview + taxCodeReview + paymentTermReview,
  };
}

export default function MasterDataOverview({ data, onOpenTab }: { data: MasterDataSnapshot; onOpenTab: (tab: MasterDataTab) => void }) {
  const quality = masterDataQualitySignals(data);
  const entries = [
    { tab: "items" as const, title: "物料资料", desc: "SKU、规格、库存策略、默认仓库、默认供应商和税码。", signal: `${data.items.length} 条记录`, icon: Package },
    { tab: "suppliers" as const, title: "供应商资料", desc: "供应商编码、付款条款、默认税码、联系人和启停状态。", signal: `${data.suppliers.length} 条记录`, icon: Truck },
    { tab: "warehouses" as const, title: "仓库 / 库位", desc: "仓库、库区、库位容量、QA 状态和负责人。", signal: `${data.warehouses.length} 个库位`, icon: Warehouse },
    { tab: "tax-codes" as const, title: "税码", desc: "采购与发票协同使用的税码、税率和默认状态。", signal: `${data.taxCodes.length} 个税码`, icon: Tags },
    { tab: "payment-terms" as const, title: "付款条款", desc: "供应商协同和 AP 可见性使用的付款规则。", signal: `${data.paymentTerms.length} 个条款`, icon: FileSpreadsheet },
  ];

  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#f0f6ff" }}>
        <div className="text-sm font-semibold" style={{ color: A.label }}>基础资料控制范围</div>
        <p className="text-xs leading-5 mt-1" style={{ color: A.sub }}>
          基础资料只维护源头记录，为采购、库存、发票和 SRM 提供基础数据；供应商风险解释和交易处理仍回到对应业务工作台。
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
