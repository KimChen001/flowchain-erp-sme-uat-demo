import { A, Chip } from "../../components/ui";
import {
  tableMinLgClass,
  tableMinMdClass,
  tableMinSmClass,
  tableMinXlClass,
  tableScrollClass,
  tdActionClass,
  tdIdClass,
  tdNameClass,
  tdNowrapClass,
  tdNumericClass,
  thClass,
} from "../../components/ui/workbenchTable";
import type { ItemMaster, PaymentTerm, SupplierMaster, TaxCode, WarehouseBin } from "../../types/scm";
import type { DetailRecord } from "./MasterDataDetailModal";
import type { MasterDataTableTab } from "./Page";
import { BusinessEntityLink } from "../../components/business/BusinessEntityLink";

function statusStyle(status: string) {
  if (["启用", "已认证", "可用"].includes(status)) return { color: A.green, bg: "#f0faf4" };
  if (["停用", "冻结", "高"].includes(status)) return { color: A.red, bg: "#fff1f0" };
  return { color: A.orange, bg: "#fff8f0" };
}

function BoolText({ value }: { value: boolean }) {
  return <span style={{ color: value ? A.green : A.gray2 }}>{value ? "是" : "否"}</span>;
}

export default function MasterDataTables({
  tab,
  items,
  suppliers,
  warehouses,
  taxCodes,
  paymentTerms,
  onDetail,
}: {
  tab: MasterDataTableTab;
  items: ItemMaster[];
  suppliers: SupplierMaster[];
  warehouses: WarehouseBin[];
  taxCodes: TaxCode[];
  paymentTerms: PaymentTerm[];
  onDetail: (detail: DetailRecord) => void;
}) {
  if (tab === "items") {
    return (
      <div className={tableScrollClass}>
        <table className={tableMinXlClass}>
          <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["SKU", "物料名称", "物料分类", "单位", "默认仓库", "默认库位", "ROP", "默认供应商", "默认税码", "批次", "序列", "质检", "状态", "操作"].map((h) => <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
          <tbody>{items.map((item, index) => {
            const style = statusStyle(item.status);
            return (
              <tr key={item.sku} style={{ borderBottom: index < items.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className={tdIdClass}><BusinessEntityLink entityType="item" entityId={item.sku}>{item.sku}</BusinessEntityLink></td>
                <td className={`${tdNameClass} max-w-[220px] truncate font-medium`} style={{ color: A.label }}>{item.name}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.category}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.unit}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.defaultWarehouse}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.defaultBin}</td>
                <td className={`${tdNumericClass} font-medium`} style={{ color: A.label }}>{item.reorderPoint.toLocaleString()}</td>
                <td className={`${tdNameClass} max-w-[180px] truncate`} style={{ color: A.sub }}>{item.defaultSupplier}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.defaultTaxCode}</td>
                <td className={tdNowrapClass}><BoolText value={item.batchManaged} /></td>
                <td className={tdNowrapClass}><BoolText value={item.serialManaged} /></td>
                <td className={tdNowrapClass}><BoolText value={item.qaRequired} /></td>
                <td className={tdNowrapClass}><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                <td className={tdActionClass}><button onClick={() => onDetail({ type: "items", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  if (tab === "suppliers") {
    return (
      <div className={tableScrollClass}>
        <table className={tableMinXlClass}>
          <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["供应商编码", "供应商名称", "品类", "联系人", "付款条款", "币种", "税号", "默认税码", "评级", "准时率", "质量合格率", "风险", "认证", "状态", "操作"].map((h) => <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
          <tbody>{suppliers.map((item, index) => {
            const style = statusStyle(item.status);
            const riskStyle = statusStyle(item.riskStatus);
            return (
              <tr key={item.code} style={{ borderBottom: index < suppliers.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className={tdIdClass}><BusinessEntityLink entityType="supplier" entityId={item.code}>{item.code}</BusinessEntityLink></td>
                <td className={`${tdNameClass} max-w-[180px] truncate font-medium`}><BusinessEntityLink entityType="supplier" entityId={item.code}>{item.name}</BusinessEntityLink></td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.category}</td>
                <td className={`${tdNameClass} max-w-[140px] truncate`} style={{ color: A.sub }}>{item.contact}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.paymentTerms}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.currency}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.taxId}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.defaultTaxCode}</td>
                <td className={`${tdNumericClass} font-medium`} style={{ color: A.label }}>{item.rating.toFixed(1)}</td>
                <td className={tdNumericClass} style={{ color: A.sub }}>{item.onTimeRate}%</td>
                <td className={tdNumericClass} style={{ color: A.sub }}>{item.qualityRate}%</td>
                <td className={tdNowrapClass}><Chip label={item.riskStatus} color={riskStyle.color} bg={riskStyle.bg} /></td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.certificationStatus}</td>
                <td className={tdNowrapClass}><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                <td className={tdActionClass}><button onClick={() => onDetail({ type: "suppliers", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  if (tab === "warehouses") {
    return (
      <div className={tableScrollClass}>
        <table className={tableMinMdClass}>
          <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["仓库编码", "仓库名称", "库区", "库位", "容量", "利用率", "温控要求", "QA状态", "可用", "负责人", "操作"].map((h) => <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
          <tbody>{warehouses.map((item, index) => {
            const style = statusStyle(item.qaStatus);
            return (
              <tr key={`${item.warehouseCode}-${item.bin}`} style={{ borderBottom: index < warehouses.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className={tdIdClass} style={{ color: A.blue }}>{item.warehouseCode}</td>
                <td className={`${tdNameClass} max-w-[180px] truncate font-medium`} style={{ color: A.label }}>{item.warehouseName}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.zone}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.bin}</td>
                <td className={tdNumericClass} style={{ color: A.sub }}>{item.capacity.toLocaleString()}</td>
                <td className={`${tdNumericClass} font-medium`} style={{ color: item.utilization > 0.85 ? A.red : A.label }}>{Math.round(item.utilization * 100)}%</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.temperatureRequirement}</td>
                <td className={tdNowrapClass}><Chip label={item.qaStatus} color={style.color} bg={style.bg} /></td>
                <td className={tdNowrapClass}><BoolText value={item.available} /></td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.owner}</td>
                <td className={tdActionClass}><button onClick={() => onDetail({ type: "warehouses", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  if (tab === "tax-codes") {
    return (
      <div className={tableScrollClass}>
        <table className={tableMinMdClass}>
          <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["税码", "税码名称", "税率", "税种", "区域", "默认", "状态", "描述", "操作"].map((h) => <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
          <tbody>{taxCodes.map((item, index) => {
            const style = statusStyle(item.status);
            return (
              <tr key={item.code} style={{ borderBottom: index < taxCodes.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
                <td className={tdIdClass} style={{ color: A.blue }}>{item.code}</td>
                <td className={`${tdNameClass} max-w-[180px] truncate font-medium`} style={{ color: A.label }}>{item.name}</td>
                <td className={tdNumericClass} style={{ color: A.sub }}>{Math.round(item.rate * 100)}%</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.type}</td>
                <td className={tdNowrapClass} style={{ color: A.sub }}>{item.region}</td>
                <td className={tdNowrapClass}><BoolText value={item.isDefault} /></td>
                <td className={tdNowrapClass}><Chip label={item.status} color={style.color} bg={style.bg} /></td>
                <td className="px-4 py-3 max-w-[320px] truncate" style={{ color: A.sub }}>{item.description}</td>
                <td className={tdActionClass}><button onClick={() => onDetail({ type: "tax-codes", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={tableScrollClass}>
      <table className={tableMinSmClass}>
        <thead><tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>{["条款编码", "条款名称", "净账期天数", "折扣规则", "到期规则", "状态", "描述", "操作"].map((h) => <th key={h} className={thClass} style={{ color: A.gray1 }}>{h}</th>)}</tr></thead>
        <tbody>{paymentTerms.map((item, index) => {
          const style = statusStyle(item.status);
          return (
            <tr key={item.code} style={{ borderBottom: index < paymentTerms.length - 1 ? "0.5px solid rgba(0,0,0,0.04)" : "none" }}>
              <td className={tdIdClass} style={{ color: A.blue }}>{item.code}</td>
              <td className={`${tdNameClass} max-w-[180px] truncate font-medium`} style={{ color: A.label }}>{item.name}</td>
              <td className={tdNumericClass} style={{ color: A.sub }}>{item.netDays}</td>
              <td className={tdNowrapClass} style={{ color: A.sub }}>{item.discountRule}</td>
              <td className={tdNowrapClass} style={{ color: A.sub }}>{item.dueDateRule}</td>
              <td className={tdNowrapClass}><Chip label={item.status} color={style.color} bg={style.bg} /></td>
              <td className="px-4 py-3 max-w-[360px] truncate" style={{ color: A.sub }}>{item.description}</td>
              <td className={tdActionClass}><button onClick={() => onDetail({ type: "payment-terms", item })} className="px-2 py-1 rounded-md font-medium" style={{ background: A.gray6, color: A.blue }}>详情</button></td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}
