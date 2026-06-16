import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from "lucide-react";
import { exportRowsToCsv } from "../../lib/data-export";
import {
  downloadCsvTemplate,
  parseCsvText,
  parseDateLike,
  parseNonNegativeNumber,
  parsePositiveNumber,
  parseInteger,
  validateRequiredFields,
  type CsvRow,
} from "../../lib/csv-import";
import { A, Card, Chip, Field, inputStyle, KpiCard, SectionHeader, SegmentedControl } from "../../components/ui";

type ImportTypeId = "supplierQuotes" | "supplierInvoices" | "supplierReconciliations" | "purchaseReturns" | "supplierCreditMemos" | "openingInventory" | "inventoryMovements" | "inventoryExceptions" | "salesOrders" | "contractPrices" | "forecastDemand" | "customers" | "suppliers" | "itemMaster" | "warehouseBins" | "taxCodes" | "paymentTerms";
type ImportedRow = Record<string, unknown>;
type ValidationResult = {
  rowNumber: number;
  original: CsvRow;
  normalized: ImportedRow;
  errors: string[];
  warnings: string[];
};
type ImportBatch = {
  batchId: string;
  importType: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  appliedRows: number;
  appliedAt: string;
  status: string;
  operator: string;
};
type ImportConfig = {
  id: ImportTypeId;
  label: string;
  module: string;
  description: string;
  templateFilename: string;
  requiredFields: string[];
  optionalFields: string[];
  sampleRows: Record<string, unknown>[];
  notes: string[];
  validateRow: (row: CsvRow, allRows: CsvRow[]) => Omit<ValidationResult, "rowNumber" | "original">;
};
type ImportsPanelProps = {
  onNavigate?: (moduleId: string) => void;
  initialView?: "templates" | "validation" | "failed";
};

const FILTERS = ["全部", "采购", "库存", "销售", "预测", "主数据"] as const;

function value(row: CsvRow, key: string) {
  return String(row[key] ?? "").trim();
}

function emailWarning(email: string, label = "邮箱") {
  return email && !email.includes("@") ? [`${label}格式可能不正确`] : [];
}

function duplicateWarnings(rows: CsvRow[], current: CsvRow, keyFn: (row: CsvRow) => string, message: string) {
  const key = keyFn(current);
  if (!key) return [];
  return rows.filter((row) => keyFn(row) === key).length > 1 ? [message] : [];
}

function parseOptionalNonNegative(row: CsvRow, field: string, errors: string[]) {
  const raw = value(row, field);
  if (!raw) return "";
  const parsed = parseNonNegativeNumber(raw);
  if (parsed == null) errors.push(`${field}必须为非负数`);
  return parsed ?? raw;
}

function baseErrors(row: CsvRow, requiredFields: string[]) {
  const missing = validateRequiredFields(row, requiredFields);
  return missing.length ? [`缺少必填字段：${missing.join("、")}`] : [];
}

