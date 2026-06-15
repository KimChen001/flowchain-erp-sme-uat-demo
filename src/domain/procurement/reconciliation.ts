import type {
  SupplierReconciliationLine,
  SupplierReconciliationStatement,
  SupplierReconciliationStatus,
  SupplierSettlementStatus,
} from "../../types/scm";
import type { DocumentTone } from "../../components/document/DocumentShell";

export function calculateOpenBalance(statement: SupplierReconciliationStatement) {
  return Math.max(0, Number(statement.totalPayableAmount || 0) - Number(statement.totalPaidAmount || 0));
}

export function settlementStatusFor(payableAmount: number, paidAmount: number): SupplierSettlementStatus {
  const openBalance = Math.max(0, Number(payableAmount || 0) - Number(paidAmount || 0));
  if (openBalance <= 0) return "已结算";
  if (Number(paidAmount || 0) > 0) return "部分结算";
  return "未结算";
}

export function getReconciliationStatusTone(status: SupplierReconciliationStatus | SupplierSettlementStatus | string): DocumentTone {
  if (["已确认", "已关闭", "已结算"].includes(status)) return "success";
  if (["待确认", "部分结算"].includes(status)) return "warning";
  if (["存在差异", "已驳回", "未结算"].includes(status)) return "danger";
  return "neutral";
}

export function isStatementException(statement: SupplierReconciliationStatement) {
  return (
    statement.exceptionCount > 0 ||
    statement.totalVarianceAmount > 0 ||
    statement.overdueAmount > 0 ||
    statement.status === "存在差异" ||
    statement.status === "已驳回"
  );
}

export function getReconciliationSummary(statement: SupplierReconciliationStatement) {
  if (statement.status === "已驳回") return statement.rejectReason || "供应商确认被驳回，需要重新核对差异原因。";
  if (statement.totalVarianceAmount > 0) return `存在 ${statement.exceptionCount} 项差异，差异金额 ${statement.totalVarianceAmount.toLocaleString()}。`;
  if (statement.overdueAmount > 0) return `存在逾期应付 ${statement.overdueAmount.toLocaleString()}，建议 AP 复核付款计划。`;
  if (statement.openBalance > 0) return `仍有未结余额 ${statement.openBalance.toLocaleString()}，等待结算或供应商确认。`;
  return "发票、应付和付款状态已完成样本对账。";
}

export function reconciliationExportRows(statements: SupplierReconciliationStatement[]) {
  return statements.map((statement) => ({
    对账单ID: statement.id,
    对账单号: statement.statementNo,
    供应商: statement.supplier,
    期间开始: statement.periodStart,
    期间结束: statement.periodEnd,
    币种: statement.currency,
    发票金额: statement.totalInvoiceAmount,
    应付金额: statement.totalPayableAmount,
    已付金额: statement.totalPaidAmount,
    调整金额: statement.totalAdjustmentAmount,
    差异金额: statement.totalVarianceAmount,
    未结余额: statement.openBalance,
    逾期金额: statement.overdueAmount,
    发票数: statement.invoiceCount,
    异常数: statement.exceptionCount,
    状态: statement.status,
    结算状态: statement.settlementStatus,
    负责人: statement.owner,
    来源: statement.source,
    备注: statement.notes || "",
  }));
}

export function reconciliationLineExportRows(statement: SupplierReconciliationStatement) {
  return statement.lines.map((line) => ({
    对账单ID: statement.id,
    对账单号: statement.statementNo,
    供应商: statement.supplier,
    对账期间: `${statement.periodStart} ~ ${statement.periodEnd}`,
    类型: line.bizType,
    业务单据: line.bizId,
    日期: line.documentDate,
    到期日: line.dueDate || "",
    描述: line.description,
    借方金额: line.debitAmount || 0,
    贷方金额: line.creditAmount || 0,
    应付金额: line.payableAmount,
    已付金额: line.paidAmount,
    差异金额: line.varianceAmount,
    状态: line.status,
    匹配状态: line.matchStatus || "",
    关联PO: line.relatedPo || "",
    关联GRN: line.relatedGrn || "",
    关联发票: line.relatedInvoice || "",
    备注: line.notes || "",
  }));
}

export function reconciliationExceptionRows(statements: SupplierReconciliationStatement[]) {
  return statements
    .filter(isStatementException)
    .map((statement) => ({
      对账单号: statement.statementNo,
      供应商: statement.supplier,
      对账期间: `${statement.periodStart} ~ ${statement.periodEnd}`,
      异常类型: statement.status === "已驳回"
        ? "供应商驳回"
        : statement.totalVarianceAmount > 0
          ? "金额/单据差异"
          : statement.overdueAmount > 0
            ? "逾期应付"
            : "待复核",
      差异金额: statement.totalVarianceAmount,
      逾期金额: statement.overdueAmount,
      未结余额: statement.openBalance,
      状态: statement.status,
      建议动作: getReconciliationSummary(statement),
    }));
}

export function statementToCockpitSignal(statement: SupplierReconciliationStatement) {
  return {
    priority: statement.status === "已驳回" || statement.totalVarianceAmount > 0 ? "高" as const : "中" as const,
    title: statement.totalVarianceAmount > 0 ? "复核供应商对账差异" : "复核供应商未结余额",
    evidence: `${statement.supplier} · ${statement.periodStart.slice(5)}~${statement.periodEnd.slice(5)} · 差异 ${statement.totalVarianceAmount.toLocaleString()} · 未结 ${statement.openBalance.toLocaleString()}`,
  };
}

export function lineHasException(line: SupplierReconciliationLine) {
  return line.varianceAmount > 0 || ["存在差异", "已驳回", "逾期"].includes(line.status);
}
