import { financeUnits as units } from "./operational-finance-policy.mjs";

const text = (value) => String(value ?? "").trim().toLowerCase();

export function derivePayableSettlementStatus({ originalAmount, approvedCreditAmount = 0, outstandingAmount }) {
  const maximum = units(originalAmount) - units(approvedCreditAmount);
  const outstanding = units(outstandingAmount);
  if (outstanding <= 0n) return "settled";
  if (outstanding === maximum) return "approved";
  return "partially_settled";
}

export function deriveReceivableSettlementStatus({ originalAmount, approvedCreditAmount = 0, outstandingAmount }) {
  const maximum = units(originalAmount) - units(approvedCreditAmount);
  const outstanding = units(outstandingAmount);
  if (outstanding <= 0n) return "settled";
  if (outstanding === maximum) return "open";
  return "partially_settled";
}

export function assertAdvanceApplicationEligibility(obligation, type) {
  if (!obligation) throw Object.assign(new Error("The obligation was not found."), { code: "ADVANCE_APPLICATION_OBLIGATION_NOT_FOUND", status: 404 });
  if (units(obligation.outstandingAmount) <= 0n) throw Object.assign(new Error("The obligation has no outstanding balance."), { code: "ADVANCE_APPLICATION_OBLIGATION_SETTLED", status: 409 });
  const status = text(obligation.status);
  const allowedStatuses = type === "payable" ? new Set(["approved", "partially_settled"]) : new Set(["open", "partially_settled"]);
  const disputeStatus = text(obligation.disputeStatus || "none");
  const disputeAllowed = type === "payable" || new Set(["none", "resolved"]).has(disputeStatus);
  if (!allowedStatuses.has(status) || !disputeAllowed) throw Object.assign(new Error(`The ${type} obligation status ${status} is not eligible for advance application.`), { code: "ADVANCE_APPLICATION_OBLIGATION_NOT_ELIGIBLE", status: 409, details: { status, disputeStatus, obligationType: type } });
  return true;
}
