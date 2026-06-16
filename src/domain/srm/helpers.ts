import {
  CONTRACTS,
  PORTAL_SUPPLIERS,
  PURCHASE_RETURNS,
  RFQS,
  SUPPLIER_CREDIT_MEMOS,
  SUPPLIER_INVOICES,
  SUPPLIER_RECONCILIATION_STATEMENTS,
  purchaseOrders,
  receivingDocs,
} from "../../data/demo-data";
import { SUPPLIER_MASTER } from "../../data/master-data";
import { fmt } from "../../lib/format";

export type SupplierSrmRow = ReturnType<typeof buildSrmSupplierRows>[number];

export function buildSrmSupplierRows() {
  return SUPPLIER_MASTER.map((supplier) => {
    const portal = PORTAL_SUPPLIERS.find((item) => item.name === supplier.name);
    const pos = purchaseOrders.filter((order) => order.supplier === supplier.name);
    const openPoCount = pos.filter((order) => !["已完成", "已取消", "已驳回"].includes(order.status)).length;
    const grns = receivingDocs.filter((doc) => doc.supplier === supplier.name);
    const rfqs = RFQS.filter((rfq) => rfq.bestSupplier === supplier.name);
    const contracts = CONTRACTS.filter((contract) => contract.supplier === supplier.name);
    const invoices = SUPPLIER_INVOICES.filter((invoice) => invoice.supplier === supplier.name);
    const invoiceVarianceCount = invoices.filter((invoice) => invoice.varianceType !== "无差异" || ["人工复核", "差异待处理"].includes(invoice.matchStatus)).length;
    const credits = SUPPLIER_CREDIT_MEMOS.filter((memo) => memo.supplier === supplier.name);
    const reconciliation = SUPPLIER_RECONCILIATION_STATEMENTS.find((statement) => statement.supplier === supplier.name);
    const returns = PURCHASE_RETURNS.filter((item) => item.supplier === supplier.name);
    const reconciliationException = reconciliation ? reconciliation.totalVarianceAmount > 0 || reconciliation.overdueAmount > 0 || ["存在差异", "已驳回", "待确认"].includes(reconciliation.status) : false;
    const riskScore = supplier.riskStatus === "高" ? 86 : supplier.certificationStatus !== "已认证" ? 72 : invoiceVarianceCount > 0 || reconciliationException ? 66 : 42;
    const nextAction = supplier.certificationStatus !== "已认证"
      ? "复核认证资料"
      : supplier.riskStatus === "高"
        ? "制定整改计划"
        : invoiceVarianceCount > 0 || reconciliationException
          ? "复核发票与对账差异"
          : contracts.some((contract) => contract.status === "即将到期" || contract.status === "已到期")
            ? "复核合同覆盖"
            : "持续监控";
    return {
      supplier,
      portal,
      category: supplier.category,
      rating: portal?.rating ?? supplier.rating,
      onTimeRate: portal?.onTime ?? supplier.onTimeRate,
      qualityRate: portal?.quality ?? supplier.qualityRate,
      responseScore: portal?.resp ?? Math.round((supplier.onTimeRate + supplier.qualityRate) / 2),
      flag: portal?.flag ?? (supplier.riskStatus === "高" ? "整改" : supplier.rating >= 4.5 ? "战略" : "核心"),
      openPoCount,
      poCount: pos.length,
      grnExceptionCount: grns.filter((doc) => doc.status === "异常处理" || doc.failed > 0).length,
      rfqCount: rfqs.length,
      activeRfqCount: rfqs.filter((rfq) => ["进行中", "比价中"].includes(rfq.status)).length,
      contractCount: contracts.length,
      activeContractCount: contracts.filter((contract) => contract.status !== "已到期").length,
      invoiceVarianceCount,
      creditMemoAmount: credits.reduce((sum, memo) => sum + memo.totalCredit, 0),
      returnCount: returns.length,
      reconciliation,
      reconciliationException,
      riskScore,
      nextAction,
    };
  }).sort((a, b) => b.riskScore - a.riskScore || b.openPoCount - a.openPoCount);
}

export function srmKpis(rows = buildSrmSupplierRows()) {
  return {
    totalSuppliers: rows.length,
    highRiskSuppliers: rows.filter((row) => row.supplier.riskStatus === "高" || row.flag === "整改").length,
    certificationReview: rows.filter((row) => row.supplier.certificationStatus !== "已认证").length,
    openRfqs: RFQS.filter((rfq) => ["进行中", "比价中"].includes(rfq.status)).length,
    reconciliationOrInvoiceExceptions: rows.filter((row) => row.invoiceVarianceCount > 0 || row.reconciliationException).length,
  };
}

export function srmReportRows() {
  return buildSrmSupplierRows().map((row) => ({
    供应商编码: row.supplier.code,
    供应商: row.supplier.name,
    品类: row.category,
    评级: row.rating,
    准时率: row.onTimeRate,
    质量合格率: row.qualityRate,
    响应分: row.responseScore,
    风险状态: row.supplier.riskStatus,
    认证状态: row.supplier.certificationStatus,
    开放PO: row.openPoCount,
    RFx参与: row.rfqCount,
    合同覆盖: row.activeContractCount,
    发票差异: row.invoiceVarianceCount,
    对账异常: row.reconciliationException ? "是" : "否",
    贷项金额: row.creditMemoAmount,
    下一步: row.nextAction,
  }));
}

export function supplierRiskReportRows() {
  return buildSrmSupplierRows().map((row) => ({
    供应商: row.supplier.name,
    风险状态: row.supplier.riskStatus,
    SRM风险分: row.riskScore,
    战略分级: row.flag,
    准时率: row.onTimeRate,
    质量合格率: row.qualityRate,
    收货异常: row.grnExceptionCount,
    发票差异: row.invoiceVarianceCount,
    对账状态: row.reconciliation?.status || "待生成",
    风险说明: `${row.supplier.riskStatus}风险 · ${row.nextAction}`,
  }));
}

export function supplierCertificationReportRows() {
  return buildSrmSupplierRows().map((row) => ({
    供应商编码: row.supplier.code,
    供应商: row.supplier.name,
    品类: row.category,
    认证状态: row.supplier.certificationStatus,
    主数据状态: row.supplier.status,
    联系人: row.supplier.contact,
    邮箱: row.supplier.email,
    付款条款: row.supplier.paymentTerms,
    默认税码: row.supplier.defaultTaxCode,
    下一步: row.supplier.certificationStatus === "已认证" ? "年度复核" : row.nextAction,
  }));
}

export function supplierDetailEvidence(row: SupplierSrmRow) {
  return [
    { label: "相关 PO", value: `${row.poCount} 单 / 开放 ${row.openPoCount}` },
    { label: "RFx 参与", value: `${row.rfqCount} 次 / 开放 ${row.activeRfqCount}` },
    { label: "合同覆盖", value: `${row.activeContractCount}/${row.contractCount}` },
    { label: "发票差异", value: row.invoiceVarianceCount },
    { label: "贷项金额", value: fmt(row.creditMemoAmount) },
    { label: "对账状态", value: row.reconciliation?.status || "待生成" },
    { label: "收货异常", value: row.grnExceptionCount },
    { label: "下一步", value: row.nextAction },
  ];
}
