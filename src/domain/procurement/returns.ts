import type { DocumentTone } from "../../components/document/DocumentShell";
import type { PurchaseReturn, PurchaseReturnStatus, SupplierCreditMemo, SupplierCreditMemoStatus } from "../../types/scm";

export function getReturnStatusTone(status: PurchaseReturnStatus | string): DocumentTone {
  if (["已审批", "已退货", "已生成贷项", "已关闭"].includes(status)) return "success";
  if (["待审批", "待贷项", "草稿"].includes(status)) return "warning";
  if (status === "已驳回") return "danger";
  return "neutral";
}

export function getCreditMemoStatusTone(status: SupplierCreditMemoStatus | string): DocumentTone {
  if (["已确认", "已冲减应付", "已关闭"].includes(status)) return "success";
  if (["草稿", "待确认"].includes(status)) return "warning";
  if (status === "已驳回") return "danger";
  return "neutral";
}

function linkedCreditMemos(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[]) {
  return creditMemos.filter((memo) => memo.relatedReturn === returnDoc.returnNo || memo.id === returnDoc.creditMemoId || memo.creditMemoNo === returnDoc.creditMemoId);
}

export function calculateReturnFinancialImpact(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[]) {
  const confirmedCredit = linkedCreditMemos(returnDoc, creditMemos)
    .filter((memo) => ["已确认", "已冲减应付", "已关闭"].includes(memo.status))
    .reduce((sum, memo) => sum + memo.totalCredit, 0);
  return Math.max(0, Number((returnDoc.total - confirmedCredit).toFixed(2)));
}

export function isReturnException(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[] = []) {
  const missingCredit = ["已退货", "待贷项"].includes(returnDoc.status) && linkedCreditMemos(returnDoc, creditMemos).length === 0;
  return ["待审批", "待贷项", "已驳回"].includes(returnDoc.status) || missingCredit || calculateReturnFinancialImpact(returnDoc, creditMemos) > 0;
}

export function getReturnSummary(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[] = []) {
  const impact = calculateReturnFinancialImpact(returnDoc, creditMemos);
  if (returnDoc.status === "已驳回") return "供应商或审批已驳回，需补充证据或重新协商处理。";
  if (returnDoc.status === "待审批") return "退货/贷项处理待审批，暂不影响真实库存或会计分录。";
  if (returnDoc.status === "待贷项" || linkedCreditMemos(returnDoc, creditMemos).length === 0) return "已登记退货影响，需跟进供应商贷项通知。";
  if (impact > 0) return `仍有 ${impact.toLocaleString("zh-CN")} 未冲减金额，需 AP 或对账复核。`;
  return "退货与贷项样本已闭环，可进入 AP 或供应商对账复核。";
}

export function purchaseReturnExportRows(returns: PurchaseReturn[]) {
  return returns.map((row) => ({
    退货ID: row.id,
    退货单号: row.returnNo,
    供应商: row.supplier,
    PO: row.relatedPo,
    GRN: row.relatedGrn,
    发票: row.relatedInvoice || "",
    匹配结果: row.relatedMatchId || "",
    退货日期: row.returnDate,
    创建日期: row.createdDate,
    仓库: row.warehouse,
    原因: row.reason,
    状态: row.status,
    币种: row.currency,
    未税金额: row.subtotal,
    税额: row.tax,
    总额: row.total,
    退货数量: row.returnQty,
    贷项通知: row.creditMemoId || "",
    来源: row.source,
    负责人: row.owner,
    备注: row.notes || "",
  }));
}