const IMPORT_CONFIGS: ImportConfig[] = [
  {
    id: "supplierQuotes",
    label: "供应商报价导入",
    module: "采购",
    description: "收集 RFQ 供应商报价，用于比价、授标和报价规范复核。",
    templateFilename: "supplier-quotes-template.csv",
    requiredFields: ["RFQ编号", "供应商", "SKU", "品名", "报价单价", "MOQ", "交期天数", "币种", "有效期至"],
    optionalFields: ["付款条款", "备注"],
    sampleRows: [
      { RFQ编号: "RFQ-26-0042", 供应商: "江苏铝合金集团", SKU: "SKU-00287", 品名: "铝合金型材 6063", 报价单价: 18.6, MOQ: 500, 交期天数: 12, 币种: "CNY", 有效期至: "2026-06-30", 付款条款: "Net 45", 备注: "含税含运" },
      { RFQ编号: "RFQ-26-0044", 供应商: "深圳新元电气", SKU: "SKU-00623", 品名: "控制器主板 V3.2", 报价单价: 11800, MOQ: 20, 交期天数: 18, 币种: "CNY", 有效期至: "2026-07-15", 付款条款: "Net 30", 备注: "" },
    ],
    notes: ["适用于 RFQ 后收集供应商 Excel 报价。", "导入后形成校验批次记录，RFQ 回写需通过后续审批流程。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["RFQ编号", "供应商", "SKU", "品名", "报价单价", "MOQ", "交期天数", "有效期至"]);
      const price = parsePositiveNumber(value(row, "报价单价"));
      const moq = parseNonNegativeNumber(value(row, "MOQ"));
      const leadTime = parseInteger(value(row, "交期天数"));
      if (price == null) errors.push("报价单价必须大于 0");
      if (moq == null) errors.push("MOQ必须为非负数");
      if (leadTime == null || leadTime <= 0) errors.push("交期天数必须为正整数");
      const warnings = duplicateWarnings(rows, row, (item) => `${value(item, "供应商")}::${value(item, "SKU")}`, "存在重复供应商+SKU报价");
      return {
        normalized: {
          RFQ编号: value(row, "RFQ编号"),
          供应商: value(row, "供应商"),
          SKU: value(row, "SKU"),
          品名: value(row, "品名"),
          报价单价: price ?? value(row, "报价单价"),
          MOQ: moq ?? value(row, "MOQ"),
          交期天数: leadTime ?? value(row, "交期天数"),
          币种: value(row, "币种") || "CNY",
          有效期至: parseDateLike(value(row, "有效期至")) || "",
          付款条款: value(row, "付款条款"),
          备注: value(row, "备注"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "supplierInvoices",
    label: "供应商发票导入",
    module: "采购",
    description: "上传供应商发票，用于发票台账、PO/GRN 关联与三单匹配预检。",
    templateFilename: "supplier-invoices-template.csv",
    requiredFields: ["发票号码", "供应商", "PO", "发票日期", "接收日期", "到期日", "未税金额", "税额", "总额", "付款条款"],
    optionalFields: ["GRN", "币种", "运费", "来源", "匹配状态", "发票状态", "差异类型", "差异金额", "AP负责人", "已过账应付", "已付款", "备注"],
    sampleRows: [
      { 发票号码: "INV-IMPORT-001", 供应商: "深圳新元电气", PO: "PO-2026-1283", GRN: "GRN-202605-0422", 发票日期: "2026-05-20", 接收日期: "2026-05-20", 到期日: "2026-06-19", 币种: "CNY", 未税金额: 118000, 税额: 15340, 运费: 0, 总额: 133340, 付款条款: "Net 30", 来源: "supplier-portal", 匹配状态: "未匹配", 发票状态: "待匹配", 差异类型: "无差异", 差异金额: 0, AP负责人: "赵敏", 已过账应付: "否", 已付款: "否", 备注: "" },
      { 发票号码: "INV-IMPORT-002", 供应商: "江苏铝合金集团", PO: "PO-2026-1285", GRN: "", 发票日期: "2026-05-21", 接收日期: "2026-05-21", 到期日: "2026-07-05", 币种: "CNY", 未税金额: 198000, 税额: 25740, 运费: 0, 总额: 223740, 付款条款: "Net 45", 来源: "email-upload", 匹配状态: "人工复核", 发票状态: "待匹配", 差异类型: "缺少收货", 差异金额: 223740, AP负责人: "赵敏", 已过账应付: "否", 已付款: "否", 备注: "待收货匹配" },
    ],
    notes: ["适用于供应商门户、邮件上传或 EDI 发票。", "当前执行 CSV 校验和批次预览，AP 过账或付款需在应付流程中处理。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["发票号码", "供应商", "PO", "发票日期", "接收日期", "到期日", "未税金额", "税额", "总额", "付款条款"]);
      const subtotal = parseNonNegativeNumber(value(row, "未税金额"));
      const tax = parseNonNegativeNumber(value(row, "税额"));
      const freight = value(row, "运费") ? parseNonNegativeNumber(value(row, "运费")) : 0;
      const total = parseNonNegativeNumber(value(row, "总额"));
      if (subtotal == null) errors.push("未税金额必须为非负数");
      if (tax == null) errors.push("税额必须为非负数");
      if (freight == null) errors.push("运费必须为非负数");
      if (total == null) errors.push("总额必须为非负数");
      if (!parseDateLike(value(row, "发票日期"))) errors.push("发票日期格式不正确");
      if (!parseDateLike(value(row, "接收日期"))) errors.push("接收日期格式不正确");
      if (!parseDateLike(value(row, "到期日"))) errors.push("到期日格式不正确");
      const warnings = duplicateWarnings(rows, row, (item) => `${value(item, "供应商")}::${value(item, "发票号码")}`, "存在重复供应商+发票号码");
      if (typeof subtotal === "number" && typeof tax === "number" && typeof freight === "number" && typeof total === "number") {
        const expectedTotal = subtotal + tax + freight;
        if (Math.abs(expectedTotal - total) > Math.max(1, total * 0.01)) warnings.push("总额与未税金额+税额+运费存在差异");
      }
      return {
        normalized: {
          发票号码: value(row, "发票号码"),
          供应商: value(row, "供应商"),
          PO: value(row, "PO"),
          GRN: value(row, "GRN"),
          发票日期: parseDateLike(value(row, "发票日期")) || value(row, "发票日期"),
          接收日期: parseDateLike(value(row, "接收日期")) || value(row, "接收日期"),
          到期日: parseDateLike(value(row, "到期日")) || value(row, "到期日"),
          币种: value(row, "币种") || "CNY",
          未税金额: subtotal ?? value(row, "未税金额"),
          税额: tax ?? value(row, "税额"),
          运费: freight ?? value(row, "运费"),
          总额: total ?? value(row, "总额"),
          付款条款: value(row, "付款条款"),
          来源: value(row, "来源") || "manual-entry",
          匹配状态: value(row, "匹配状态") || "未匹配",
          发票状态: value(row, "发票状态") || "待匹配",
          差异类型: value(row, "差异类型") || "无差异",
          差异金额: parseOptionalNonNegative(row, "差异金额", errors),
          AP负责人: value(row, "AP负责人"),
          已过账应付: value(row, "已过账应付") || "否",
          已付款: value(row, "已付款") || "否",
          备注: value(row, "备注"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "supplierReconciliations",
    label: "供应商对账单导入",
    module: "采购",
    description: "上传供应商对账单，用于按供应商和期间复核发票、应付、付款和差异状态。",
    templateFilename: "supplier-reconciliation-template.csv",
    requiredFields: ["对账单号", "供应商", "期间开始", "期间结束", "应付金额", "已付金额", "状态", "结算状态"],
    optionalFields: ["币种", "调整金额", "差异金额", "未结余额", "逾期金额", "发票数", "异常数", "负责人", "来源", "备注"],
    sampleRows: [
      { 对账单号: "REC-IMPORT-001", 供应商: "深圳新元电气", 期间开始: "2026-05-01", 期间结束: "2026-05-31", 应付金额: 1455000, 已付金额: 0, 状态: "存在差异", 结算状态: "未结算", 币种: "CNY", 调整金额: 8600, 差异金额: 28600, 未结余额: 1446400, 逾期金额: 0, 发票数: 2, 异常数: 1, 负责人: "赵敏", 来源: "supplier-confirmation", 备注: "待供应商确认运费差异" },
      { 对账单号: "REC-IMPORT-002", 供应商: "佛山标准件", 期间开始: "2026-05-01", 期间结束: "2026-05-31", 应付金额: 928200, 已付金额: 928200, 状态: "已确认", 结算状态: "已结算", 币种: "CNY", 调整金额: 0, 差异金额: 0, 未结余额: 0, 逾期金额: 0, 发票数: 1, 异常数: 0, 负责人: "赵敏", 来源: "system-generated", 备注: "" },
    ],
    notes: ["供应商对账单导入执行校验与预览，AP 过账或付款需在应付流程中处理。", "未结余额建议约等于应付金额 - 已付金额 - 调整金额。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["对账单号", "供应商", "期间开始", "期间结束", "应付金额", "已付金额", "状态", "结算状态"]);
      const payable = parseNonNegativeNumber(value(row, "应付金额"));
      const paid = parseNonNegativeNumber(value(row, "已付金额"));
      const adjustment = value(row, "调整金额") ? parseNonNegativeNumber(value(row, "调整金额")) : 0;
      const variance = value(row, "差异金额") ? parseNonNegativeNumber(value(row, "差异金额")) : 0;
      const openBalance = value(row, "未结余额") ? parseNonNegativeNumber(value(row, "未结余额")) : undefined;
      const overdue = value(row, "逾期金额") ? parseNonNegativeNumber(value(row, "逾期金额")) : 0;
      const invoiceCount = value(row, "发票数") ? parseInteger(value(row, "发票数")) : "";
      const exceptionCount = value(row, "异常数") ? parseInteger(value(row, "异常数")) : "";
      const supportedStatuses = ["草稿", "待确认", "存在差异", "已确认", "已驳回", "已关闭"];
      const supportedSettlementStatuses = ["未结算", "部分结算", "已结算"];
      if (payable == null) errors.push("应付金额必须为非负数");
      if (paid == null) errors.push("已付金额必须为非负数");
      if (adjustment == null) errors.push("调整金额必须为非负数");
      if (variance == null) errors.push("差异金额必须为非负数");
      if (openBalance == null && value(row, "未结余额")) errors.push("未结余额必须为非负数");
      if (overdue == null) errors.push("逾期金额必须为非负数");
      if (typeof invoiceCount === "number" && invoiceCount < 0) errors.push("发票数必须为非负整数");
      if (typeof exceptionCount === "number" && exceptionCount < 0) errors.push("异常数必须为非负整数");
      if (!parseDateLike(value(row, "期间开始"))) errors.push("期间开始格式不正确");
      if (!parseDateLike(value(row, "期间结束"))) errors.push("期间结束格式不正确");
      if (!supportedStatuses.includes(value(row, "状态"))) errors.push("状态必须为支持的供应商对账状态");
      if (!supportedSettlementStatuses.includes(value(row, "结算状态"))) errors.push("结算状态必须为 未结算 / 部分结算 / 已结算");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "对账单号"), "存在重复对账单号");
      if (typeof payable === "number" && typeof paid === "number" && typeof adjustment === "number" && typeof openBalance === "number") {
        const expectedOpen = Math.max(0, payable - paid - adjustment);
        if (Math.abs(expectedOpen - openBalance) > Math.max(1, payable * 0.01)) warnings.push("未结余额与应付金额-已付金额-调整金额存在差异");
      }
      return {
        normalized: {
          对账单号: value(row, "对账单号"),
          供应商: value(row, "供应商"),
          期间开始: parseDateLike(value(row, "期间开始")) || value(row, "期间开始"),
          期间结束: parseDateLike(value(row, "期间结束")) || value(row, "期间结束"),
          币种: value(row, "币种") || "CNY",
          应付金额: payable ?? value(row, "应付金额"),
          已付金额: paid ?? value(row, "已付金额"),
          调整金额: adjustment ?? value(row, "调整金额"),
          差异金额: variance ?? value(row, "差异金额"),
          未结余额: openBalance ?? value(row, "未结余额"),
          逾期金额: overdue ?? value(row, "逾期金额"),
          发票数: invoiceCount,
          异常数: exceptionCount,
          状态: value(row, "状态"),
          结算状态: value(row, "结算状态"),
          负责人: value(row, "负责人"),
          来源: value(row, "来源") || "manual-review",
          备注: value(row, "备注"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "purchaseReturns",
    label: "采购退货导入",
    module: "采购",
    description: "上传采购退货单，用于 GRN 拒收、发票差异、退货原因和贷项状态预览。",
    templateFilename: "purchase-returns-template.csv",
    requiredFields: ["退货单号", "供应商", "PO", "GRN", "退货日期", "原因", "退货数量", "退货金额", "状态"],
    optionalFields: ["发票", "仓库", "币种", "税额", "总额", "贷项通知", "来源", "负责人", "备注"],
    sampleRows: [
      { 退货单号: "RTV-IMPORT-001", 供应商: "广州化工耗材", PO: "PO-2026-1282", GRN: "GRN-202605-0419", 退货日期: "2026-06-03", 原因: "质检拒收", 退货数量: 2, 退货金额: 42000, 状态: "待贷项", 发票: "INV-GZ-260419", 仓库: "C 区", 币种: "CNY", 税额: 4831.86, 总额: 42000, 贷项通知: "", 来源: "receiving-qc", 负责人: "周浩", 备注: "等待供应商贷项" },
      { 退货单号: "RTV-IMPORT-002", 供应商: "江苏铝合金集团", PO: "PO-2026-1285", GRN: "GRN-202605-0420", 退货日期: "2026-06-03", 原因: "价格差异", 退货数量: 0, 退货金额: 32000, 状态: "已生成贷项", 发票: "INV-JS-260420", 仓库: "B 区", 币种: "CNY", 税额: 3681.42, 总额: 32000, 贷项通知: "CM-JS-2026-0531", 来源: "invoice-variance", 负责人: "王志强", 备注: "价格差异冲减" },
    ],
    notes: ["采购退货导入执行校验与预览，库存影响需通过退货异常处理确认。", "贷项通知字段用于关联供应商贷项通知和应付冲减状态。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["退货单号", "供应商", "PO", "GRN", "退货日期", "原因", "退货数量", "退货金额", "状态"]);
      const qty = parseNonNegativeNumber(value(row, "退货数量"));
      const amount = parseNonNegativeNumber(value(row, "退货金额"));
      const tax = value(row, "税额") ? parseNonNegativeNumber(value(row, "税额")) : 0;
      const total = value(row, "总额") ? parseNonNegativeNumber(value(row, "总额")) : amount;
      const supportedStatuses = ["草稿", "待审批", "已审批", "已退货", "待贷项", "已生成贷项", "已关闭", "已驳回"];
      const supportedReasons = ["质检拒收", "数量差异", "价格差异", "错发物料", "运输损坏", "重复发票", "合同条款差异", "其他"];
      if (qty == null) errors.push("退货数量必须为非负数");
      if (amount == null) errors.push("退货金额必须为非负数");
      if (tax == null) errors.push("税额必须为非负数");
      if (total == null) errors.push("总额必须为非负数");
      if (!parseDateLike(value(row, "退货日期"))) errors.push("退货日期格式不正确");
      if (!supportedStatuses.includes(value(row, "状态"))) errors.push("状态必须为支持的采购退货状态");
      if (!supportedReasons.includes(value(row, "原因"))) errors.push("原因应为支持的采购退货原因");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "退货单号"), "存在重复退货单号");
      return {
        normalized: {
          退货单号: value(row, "退货单号"),
          供应商: value(row, "供应商"),
          PO: value(row, "PO"),
          GRN: value(row, "GRN"),
          发票: value(row, "发票"),
          退货日期: parseDateLike(value(row, "退货日期")) || value(row, "退货日期"),
          原因: value(row, "原因"),
          退货数量: qty ?? value(row, "退货数量"),
          退货金额: amount ?? value(row, "退货金额"),
          仓库: value(row, "仓库"),
          币种: value(row, "币种") || "CNY",
          税额: tax ?? value(row, "税额"),
          总额: total ?? value(row, "总额"),
          贷项通知: value(row, "贷项通知"),
          状态: value(row, "状态"),
          来源: value(row, "来源") || "manual-review",
          负责人: value(row, "负责人"),
          备注: value(row, "备注"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "supplierCreditMemos",
    label: "供应商贷项通知导入",
    module: "采购",
    description: "上传供应商贷项通知，用于关联退货、发票差异和应付冲减状态预览。",
    templateFilename: "supplier-credit-memos-template.csv",
    requiredFields: ["贷项编号", "供应商", "关联退货", "贷项金额", "状态"],
    optionalFields: ["关联发票", "PO", "GRN", "开具日期", "接收日期", "币种", "税额", "应付冲减状态", "对账单", "负责人", "来源", "备注"],
    sampleRows: [
      { 贷项编号: "CM-IMPORT-001", 供应商: "深圳新元电气", 关联退货: "RTV-2026-0502", 贷项金额: 8600, 状态: "已确认", 关联发票: "INV-SZ-260422", PO: "PO-2026-1283", GRN: "GRN-202605-0422", 开具日期: "2026-06-03", 接收日期: "2026-06-03", 币种: "CNY", 税额: 989.38, 应付冲减状态: "待冲减", 对账单: "REC-2026-05-SZ-001", 负责人: "赵敏", 来源: "supplier-issued", 备注: "合同外运费贷项" },
      { 贷项编号: "CM-IMPORT-002", 供应商: "广州化工耗材", 关联退货: "RTV-2026-0506", 贷项金额: 18000, 状态: "已驳回", 关联发票: "INV-GZ-260419", PO: "PO-2026-1282", GRN: "GRN-202605-0419", 开具日期: "2026-06-03", 接收日期: "2026-06-03", 币种: "CNY", 税额: 2070.8, 应付冲减状态: "未冲减", 对账单: "REC-2026-05-GZ-001", 负责人: "赵敏", 来源: "supplier-issued", 备注: "供应商争议中" },
    ],
    notes: ["供应商贷项通知导入执行校验与预览，应付冲减需在 AP 流程中确认。", "应付冲减状态用于 AP 和供应商对账影响复核。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["贷项编号", "供应商", "关联退货", "贷项金额", "状态"]);
      const amount = parseNonNegativeNumber(value(row, "贷项金额"));
      const tax = value(row, "税额") ? parseNonNegativeNumber(value(row, "税额")) : 0;
      const supportedStatuses = ["草稿", "待确认", "已确认", "已冲减应付", "已关闭", "已驳回"];
      if (amount == null) errors.push("贷项金额必须为非负数");
      if (tax == null) errors.push("税额必须为非负数");
      if (value(row, "开具日期") && !parseDateLike(value(row, "开具日期"))) errors.push("开具日期格式不正确");
      if (value(row, "接收日期") && !parseDateLike(value(row, "接收日期"))) errors.push("接收日期格式不正确");
      if (!supportedStatuses.includes(value(row, "状态"))) errors.push("状态必须为支持的供应商贷项通知状态");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "贷项编号"), "存在重复贷项编号");
      return {
        normalized: {
          贷项编号: value(row, "贷项编号"),
          供应商: value(row, "供应商"),
          关联退货: value(row, "关联退货"),
          关联发票: value(row, "关联发票"),
          PO: value(row, "PO"),
          GRN: value(row, "GRN"),
          开具日期: parseDateLike(value(row, "开具日期")) || value(row, "开具日期"),
          接收日期: parseDateLike(value(row, "接收日期")) || value(row, "接收日期"),
          币种: value(row, "币种") || "CNY",
          税额: tax ?? value(row, "税额"),
          贷项金额: amount ?? value(row, "贷项金额"),
          状态: value(row, "状态"),
          应付冲减状态: value(row, "应付冲减状态") || "未冲减",
          对账单: value(row, "对账单"),
          负责人: value(row, "负责人"),
          来源: value(row, "来源") || "supplier-issued",
          备注: value(row, "备注"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "openingInventory",
    label: "库存期初数量导入",
    module: "库存",
    description: "批量导入期初库存、库位、批次与安全库存。",
    templateFilename: "opening-inventory-template.csv",
    requiredFields: ["SKU", "品名", "仓库", "库位", "期初数量", "单位"],
    optionalFields: ["批次号", "序列号", "安全库存", "最大库存", "供应商", "备注"],
    sampleRows: [
      { SKU: "SKU-00412", 品名: "伺服电机 750W", 仓库: "上海总仓", 库位: "D-02-01", 期初数量: 34, 单位: "台", 批次号: "LOT-OPEN-001", 序列号: "", 安全库存: 50, 最大库存: 200, 供应商: "深圳新元电气", 备注: "上线盘点" },
      { SKU: "SKU-00287", 品名: "铝合金型材 6063", 仓库: "上海总仓", 库位: "B-01-05", 期初数量: 148, 单位: "米", 批次号: "LOT-OPEN-002", 安全库存: 300, 最大库存: 2000, 供应商: "江苏铝合金集团", 备注: "" },
    ],
    notes: ["用于 go-live 期初库存迁移。", "导入后形成批次记录，库存生效由库存流程复核。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["SKU", "品名", "仓库", "库位", "期初数量", "单位"]);
      const qty = parseNonNegativeNumber(value(row, "期初数量"));
      const safety = parseOptionalNonNegative(row, "安全库存", errors);
      const max = parseOptionalNonNegative(row, "最大库存", errors);
      if (qty == null) errors.push("期初数量必须为非负数");
      if (typeof safety === "number" && typeof max === "number" && max < safety) errors.push("最大库存必须大于或等于安全库存");
      const warnings = duplicateWarnings(rows, row, (item) => `${value(item, "SKU")}::${value(item, "仓库")}::${value(item, "库位")}`, "存在重复SKU+仓库+库位");
      return {
        normalized: { SKU: value(row, "SKU"), 品名: value(row, "品名"), 仓库: value(row, "仓库"), 库位: value(row, "库位"), 期初数量: qty ?? value(row, "期初数量"), 单位: value(row, "单位"), 批次号: value(row, "批次号"), 序列号: value(row, "序列号"), 安全库存: safety, 最大库存: max, 供应商: value(row, "供应商"), 备注: value(row, "备注") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "inventoryMovements",
    label: "库存事务流水导入",
    module: "库存",
    description: "上传库存移动、来源单据、数量影响和复核状态，用于库存事务流水预览。",
    templateFilename: "inventory-movement-ledger-template.csv",
    requiredFields: ["单据号", "类型", "日期", "SKU", "品名", "仓库", "库位", "来源单据", "单位", "状态"],
    optionalFields: ["关联PO", "关联GRN", "关联退货", "关联销售订单", "入库", "出库", "调整", "负责人", "原因", "库存影响", "关联证据"],
    sampleRows: [
      { 单据号: "IM-IMPORT-001", 类型: "采购入库", 日期: "2026-06-01", SKU: "SKU-00558", 品名: "不锈钢螺栓 M8×30", 仓库: "上海总仓", 库位: "A-07-22", 来源单据: "GRN-202606-0101", 关联PO: "PO-2026-1301", 关联GRN: "GRN-202606-0101", 入库: 5000, 出库: 0, 调整: 0, 单位: "件", 状态: "已确认", 负责人: "刘建华", 原因: "采购入库", 库存影响: "可用库存增加 5,000 件", 关联证据: "GRN/PO" },
      { 单据号: "IM-IMPORT-002", 类型: "盘点差异", 日期: "2026-06-01", SKU: "SKU-00412", 品名: "伺服电机 750W", 仓库: "上海总仓", 库位: "D-02-01", 来源单据: "CC-2026-W22-D1", 入库: 0, 出库: 0, 调整: -1, 单位: "台", 状态: "待复核", 负责人: "刘建华", 原因: "账实差异", 库存影响: "账面库存减少 1 台", 关联证据: "盘点计划" },
    ],
    notes: ["导入用于库存事务流水预览和批次复核。", "库存生效、审批关闭和异常处理由库存业务流程确认。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["单据号", "类型", "日期", "SKU", "品名", "仓库", "库位", "来源单据", "单位", "状态"]);
      const quantityIn = value(row, "入库") ? parseNonNegativeNumber(value(row, "入库")) : 0;
      const quantityOut = value(row, "出库") ? parseNonNegativeNumber(value(row, "出库")) : 0;
      const adjustmentRaw = value(row, "调整");
      const adjustment = adjustmentRaw ? Number(adjustmentRaw) : 0;
      if (quantityIn == null) errors.push("入库必须为非负数");
      if (quantityOut == null) errors.push("出库必须为非负数");
      if (adjustmentRaw && Number.isNaN(adjustment)) errors.push("调整必须为数字");
      if ((Number(quantityIn || 0) + Number(quantityOut || 0) + Math.abs(Number(adjustment || 0))) === 0) errors.push("入库、出库或调整至少填写一项");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "单据号"), "存在重复库存移动单据号");
      return {
        normalized: { 单据号: value(row, "单据号"), 类型: value(row, "类型"), 日期: value(row, "日期"), SKU: value(row, "SKU"), 品名: value(row, "品名"), 仓库: value(row, "仓库"), 库位: value(row, "库位"), 来源单据: value(row, "来源单据"), 关联PO: value(row, "关联PO"), 关联GRN: value(row, "关联GRN"), 关联退货: value(row, "关联退货"), 关联销售订单: value(row, "关联销售订单"), 入库: quantityIn ?? value(row, "入库"), 出库: quantityOut ?? value(row, "出库"), 调整: adjustment, 单位: value(row, "单位"), 状态: value(row, "状态"), 负责人: value(row, "负责人"), 原因: value(row, "原因"), 库存影响: value(row, "库存影响"), 关联证据: value(row, "关联证据") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "inventoryExceptions",
    label: "库存异常单据导入",
    module: "库存",
    description: "批量导入库存调整、调拨差异、盘点差异关闭和冻结/释放异常单据。",
    templateFilename: "inventory-exception-documents-template.csv",
    requiredFields: ["单据编号", "类型", "SKU", "品名", "仓库", "库位", "数量影响", "状态"],
    optionalFields: ["负责人", "关联流水", "关联单据", "原因", "下一步"],
    sampleRows: [
      { 单据编号: "IEX-IMPORT-001", 类型: "库存调整", SKU: "SKU-00412", 品名: "伺服电机 750W", 仓库: "上海总仓", 库位: "D-02-01", 数量影响: -1, 状态: "待复核", 负责人: "刘建华", 关联流水: "IM-20260527-0007", 关联单据: "ADJ-2026-0527-001", 原因: "盘点差异", 下一步: "复核差异原因" },
    ],
    notes: ["库存异常单据导入用于校验异常处理证据，不会直接调整库存数量。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["单据编号", "类型", "SKU", "品名", "仓库", "库位", "数量影响", "状态"]);
      const qty = Number(value(row, "数量影响"));
      if (Number.isNaN(qty)) errors.push("数量影响必须为数字");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "单据编号"), "存在重复异常单据编号");
      return {
        normalized: {
          单据编号: value(row, "单据编号"),
          类型: value(row, "类型"),
          SKU: value(row, "SKU"),
          品名: value(row, "品名"),
          仓库: value(row, "仓库"),
          库位: value(row, "库位"),
          数量影响: Number.isNaN(qty) ? value(row, "数量影响") : qty,
          状态: value(row, "状态"),
          负责人: value(row, "负责人"),
          关联流水: value(row, "关联流水"),
          关联单据: value(row, "关联单据"),
          原因: value(row, "原因"),
          下一步: value(row, "下一步"),
        },
        errors,
        warnings,
      };
    },
  },
  {
    id: "salesOrders",
    label: "销售订单导入",
    module: "销售",
    description: "上传离线客户订单，预览金额、状态和交付需求。",
    templateFilename: "sales-orders-template.csv",
    requiredFields: ["订单号", "客户", "SKU", "品名", "数量", "单价", "需求日期"],
    optionalFields: ["状态", "销售负责人", "交付地址", "客户信用等级", "备注"],
    sampleRows: [
      { 订单号: "SO-IMPORT-001", 客户: "华东工业集团", SKU: "SKU-00412", 品名: "伺服电机 750W", 数量: 8, 单价: 2980, 需求日期: "2026-06-15", 状态: "草稿", 销售负责人: "张磊", 交付地址: "上海", 客户信用等级: "A", 备注: "" },
      { 订单号: "SO-IMPORT-002", 客户: "京海科技", SKU: "SKU-00623", 品名: "控制器主板 V3.2", 数量: 3, 单价: 12400, 需求日期: "2026-06-18", 状态: "", 销售负责人: "陈晨", 交付地址: "北京", 客户信用等级: "A", 备注: "线下订单" },
    ],
    notes: ["适合导入客户邮件或 Excel 订单。", "导入后形成批次预览，销售订单创建需在销售流程中确认。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["订单号", "客户", "SKU", "品名", "数量", "单价", "需求日期"]);
      const qty = parsePositiveNumber(value(row, "数量"));
      const price = parseNonNegativeNumber(value(row, "单价"));
      if (qty == null) errors.push("数量必须大于 0");
      if (price == null) errors.push("单价必须为非负数");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "订单号"), "存在重复订单号");
      return {
        normalized: { 订单号: value(row, "订单号"), 客户: value(row, "客户"), SKU: value(row, "SKU"), 品名: value(row, "品名"), 数量: qty ?? value(row, "数量"), 单价: price ?? value(row, "单价"), 金额: qty != null && price != null ? qty * price : "", 需求日期: value(row, "需求日期"), 状态: value(row, "状态") || "草稿", 销售负责人: value(row, "销售负责人"), 交付地址: value(row, "交付地址"), 客户信用等级: value(row, "客户信用等级"), 备注: value(row, "备注") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "contractPrices",
    label: "采购合同价格导入",
    module: "采购",
    description: "上传 BPA/合同价目表，校验价格、MOQ 与有效期。",
    templateFilename: "contract-prices-template.csv",
    requiredFields: ["合同编号", "供应商", "SKU", "品名", "合同单价", "币种", "生效日期", "到期日期"],
    optionalFields: ["MOQ", "承诺量", "价格条款", "备注"],
    sampleRows: [
      { 合同编号: "BPA-26-001", 供应商: "深圳新元电气", SKU: "SKU-00623", 品名: "控制器主板 V3.2", 合同单价: 11800, 币种: "CNY", 生效日期: "2026-01-01", 到期日期: "2026-12-31", MOQ: 20, 承诺量: 12000, 价格条款: "目录价 -14%", 备注: "" },
      { 合同编号: "BPA-26-002", 供应商: "江苏铝合金集团", SKU: "SKU-00287", 品名: "铝合金型材 6063", 合同单价: 18.6, 币种: "CNY", 生效日期: "2026-03-01", 到期日期: "2027-02-28", MOQ: 500, 承诺量: 2400, 价格条款: "RMB 18.60/kg", 备注: "" },
    ],
    notes: ["适用于年度框架协议价目表。", "框架协议变更需在合同流程中确认。"],
    validateRow: (row) => {
      const errors = baseErrors(row, ["合同编号", "供应商", "SKU", "品名", "合同单价", "生效日期", "到期日期"]);
      const price = parsePositiveNumber(value(row, "合同单价"));
      const moq = parseOptionalNonNegative(row, "MOQ", errors);
      const committed = parseOptionalNonNegative(row, "承诺量", errors);
      if (price == null) errors.push("合同单价必须大于 0");
      return {
        normalized: { 合同编号: value(row, "合同编号"), 供应商: value(row, "供应商"), SKU: value(row, "SKU"), 品名: value(row, "品名"), 合同单价: price ?? value(row, "合同单价"), 币种: value(row, "币种") || "CNY", 生效日期: value(row, "生效日期"), 到期日期: value(row, "到期日期"), MOQ: moq, 承诺量: committed, 价格条款: value(row, "价格条款"), 备注: value(row, "备注") },
        errors,
        warnings: [],
      };
    },
  },
  {
    id: "forecastDemand",
    label: "预测需求导入",
    module: "预测",
    description: "上传 SKU 月度历史需求，为预测计划准备历史需求数据。",
    templateFilename: "forecast-demand-template.csv",
    requiredFields: ["SKU", "品名", "月份", "需求量"],
    optionalFields: ["来源", "备注"],
    sampleRows: [
      { SKU: "SKU-00412", 品名: "伺服电机 750W", 月份: "2026-01", 需求量: 132, 来源: "销售历史", 备注: "" },
      { SKU: "SKU-00412", 品名: "伺服电机 750W", 月份: "2026-02", 需求量: 145, 来源: "销售历史", 备注: "" },
    ],
    notes: ["可先整理需求历史，再到 Forecast 模块输入区域运行模型。", "本页不会直接修改 ForecastPanel state。"],
    validateRow: (row) => {
      const errors = baseErrors(row, ["SKU", "品名", "月份", "需求量"]);
      const demand = parseNonNegativeNumber(value(row, "需求量"));
      if (demand == null) errors.push("需求量必须为非负数");
      return {
        normalized: { SKU: value(row, "SKU"), 品名: value(row, "品名"), 月份: value(row, "月份"), 需求量: demand ?? value(row, "需求量"), 来源: value(row, "来源"), 备注: value(row, "备注") },
        errors,
        warnings: [],
      };
    },
  },
  {
    id: "customers",
    label: "客户主数据导入",
    module: "主数据",
    description: "校验预览客户编码、联系人、邮箱、信用等级与付款条款。",
    templateFilename: "customers-template.csv",
    requiredFields: ["客户编号", "客户名称", "联系人", "联系邮箱"],
    optionalFields: ["信用等级", "付款条款", "地区", "备注"],
    sampleRows: [
      { 客户编号: "C-2001", 客户名称: "华东工业集团", 联系人: "王经理", 联系邮箱: "wang@example.com", 信用等级: "A", 付款条款: "Net 60", 地区: "华东", 备注: "" },
    ],
    notes: ["主数据导入形成校验预览和批次记录。"],
    validateRow: (row) => {
      const errors = baseErrors(row, ["客户编号", "客户名称", "联系人", "联系邮箱"]);
      return {
        normalized: { 客户编号: value(row, "客户编号"), 客户名称: value(row, "客户名称"), 联系人: value(row, "联系人"), 联系邮箱: value(row, "联系邮箱"), 信用等级: value(row, "信用等级"), 付款条款: value(row, "付款条款"), 地区: value(row, "地区"), 备注: value(row, "备注") },
        errors,
        warnings: emailWarning(value(row, "联系邮箱"), "联系邮箱"),
      };
    },
  },
  {
    id: "suppliers",
    label: "供应商主数据导入",
    module: "主数据",
    description: "校验预览供应商编码、品类、联系人、邮箱和绩效指标。",
    templateFilename: "suppliers-template.csv",
    requiredFields: ["供应商编号", "供应商名称", "品类", "联系人", "联系邮箱"],
    optionalFields: ["评级", "准时率", "质量合格率", "付款条款", "备注"],
    sampleRows: [
      { 供应商编号: "S-3001", 供应商名称: "深圳新元电气", 品类: "电气元件", 联系人: "李工", 联系邮箱: "li@example.com", 评级: "A", 准时率: 96.8, 质量合格率: 99.2, 付款条款: "Net 30", 备注: "" },
    ],
    notes: ["供应商主数据导入用于主数据校验预览，绩效口径由供应商管理流程维护。"],
    validateRow: (row) => {
      const errors = baseErrors(row, ["供应商编号", "供应商名称", "品类", "联系人", "联系邮箱"]);
      const warnings = emailWarning(value(row, "联系邮箱"), "联系邮箱");
      const ontime = parseOptionalNonNegative(row, "准时率", errors);
      const quality = parseOptionalNonNegative(row, "质量合格率", errors);
      if (typeof ontime === "number" && ontime > 100) errors.push("准时率必须在 0-100 之间");
      if (typeof quality === "number" && quality > 100) errors.push("质量合格率必须在 0-100 之间");
      return {
        normalized: { 供应商编号: value(row, "供应商编号"), 供应商名称: value(row, "供应商名称"), 品类: value(row, "品类"), 联系人: value(row, "联系人"), 联系邮箱: value(row, "联系邮箱"), 评级: value(row, "评级"), 准时率: ontime, 质量合格率: quality, 付款条款: value(row, "付款条款"), 备注: value(row, "备注") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "itemMaster",
    label: "物料主数据导入",
    module: "主数据",
    description: "校验预览 SKU、物料分类、默认仓库库位、补货参数、管理标识和默认税码。",
    templateFilename: "item-master-template.csv",
    requiredFields: ["SKU", "物料名称", "物料分类", "单位", "默认仓库", "默认库位", "默认供应商", "默认税码"],
    optionalFields: ["规格型号", "安全库存", "最大库存", "ROP", "采购提前期", "批次管理", "序列号管理", "质检要求", "状态"],
    sampleRows: [
      { SKU: "SKU-01188", 物料名称: "工业传感器 M12", 物料分类: "电气元件", 规格型号: "M12 / PNP", 单位: "件", 默认仓库: "上海总仓", 默认库位: "D-04-01", 安全库存: 50, 最大库存: 300, ROP: 80, 采购提前期: 14, 批次管理: "是", 序列号管理: "是", 质检要求: "是", 默认供应商: "深圳新元电气", 默认税码: "VAT13-IN", 状态: "启用" },
    ],
    notes: ["物料主数据是采购、库存、MRP 和发票税拆分的基础。", "默认税码缺失会影响供应商发票税额拆分复核。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["SKU", "物料名称", "物料分类", "单位", "默认仓库", "默认库位", "默认供应商", "默认税码"]);
      const safety = parseOptionalNonNegative(row, "安全库存", errors);
      const max = parseOptionalNonNegative(row, "最大库存", errors);
      const rop = parseOptionalNonNegative(row, "ROP", errors);
      const leadTime = value(row, "采购提前期") ? parseInteger(value(row, "采购提前期")) : "";
      if (value(row, "采购提前期") && (leadTime === "" || Number(leadTime) < 0)) errors.push("采购提前期必须为非负整数");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "SKU"), "存在重复 SKU");
      return {
        normalized: { SKU: value(row, "SKU"), 物料名称: value(row, "物料名称"), 物料分类: value(row, "物料分类"), 规格型号: value(row, "规格型号"), 单位: value(row, "单位"), 默认仓库: value(row, "默认仓库"), 默认库位: value(row, "默认库位"), 安全库存: safety, 最大库存: max, ROP: rop, 采购提前期: leadTime, 批次管理: value(row, "批次管理") || "否", 序列号管理: value(row, "序列号管理") || "否", 质检要求: value(row, "质检要求") || "否", 默认供应商: value(row, "默认供应商"), 默认税码: value(row, "默认税码"), 状态: value(row, "状态") || "启用" },
        errors,
        warnings,
      };
    },
  },
  {
    id: "warehouseBins",
    label: "仓库库位导入",
    module: "主数据",
    description: "校验预览仓库、库区、库位、容量、利用率、温控要求和 QA 状态。",
    templateFilename: "warehouse-bins-template.csv",
    requiredFields: ["仓库编码", "仓库名称", "库区", "库位", "容量", "负责人"],
    optionalFields: ["利用率", "温控要求", "QA状态", "可用"],
    sampleRows: [
      { 仓库编码: "WH-SH-01", 仓库名称: "上海总仓", 库区: "D 区电气", 库位: "D-04-01", 容量: 300, 利用率: 0.32, 温控要求: "防静电", QA状态: "可用", 可用: "是", 负责人: "陈思远" },
    ],
    notes: ["仓库库位主数据用于收货、库存事务流水、盘点和库位地图。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["仓库编码", "仓库名称", "库区", "库位", "容量", "负责人"]);
      const capacity = parsePositiveNumber(value(row, "容量"));
      const utilization = value(row, "利用率") ? parseNonNegativeNumber(value(row, "利用率")) : "";
      if (capacity == null) errors.push("容量必须大于 0");
      if (typeof utilization === "number" && utilization > 1) errors.push("利用率建议使用 0-1 小数");
      const warnings = duplicateWarnings(rows, row, (item) => `${value(item, "仓库编码")}::${value(item, "库位")}`, "存在重复仓库+库位");
      return {
        normalized: { 仓库编码: value(row, "仓库编码"), 仓库名称: value(row, "仓库名称"), 库区: value(row, "库区"), 库位: value(row, "库位"), 容量: capacity ?? value(row, "容量"), 利用率: utilization, 温控要求: value(row, "温控要求"), QA状态: value(row, "QA状态") || "可用", 可用: value(row, "可用") || "是", 负责人: value(row, "负责人") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "taxCodes",
    label: "税码导入",
    module: "主数据",
    description: "校验预览税码、税码名称、税率、税种、区域、默认标识和状态。",
    templateFilename: "tax-codes-template.csv",
    requiredFields: ["税码", "税码名称", "税率", "税种", "区域"],
    optionalFields: ["默认", "状态", "描述"],
    sampleRows: [
      { 税码: "VAT13-IN", 税码名称: "进项税 13%", 税率: 0.13, 税种: "进项税", 区域: "中国大陆", 默认: "是", 状态: "启用", 描述: "标准采购物料进项税率" },
    ],
    notes: ["税码用于供应商发票、贷项通知和税额拆分可视化。", "模板用于税码主数据校验和发票税额拆分复核。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["税码", "税码名称", "税率", "税种", "区域"]);
      const rate = parseNonNegativeNumber(value(row, "税率"));
      if (rate == null || rate > 1) errors.push("税率必须为 0-1 小数");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "税码"), "存在重复税码");
      return {
        normalized: { 税码: value(row, "税码"), 税码名称: value(row, "税码名称"), 税率: rate ?? value(row, "税率"), 税种: value(row, "税种"), 区域: value(row, "区域"), 默认: value(row, "默认") || "否", 状态: value(row, "状态") || "启用", 描述: value(row, "描述") },
        errors,
        warnings,
      };
    },
  },
  {
    id: "paymentTerms",
    label: "付款条款导入",
    module: "主数据",
    description: "校验预览付款条款编码、净账期天数、折扣规则和到期规则。",
    templateFilename: "payment-terms-template.csv",
    requiredFields: ["条款编码", "条款名称", "净账期天数", "到期规则"],
    optionalFields: ["折扣规则", "状态", "描述"],
    sampleRows: [
      { 条款编码: "NET30", 条款名称: "Net 30", 净账期天数: 30, 折扣规则: "无现金折扣", 到期规则: "发票日期后 30 天到期", 状态: "启用", 描述: "标准供应商付款条款" },
    ],
    notes: ["付款条款用于供应商主数据、发票到期日和 AP 可视化。"],
    validateRow: (row, rows) => {
      const errors = baseErrors(row, ["条款编码", "条款名称", "净账期天数", "到期规则"]);
      const netDays = parseInteger(value(row, "净账期天数"));
      if (netDays == null || netDays < 0) errors.push("净账期天数必须为非负整数");
      const warnings = duplicateWarnings(rows, row, (item) => value(item, "条款编码"), "存在重复条款编码");
      return {
        normalized: { 条款编码: value(row, "条款编码"), 条款名称: value(row, "条款名称"), 净账期天数: netDays ?? value(row, "净账期天数"), 折扣规则: value(row, "折扣规则"), 到期规则: value(row, "到期规则"), 状态: value(row, "状态") || "启用", 描述: value(row, "描述") },
        errors,
        warnings,
      };
    },
  },
];

function createBatchId(index: number) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `IMP-${ymd}-${String(index + 1).padStart(3, "0")}`;
}

export default function ImportsPanel({ onNavigate, initialView }: ImportsPanelProps) {
  const [selectedId, setSelectedId] = useState<ImportTypeId>("supplierQuotes");
  const [moduleFilter, setModuleFilter] = useState<typeof FILTERS[number]>("全部");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [applied, setApplied] = useState<Record<ImportTypeId, ImportedRow[]>>({} as Record<ImportTypeId, ImportedRow[]>);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const sectionLabel = initialView === "templates"
    ? "模板管理"
    : initialView === "validation"
      ? "数据校验结果"
      : initialView === "failed"
        ? "失败行处理"
        : "导入任务记录";

  const visibleConfigs = moduleFilter === "全部" ? IMPORT_CONFIGS : IMPORT_CONFIGS.filter((config) => config.module === moduleFilter);
  const selected = IMPORT_CONFIGS.find((config) => config.id === selectedId) || IMPORT_CONFIGS[0];
  const validRows = results.filter((row) => row.errors.length === 0);
  const invalidRows = results.filter((row) => row.errors.length > 0);
  const warningRows = results.filter((row) => row.warnings.length > 0);
  const previewRows = (showErrorsOnly ? invalidRows : results).slice(0, 50);
  const appliedTotal = Object.values(applied).reduce((sum, rows) => sum + rows.length, 0);
  const groupedForecast = useMemo(() => {
    const rows = applied.forecastDemand || [];
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(String(row.SKU || "未识别"), (counts.get(String(row.SKU || "未识别")) || 0) + 1));
    return Array.from(counts.entries()).map(([sku, count]) => ({ sku, count }));
  }, [applied]);

  useEffect(() => {
    setShowErrorsOnly(initialView === "failed");
  }, [initialView]);

  function validateRows(rows: CsvRow[]) {
    setResults(rows.map((row, index) => {
      const result = selected.validateRow(row, rows);
      return { ...result, rowNumber: index + 2, original: row };
    }));
  }

  function resetUpload() {
    setFileName("");
    setParsedRows([]);
    setResults([]);
    setShowErrorsOnly(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = parseCsvText(text);
      setFileName(file.name);
      setParsedRows(rows);
      setShowErrorsOnly(false);
      setResults(rows.map((row, index) => ({ ...selected.validateRow(row, rows), rowNumber: index + 2, original: row })));
      toast.success(`${file.name} 已解析`, { description: `${rows.length} 行数据进入校验预览` });
    };
    reader.onerror = () => toast.error("CSV 文件读取失败");
    reader.readAsText(file, "utf-8");
  }

  function switchType(next: ImportTypeId) {
    setSelectedId(next);
    resetUpload();
  }

  function downloadTemplate() {
    const headers = [...selected.requiredFields, ...selected.optionalFields];
    downloadCsvTemplate(selected.templateFilename, headers, selected.sampleRows);
    toast.success("模板 CSV 已生成");
  }

  function exportInvalidRows() {
    exportRowsToCsv(`import-errors-${selected.id}.csv`, invalidRows.map((row) => ({
      ...row.original,
      错误原因: row.errors.join("；"),
      警告: row.warnings.join("；"),
    })));
    toast.success("错误行 CSV 已导出");
  }

  function exportValidRows() {
    exportRowsToCsv(`import-valid-${selected.id}.csv`, validRows.map((row) => ({
      ...row.normalized,
      警告: row.warnings.join("；"),
    })));
    toast.success("有效行 CSV 已导出");
  }

  function applyValidRows() {
    if (validRows.length === 0) {
      toast.warning("暂无可应用的有效数据");
      return;
    }
    const normalized = validRows.map((row) => row.normalized);
    setApplied((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] || []), ...normalized],
    }));
    setBatches((current) => [{
      batchId: createBatchId(current.length),
      importType: selected.label,
      fileName: fileName || "uploaded-csv",
      totalRows: parsedRows.length,
      validRows: validRows.length,
      warningRows: warningRows.length,
      errorRows: invalidRows.length,
      appliedRows: validRows.length,
      appliedAt: new Date().toLocaleString("zh-CN"),
      status: "已应用到导入工作区",
      operator: "当前用户",
    }, ...current]);
    toast.success("导入批次已应用", { description: `${validRows.length} 行有效数据已加入导入工作区` });
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#f0f6ff", color: A.blue }}>
                <Upload size={17} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>数据管理</h1>
                <p className="text-xs mt-0.5" style={{ color: A.sub }}>{sectionLabel} · 集中查看导入任务、模板、校验结果与失败行处理</p>
              </div>
            </div>
            <p className="text-xs leading-5 max-w-3xl" style={{ color: A.gray1 }}>
              业务数据导入可在对应业务页面发起；数据管理用于集中复核导入任务记录、模板管理、数据校验结果、失败行处理和导入历史。
            </p>
          </div>
          {onNavigate && (
            <button onClick={() => onNavigate("reports")}
              className="text-xs px-3 py-2 rounded-xl font-medium flex items-center gap-1.5"
              style={{ background: A.gray6, color: A.blue }}>
              <FileSpreadsheet size={13} /> 导入后查看标准报表
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <KpiCard label="模板管理" value={String(IMPORT_CONFIGS.length)} sub="CSV 模板" icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="导入任务" value={String(parsedRows.length)} sub={fileName || "等待校验"} icon={Upload} color={A.purple} />
        <KpiCard label="数据校验结果" value={String(validRows.length)} sub="有效行" icon={CheckCircle2} color={A.green} />
        <KpiCard label="失败行处理" value={String(invalidRows.length)} sub={`${warningRows.length} 行警告`} icon={AlertCircle} color={invalidRows.length ? A.red : A.orange} />
        <KpiCard label="已应用" value={String(appliedTotal)} sub={`${batches.length} 个批次`} icon={Database} color={A.teal} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <SectionHeader title={initialView === "templates" ? "模板管理" : "导入任务记录"} />
          <SegmentedControl
            options={FILTERS.map((item) => ({ label: item, value: item }))}
            value={moduleFilter}
            onChange={(value) => setModuleFilter(value as typeof FILTERS[number])}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {visibleConfigs.map((config) => (
            <button key={config.id} onClick={() => switchType(config.id)}
              className="text-left p-3 rounded-xl transition-all"
              style={{
                background: selected.id === config.id ? "#f0f6ff" : A.gray6,
                boxShadow: selected.id === config.id ? `0 0 0 1px ${A.blue}40` : "0 0 0 0.5px rgba(0,0,0,0.04)",
              }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate" style={{ color: selected.id === config.id ? A.blue : A.label }}>{config.label}</span>
                <Chip label={config.module} color={selected.id === config.id ? A.blue : A.gray1} bg={A.white} />
              </div>
              <div className="text-[10px] leading-4 mt-2" style={{ color: A.sub }}>{config.description}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-[0.9fr_1.1fr] gap-4">
        <Card className="p-5">
          <SectionHeader title="下载模板"
            right={<button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg"
              style={{ background: A.gray6, color: A.blue }}>
              <Download size={13} /> 下载模板 CSV
            </button>} />
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold" style={{ color: A.label }}>{selected.label}</div>
              <div className="text-[11px] leading-5 mt-1" style={{ color: A.sub }}>{selected.description}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="必填字段">
                <div className="min-h-20 rounded-xl p-2 text-[10px] leading-5" style={{ background: A.gray6, color: A.gray1 }}>
                  {selected.requiredFields.join("、")}
                </div>
              </Field>
              <Field label="可选字段">
                <div className="min-h-20 rounded-xl p-2 text-[10px] leading-5" style={{ background: A.gray6, color: A.gray1 }}>
                  {selected.optionalFields.join("、") || "—"}
                </div>
              </Field>
            </div>
            <div className="rounded-xl p-3" style={{ background: "#fff8f0" }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: A.orange }}>适用场景 / 注意事项</div>
              {selected.notes.map((note) => (
                <div key={note} className="text-[10px] leading-5" style={{ color: A.sub }}>· {note}</div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader title="导入任务校验"
            right={fileName ? <span className="text-[10px]" style={{ color: A.gray2 }}>{fileName}</span> : null} />
          <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: A.gray6, border: "1px dashed rgba(0,0,0,0.14)" }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: A.white, color: A.blue }}>
              <Upload size={18} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: A.label }}>选择 CSV 文件</div>
              <div className="text-[11px] mt-1" style={{ color: A.sub }}>支持 UTF-8 / 带 BOM CSV、英文逗号、引号包裹字段和 CRLF/LF。</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="text-xs px-3 py-2 rounded-xl font-medium text-white" style={{ background: A.blue }}>
              选择文件
            </button>
            <button onClick={resetUpload}
              className="text-xs px-3 py-2 rounded-xl font-medium" style={{ background: A.white, color: A.gray1 }}>
              清空
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            {[
              ["总行数", parsedRows.length, A.label],
              ["有效", validRows.length, A.green],
              ["警告", warningRows.length, A.orange],
              ["错误", invalidRows.length, A.red],
            ].map(([label, count, color]) => (
              <div key={String(label)} className="rounded-lg p-2" style={{ background: A.gray6 }}>
                <div className="text-[9px]" style={{ color: A.gray2 }}>{label}</div>
                <div className="text-sm font-semibold tabular-nums" style={{ color: String(color) }}>{String(count)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>数据校验结果</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>展示前 50 行数据校验结果；失败行不会进入导入批次。</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowErrorsOnly((value) => !value)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ background: showErrorsOnly ? "#fff1f0" : A.gray6, color: showErrorsOnly ? A.red : A.gray1 }}>
              仅显示错误行
            </button>
            <button onClick={exportInvalidRows} disabled={invalidRows.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:cursor-not-allowed"
              style={{ background: invalidRows.length ? "#fff1f0" : A.gray5, color: invalidRows.length ? A.red : A.gray2 }}>
              导出错误行 CSV
            </button>
            <button onClick={exportValidRows} disabled={validRows.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:cursor-not-allowed"
              style={{ background: validRows.length ? "#f0faf4" : A.gray5, color: validRows.length ? A.green : A.gray2 }}>
              导出有效行 CSV
            </button>
            <button onClick={applyValidRows} disabled={validRows.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:cursor-not-allowed"
              style={{ background: validRows.length ? A.blue : A.gray3 }}>
              应用到工作区
            </button>
          </div>
        </div>
        {results.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: A.gray2 }}>请先下载模板并上传 CSV，或选择已有模板编辑后重新上传。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  {["行号", "状态", ...selected.requiredFields.slice(0, 5), "错误 / 警告"].map((header) => (
                    <th key={header} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: A.gray1 }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => {
                  const hasError = row.errors.length > 0;
                  return (
                    <tr key={row.rowNumber} style={{ background: hasError ? "#fff1f0" : "transparent", borderBottom: "0.5px solid rgba(0,0,0,0.04)" }}>
                      <td className="px-4 py-3 tabular-nums" style={{ color: A.gray1 }}>{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        <Chip label={hasError ? "错误" : row.warnings.length ? "警告" : "有效"} color={hasError ? A.red : row.warnings.length ? A.orange : A.green} bg={hasError ? "#fff1f0" : row.warnings.length ? "#fff8f0" : "#f0faf4"} />
                      </td>
                      {selected.requiredFields.slice(0, 5).map((field) => (
                        <td key={field} className="px-4 py-3 whitespace-nowrap" style={{ color: A.label }}>{String(row.normalized[field] ?? row.original[field] ?? "")}</td>
                      ))}
                      <td className="px-4 py-3 min-w-[260px]" style={{ color: hasError ? A.red : A.orange }}>
                        {[...row.errors, ...row.warnings].join("；") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <SectionHeader title="模板应用统计" />
          <div className="space-y-2">
            {IMPORT_CONFIGS.map((config) => (
              <div key={config.id} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: A.gray6 }}>
                <div>
                  <div className="text-xs font-medium" style={{ color: A.label }}>{config.label}</div>
                  <div className="text-[10px]" style={{ color: A.gray2 }}>{config.module}</div>
                </div>
                <div className="text-sm font-semibold tabular-nums" style={{ color: (applied[config.id] || []).length ? A.green : A.gray2 }}>
                  {(applied[config.id] || []).length}
                </div>
              </div>
            ))}
          </div>
          {groupedForecast.length > 0 && (
            <div className="mt-3 rounded-xl p-3" style={{ background: "#f0f6ff" }}>
              <div className="text-[11px] font-semibold" style={{ color: A.blue }}>预测需求导入 SKU 汇总</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {groupedForecast.map((item) => <Chip key={item.sku} label={`${item.sku} · ${item.count} 月`} color={A.blue} bg={A.white} />)}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionHeader title="导入任务记录"
            right={<span className="text-[10px]" style={{ color: A.gray2 }}>当前会话</span>} />
          {batches.length === 0 ? (
            <div className="text-xs py-8 text-center" style={{ color: A.gray2 }}>尚未应用任何导入批次。</div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {batches.map((batch) => (
                <div key={batch.batchId} className="rounded-xl p-3" style={{ background: A.gray6 }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold" style={{ color: A.blue }}>{batch.batchId}</div>
                    <Chip label={batch.status} color={A.green} bg="#f0faf4" />
                  </div>
                  <div className="text-[10px] mt-1" style={{ color: A.sub }}>{batch.importType} · {batch.fileName}</div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
                    <span style={{ color: A.gray1 }}>总 {batch.totalRows}</span>
                    <span style={{ color: A.green }}>有效 {batch.validRows}</span>
                    <span style={{ color: A.orange }}>警告 {batch.warningRows}</span>
                    <span style={{ color: A.red }}>错误 {batch.errorRows}</span>
                  </div>
                  <div className="text-[10px] mt-2" style={{ color: A.gray2 }}>{batch.appliedAt} · {batch.operator}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader title="校验规则" right={<RefreshCw size={13} style={{ color: A.gray2 }} />} />
        <div className="grid grid-cols-3 gap-3 text-[11px] leading-5">
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>工作区批次：</span>应用后显示在当前导入工作区，便于复核批次、文件和行数。
          </div>
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>透明校验：</span>必填、数字范围、邮箱格式和简单重复项会在预览中展示。
          </div>
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>流程衔接：</span>批次确认后可进入审批、审计、回滚和字段映射治理流程。
          </div>
        </div>
      </Card>
    </div>
  );
}
