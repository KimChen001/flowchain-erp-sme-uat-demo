import { toast } from "sonner";
import { exportRowsToCsv } from "../../lib/data-export";
import type { ItemMaster, PaymentTerm, SupplierMaster, TaxCode, WarehouseBin } from "../../types/scm";
import type { MasterDataTab, MasterDataTableTab } from "./Page";

export function exportMasterDataCsv(
  tab: MasterDataTab,
  data: {
    items: ItemMaster[];
    suppliers: SupplierMaster[];
    warehouses: WarehouseBin[];
    taxCodes: TaxCode[];
    paymentTerms: PaymentTerm[];
  }
) {
  const configs = {
    items: {
      filename: "master-data-items-export.csv",
      rows: data.items.map((item) => ({
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
      rows: data.suppliers.map((item) => ({
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
      rows: data.warehouses.map((item) => ({
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
      rows: data.taxCodes.map((item) => ({
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
      rows: data.paymentTerms.map((item) => ({
        条款编码: item.code,
        条款名称: item.name,
        净账期天数: item.netDays,
        折扣规则: item.discountRule,
        到期规则: item.dueDateRule,
        状态: item.status,
        描述: item.description,
      })),
    },
  } satisfies Record<MasterDataTableTab, { filename: string; rows: Record<string, unknown>[] }>;

  if (tab === "overview") {
    toast("请选择一个基础资料视图导出");
    return;
  }

  const current = configs[tab];
  exportRowsToCsv(current.filename, current.rows);
  toast.success("导出文件已生成");
}