export function purchaseReturnLineExportRows(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[] = []) {
  const linkedMemos = linkedCreditMemos(returnDoc, creditMemos);
  return [
    {
      section: "header",
      field: "退货单号",
      value: returnDoc.returnNo,
      供应商: returnDoc.supplier,
      PO: returnDoc.relatedPo,
      GRN: returnDoc.relatedGrn,
      发票: returnDoc.relatedInvoice || "",
      状态: returnDoc.status,
      原因: returnDoc.reason,
      退货总额: returnDoc.total,
      已确认贷项: linkedMemos.reduce((sum, memo) => sum + memo.totalCredit, 0),
      未冲减金额: calculateReturnFinancialImpact(returnDoc, creditMemos),
      备注: returnDoc.notes || "",
    },
    ...returnDoc.lines.map((line) => ({
      section: "line",
      field: line.lineId,
      value: `${line.sku} ${line.name}`,
      SKU: line.sku,
      品名: line.name,
      订购数量: line.orderedQty,
      收货数量: line.receivedQty,
      合格数量: line.acceptedQty,
      拒收数量: line.rejectedQty,
      退货数量: line.returnQty,
      单位: line.unit,
      单价: line.unitPrice,
      税率: line.taxRate,
      未税金额: line.returnAmount,
      税额: line.taxAmount,
      退货金额: line.totalAmount,
      原因: line.reason,
      PO行: line.relatedPoLine || "",
      GRN行: line.relatedGrnLine || "",
      发票行: line.relatedInvoiceLine || "",
      备注: line.notes || "",
    })),
  ];
}

export function creditMemoExportRows(creditMemos: SupplierCreditMemo[]) {
  return creditMemos.map((row) => ({
    贷项ID: row.id,
    贷项编号: row.creditMemoNo,
    供应商: row.supplier,
    关联退货: row.relatedReturn,
    关联发票: row.relatedInvoice || "",
    PO: row.relatedPo || "",
    GRN: row.relatedGrn || "",
    开具日期: row.issueDate,
    接收日期: row.receivedDate,
    币种: row.currency,
    未税金额: row.subtotal,
    税额: row.tax,
    贷项总额: row.totalCredit,
    状态: row.status,
    应付冲减状态: row.apOffsetStatus,
    对账单: row.reconciliationStatement || "",
    负责人: row.owner,
    来源: row.source,
    备注: row.notes || "",
  }));
}

export function returnExceptionRows(returns: PurchaseReturn[], creditMemos: SupplierCreditMemo[]) {
  const returnRows = returns
    .filter((row) => isReturnException(row, creditMemos))
    .map((row) => ({
      单据类型: "采购退货",
      单据号: row.returnNo,
      供应商: row.supplier,
      PO: row.relatedPo,
      GRN: row.relatedGrn,
      发票: row.relatedInvoice || "",
      异常类型: row.status === "已驳回" ? "已驳回" : row.status === "待贷项" ? "待贷项" : row.reason,
      金额影响: calculateReturnFinancialImpact(row, creditMemos),
      状态: row.status,
      建议动作: getReturnSummary(row, creditMemos),
    }));
  const memoRows = creditMemos
    .filter((memo) => ["待确认", "已驳回"].includes(memo.status))
    .map((memo) => ({
      单据类型: "供应商贷项通知",
      单据号: memo.creditMemoNo,
      供应商: memo.supplier,
      PO: memo.relatedPo || "",
      GRN: memo.relatedGrn || "",
      发票: memo.relatedInvoice || "",
      异常类型: memo.status,
      金额影响: memo.totalCredit,
      状态: memo.apOffsetStatus,
      建议动作: memo.status === "已驳回" ? "供应商贷项被驳回，需采购/AP复核原因。" : "贷项待确认，确认后可演示应付冲减。",
    }));
  return [...returnRows, ...memoRows];
}

export function returnToCockpitSignal(returnDoc: PurchaseReturn, creditMemos: SupplierCreditMemo[]) {
  return {
    title: "跟进退货贷项",
    description: `${returnDoc.returnNo} ${returnDoc.status === "待贷项" ? "已退货但未收到供应商贷项通知" : getReturnSummary(returnDoc, creditMemos)}`,
    amount: calculateReturnFinancialImpact(returnDoc, creditMemos),
    supplier: returnDoc.supplier,
  };
}
