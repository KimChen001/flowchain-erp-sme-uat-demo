import { useMemo, useRef, useState } from "react";
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

type ImportTypeId = "supplierQuotes" | "openingInventory" | "salesOrders" | "contractPrices" | "forecastDemand" | "customers" | "suppliers";
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
    description: "收集 RFQ 供应商报价，用于演示比价与报价规范。",
    templateFilename: "supplier-quotes-template.csv",
    requiredFields: ["RFQ编号", "供应商", "SKU", "品名", "报价单价", "MOQ", "交期天数", "币种", "有效期至"],
    optionalFields: ["付款条款", "备注"],
    sampleRows: [
      { RFQ编号: "RFQ-26-0042", 供应商: "江苏铝合金集团", SKU: "SKU-00287", 品名: "铝合金型材 6063", 报价单价: 18.6, MOQ: 500, 交期天数: 12, 币种: "CNY", 有效期至: "2026-06-30", 付款条款: "Net 45", 备注: "含税含运" },
      { RFQ编号: "RFQ-26-0044", 供应商: "深圳新元电气", SKU: "SKU-00623", 品名: "控制器主板 V3.2", 报价单价: 11800, MOQ: 20, 交期天数: 18, 币种: "CNY", 有效期至: "2026-07-15", 付款条款: "Net 30", 备注: "" },
    ],
    notes: ["适用于 RFQ 后收集供应商 Excel 报价。", "本轮只暂存为 demo 导入记录，不回写 RFQ。"],
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
    notes: ["用于 go-live 期初库存迁移。", "不会修改全局库存样例或后端数据库。"],
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
    notes: ["适合导入客户邮件或 Excel 订单。", "不会写入 Sales 模块 state，当前仅本页 demo 暂存。"],
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
    notes: ["适用于年度框架协议价目表。", "本轮不修改 CONTRACTS demo data。"],
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
    description: "上传 SKU 月度历史需求，为预测演示准备数据。",
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
    description: "低风险本地预览客户编码、联系人、邮箱、信用等级与付款条款。",
    templateFilename: "customers-template.csv",
    requiredFields: ["客户编号", "客户名称", "联系人", "联系邮箱"],
    optionalFields: ["信用等级", "付款条款", "地区", "备注"],
    sampleRows: [
      { 客户编号: "C-2001", 客户名称: "华东工业集团", 联系人: "王经理", 联系邮箱: "wang@example.com", 信用等级: "A", 付款条款: "Net 60", 地区: "华东", 备注: "" },
    ],
    notes: ["主数据导入目前只做本地预览和批次记录。"],
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
    description: "低风险本地预览供应商编码、品类、联系人、邮箱和绩效指标。",
    templateFilename: "suppliers-template.csv",
    requiredFields: ["供应商编号", "供应商名称", "品类", "联系人", "联系邮箱"],
    optionalFields: ["评级", "准时率", "质量合格率", "付款条款", "备注"],
    sampleRows: [
      { 供应商编号: "S-3001", 供应商名称: "深圳新元电气", 品类: "电气元件", 联系人: "李工", 联系邮箱: "li@example.com", 评级: "A", 准时率: 96.8, 质量合格率: 99.2, 付款条款: "Net 30", 备注: "" },
    ],
    notes: ["供应商主数据不会回写供应商绩效页面或后端。"],
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
];

function createBatchId(index: number) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `IMP-${ymd}-${String(index + 1).padStart(3, "0")}`;
}

export default function ImportsPanel({ onNavigate }: ImportsPanelProps) {
  const [selectedId, setSelectedId] = useState<ImportTypeId>("supplierQuotes");
  const [moduleFilter, setModuleFilter] = useState<typeof FILTERS[number]>("全部");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [applied, setApplied] = useState<Record<ImportTypeId, ImportedRow[]>>({} as Record<ImportTypeId, ImportedRow[]>);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
      status: "已暂存为演示数据",
      operator: "当前用户",
    }, ...current]);
    toast.success("已暂存为演示导入记录", { description: `${validRows.length} 行有效数据已写入浏览器本地状态` });
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
                <h1 className="text-xl font-semibold tracking-tight" style={{ color: A.label }}>导入中心</h1>
                <p className="text-xs mt-0.5" style={{ color: A.sub }}>下载标准模板、上传 CSV、预览校验结果，并暂存为演示数据</p>
              </div>
            </div>
            <p className="text-xs leading-5 max-w-3xl" style={{ color: A.gray1 }}>
              当前导入只写入浏览器内的演示状态，不会修改后端数据库。未来版本可扩展为审批、审计、持久化和回滚。
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
        <KpiCard label="支持模板" value={String(IMPORT_CONFIGS.length)} sub="CSV 导入 v1" icon={FileSpreadsheet} color={A.blue} />
        <KpiCard label="上传行数" value={String(parsedRows.length)} sub={fileName || "等待上传"} icon={Upload} color={A.purple} />
        <KpiCard label="有效行" value={String(validRows.length)} sub="可暂存为演示数据" icon={CheckCircle2} color={A.green} />
        <KpiCard label="错误行" value={String(invalidRows.length)} sub={`${warningRows.length} 行警告`} icon={AlertCircle} color={invalidRows.length ? A.red : A.orange} />
        <KpiCard label="已应用" value={String(appliedTotal)} sub={`${batches.length} 个批次`} icon={Database} color={A.teal} />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <SectionHeader title="导入类型" />
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
          <SectionHeader title="模板下载"
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
          <SectionHeader title="上传 CSV"
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
            <h2 className="text-sm font-semibold" style={{ color: A.label }}>Preview & validation</h2>
            <p className="text-[11px] mt-0.5" style={{ color: A.sub }}>展示前 50 行解析结果；错误行不会写入演示状态。</p>
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
              暂存为演示数据
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
          <SectionHeader title="已导入演示记录" />
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
          <SectionHeader title="导入批次记录"
            right={<span className="text-[10px]" style={{ color: A.gray2 }}>刷新页面后清空</span>} />
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
        <SectionHeader title="Import notes" right={<RefreshCw size={13} style={{ color: A.gray2 }} />} />
        <div className="grid grid-cols-3 gap-3 text-[11px] leading-5">
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>本地演示状态：</span>应用后只保存在当前浏览器页面状态，刷新即丢失。
          </div>
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>透明校验：</span>必填、数字范围、邮箱格式和简单重复项会在预览中展示。
          </div>
          <div className="rounded-xl p-3" style={{ background: A.gray6, color: A.sub }}>
            <span className="font-semibold" style={{ color: A.label }}>未来扩展：</span>后端批次、审批、审计、回滚、自定义字段映射和持久化均不在本轮范围。
          </div>
        </div>
      </Card>
    </div>
  );
}
