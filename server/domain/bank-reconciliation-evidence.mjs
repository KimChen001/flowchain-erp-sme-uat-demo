import { createHash } from "node:crypto";
import { assertAuthorized } from "../auth/authorization-service.mjs";
import { bankAmountString, bankAmountUnits } from "./bank-statement-parser.mjs";
import { capabilityForEnvironment } from "./capability-registry.mjs";
import { createLocalDurableAttachmentStorage } from "./attachment-storage-provider.mjs";
import { resolveProvisionedActor } from "./pilot-identity.mjs";

const text = (value) => String(value ?? "").trim();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const check = (name, calculated, recorded, available = true) => ({ name, status: !available ? "unavailable" : calculated === recorded ? "matched" : "mismatch", calculated: available ? calculated : null, recorded: available ? recorded : null });

export function createBankReconciliationEvidenceService({ prisma, env = process.env, storageProvider } = {}) {
  if (!prisma) throw new Error("prisma is required");
  const storage = storageProvider || createLocalDurableAttachmentStorage({ env, digest });
  async function verify(groupId, context) {
    if (!capabilityForEnvironment("bank-statement-reconciliation", env)?.enabled) return { reconciliation: "unavailable", reason: "BANK_RECONCILIATION_CAPABILITY_NOT_AVAILABLE", checks: [] };
    const actor = await resolveProvisionedActor(prisma, context?.identity || context); assertAuthorized({ actor, permission: "finance.bank_reconciliation.read", tenantId: actor.tenantId });
    const group = await prisma.bankReconciliationGroup.findFirst({ where: { id: text(groupId), tenantId: actor.tenantId }, include: { bankAllocations: { include: { bankStatementLine: { include: { batch: { include: { upload: true, mappingTemplate: true } }, sourceRow: true, candidates: true } } } }, cashbookAllocations: { include: { cashbookEntry: { include: { settlement: true, internalTransfer: true } } } }, exceptions: true } });
    if (!group) return { reconciliation: "unavailable", reason: "BANK_RECONCILIATION_GROUP_NOT_FOUND", checks: [] };
    const checks = [], bankCalculated = group.bankAllocations.reduce((total, row) => total + bankAmountUnits(row.allocatedAmount), 0n), cashCalculated = group.cashbookAllocations.reduce((total, row) => total + bankAmountUnits(row.allocatedAmount), 0n);
    checks.push(check("bank_allocation_total", bankAmountString(bankCalculated), bankAmountString(bankAmountUnits(group.totalBankAmount))));
    checks.push(check("cashbook_allocation_total", bankAmountString(cashCalculated), bankAmountString(bankAmountUnits(group.totalCashbookAmount))));
    checks.push(check("group_difference", bankAmountString(bankCalculated - cashCalculated), bankAmountString(bankAmountUnits(group.differenceAmount))));
    for (const allocation of group.bankAllocations) {
      const line = allocation.bankStatementLine, batch = line.batch; let fileHash = null;
      try { fileHash = digest(await storage.get(batch.upload.storageKey)); } catch {}
      checks.push(check(`file_hash:${batch.id}`, fileHash, batch.fileSha256, Boolean(fileHash)));
      checks.push(check(`mapping_version:${line.id}`, String(line.metadata?.mappingTemplateVersion ?? ""), String(batch.mappingTemplateVersion)));
      checks.push(check(`source_row_hash:${line.id}`, String(line.metadata?.sourceRowHash ?? ""), line.sourceRow.rawRowHash));
      checks.push(check(`normalized_line_amount:${line.id}`, bankAmountString(bankAmountUnits(line.amount)), bankAmountString(bankAmountUnits(line.sourceRow.normalizedAmount))));
      checks.push(check(`line_account:${line.id}`, line.cashbookAccountId, group.cashbookAccountId));
      checks.push(check(`line_currency:${line.id}`, line.currency, group.currency));
      checks.push(check(`line_direction:${line.id}`, line.direction, group.direction));
      const candidate = line.candidates.find((row) => group.cashbookAllocations.some((cash) => cash.cashbookEntryId === row.cashbookEntryId));
      checks.push(check(`candidate_algorithm:${line.id}`, candidate?.algorithmVersion || null, group.algorithmVersion, Boolean(candidate)));
      const expectedEvidenceKeys = ["accountMatched", "cashbookEntryNumber", "currencyMatched", "dayDifference", "direction", "exactAmount", "exactReference", "limitations", "recommendation"];
      const recordedEvidenceKeys = candidate?.evidence ? Object.keys(candidate.evidence).filter((key) => expectedEvidenceKeys.includes(key)).sort() : [];
      checks.push(check(`candidate_evidence:${line.id}`, recordedEvidenceKeys.join(","), expectedEvidenceKeys.sort().join(","), Boolean(candidate?.evidence)));
    }
    for (const allocation of group.cashbookAllocations) {
      const entry = allocation.cashbookEntry;
      checks.push(check(`cashbook_source_account:${entry.id}`, entry.cashbookAccountId, group.cashbookAccountId));
      checks.push(check(`cashbook_source_currency:${entry.id}`, entry.currency, group.currency));
      checks.push(check(`cashbook_source_direction:${entry.id}`, entry.direction === "inflow" ? "credit" : "debit", group.direction));
      checks.push(check(`cashbook_source_document:${entry.id}`, entry.settlementId || entry.internalTransferId || null, allocation.settlementDocumentId || allocation.internalTransferId || null));
    }
    const [auditCount, feedCount] = await Promise.all([prisma.auditLog.count({ where: { tenantId: actor.tenantId, entityType: "BankReconciliationGroup", entityId: group.id, action: { in: ["bank_reconciliation_confirmed", "bank_reconciliation_reversed"] } } }), prisma.domainChangeFeed.count({ where: { tenantId: actor.tenantId, entityType: "BankReconciliationGroup", entityId: group.id } })]);
    checks.push(check("confirm_actor_time", Boolean(group.confirmedById && group.confirmedAt), true)); checks.push(check("audit", auditCount > 0, true)); checks.push(check("domain_change_feed", feedCount > 0, true));
    if (group.workflowStatus === "reversed") checks.push(check("reversal_reason", Boolean(group.reversalReason && group.reversedById && group.reversedAt), true));
    const blocking = group.exceptions.some((row) => row.status === "open" && row.severity === "blocking"); checks.push(check("integrity_exception", blocking ? "mismatch" : "matched", group.integrityStatus));
    const reconciliation = checks.some((row) => row.status === "mismatch") ? "mismatch" : checks.some((row) => row.status === "unavailable") ? "unavailable" : "matched";
    return { reconciliation, groupId: group.id, workflowStatus: group.workflowStatus, algorithmVersion: group.algorithmVersion, checks, evidence: { bankAllocationIds: group.bankAllocations.map((row) => row.id), cashbookAllocationIds: group.cashbookAllocations.map((row) => row.id), confirmedById: group.confirmedById, confirmedAt: group.confirmedAt, reversedById: group.reversedById, reversedAt: group.reversedAt, reversalReason: group.reversalReason }, limitations: ["Imported statement evidence only", "No bank API confirmation", "No general ledger conclusion"] };
  }
  return { verify };
}
