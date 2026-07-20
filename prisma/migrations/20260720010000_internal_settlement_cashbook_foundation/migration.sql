-- Phase 5.2 internal settlement and cashbook foundation.
-- Records internal settlement facts only; no bank execution or general ledger.

CREATE TABLE "CashbookAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accountCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountType" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "openingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "currentBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashbookAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashbookAccount_type_check" CHECK ("accountType" IN ('cash','bank','clearing')),
  CONSTRAINT "CashbookAccount_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CashbookAccount_balance_check" CHECK ("openingBalance" >= 0 AND "currentBalance" >= 0),
  CONSTRAINT "CashbookAccount_status_check" CHECK ("status" IN ('active','inactive'))
);

CREATE TABLE "SettlementDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "settlementNumber" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "counterpartyType" TEXT NOT NULL,
  "counterpartyId" TEXT,
  "counterpartyNameSnapshot" TEXT,
  "cashbookAccountId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "settlementDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "externalReference" TEXT,
  "memo" TEXT,
  "postedAt" TIMESTAMP(3),
  "postedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementDocument_direction_check" CHECK ("direction" IN ('receipt','disbursement')),
  CONSTRAINT "SettlementDocument_counterparty_check" CHECK ("counterpartyType" IN ('customer','supplier')),
  CONSTRAINT "SettlementDocument_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "SettlementDocument_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "SettlementDocument_status_check" CHECK ("status" IN ('draft','posted','reversed','cancelled'))
);

CREATE TABLE "SettlementAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "payableObligationId" TEXT,
  "receivableObligationId" TEXT,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SettlementAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SettlementAllocation_type_check" CHECK ("obligationType" IN ('payable','receivable')),
  CONSTRAINT "SettlementAllocation_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "SettlementAllocation_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "SettlementAllocation_exact_obligation_check" CHECK (
    ("obligationType" = 'payable' AND "payableObligationId" IS NOT NULL AND "receivableObligationId" IS NULL)
    OR ("obligationType" = 'receivable' AND "receivableObligationId" IS NOT NULL AND "payableObligationId" IS NULL)
  )
);

CREATE TABLE "CashbookEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cashbookAccountId" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "entryNumber" TEXT NOT NULL,
  "entryType" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "balanceBefore" DECIMAL(18,4) NOT NULL,
  "balanceAfter" DECIMAL(18,4) NOT NULL,
  "postingBatchId" TEXT NOT NULL,
  "reversalOfEntryId" TEXT,
  "reversedByEntryId" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashbookEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashbookEntry_type_check" CHECK ("entryType" IN ('settlement','reversal')),
  CONSTRAINT "CashbookEntry_direction_check" CHECK ("direction" IN ('inflow','outflow')),
  CONSTRAINT "CashbookEntry_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CashbookEntry_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "CashbookEntry_balance_check" CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0)
);

CREATE UNIQUE INDEX "PayableObligation_tenantId_id_key" ON "PayableObligation"("tenantId","id");
CREATE UNIQUE INDEX "ReceivableObligation_tenantId_id_key" ON "ReceivableObligation"("tenantId","id");
CREATE UNIQUE INDEX "CashbookAccount_tenantId_accountCode_key" ON "CashbookAccount"("tenantId","accountCode");
CREATE UNIQUE INDEX "CashbookAccount_tenantId_id_key" ON "CashbookAccount"("tenantId","id");
CREATE INDEX "CashbookAccount_tenantId_status_idx" ON "CashbookAccount"("tenantId","status");
CREATE INDEX "CashbookAccount_tenantId_currency_idx" ON "CashbookAccount"("tenantId","currency");
CREATE UNIQUE INDEX "SettlementDocument_tenantId_settlementNumber_key" ON "SettlementDocument"("tenantId","settlementNumber");
CREATE UNIQUE INDEX "SettlementDocument_tenantId_id_key" ON "SettlementDocument"("tenantId","id");
CREATE INDEX "SettlementDocument_tenantId_status_idx" ON "SettlementDocument"("tenantId","status");
CREATE INDEX "SettlementDocument_tenantId_direction_settlementDate_idx" ON "SettlementDocument"("tenantId","direction","settlementDate");
CREATE INDEX "SettlementDocument_tenantId_counterpartyType_counterpartyId_idx" ON "SettlementDocument"("tenantId","counterpartyType","counterpartyId");
CREATE UNIQUE INDEX "SettlementAllocation_settlementId_obligationType_payableObligationId_receivableObligationId_key" ON "SettlementAllocation"("settlementId","obligationType","payableObligationId","receivableObligationId");
CREATE UNIQUE INDEX "SettlementAllocation_payable_once_key" ON "SettlementAllocation"("settlementId","payableObligationId") WHERE "payableObligationId" IS NOT NULL;
CREATE UNIQUE INDEX "SettlementAllocation_receivable_once_key" ON "SettlementAllocation"("settlementId","receivableObligationId") WHERE "receivableObligationId" IS NOT NULL;
CREATE INDEX "SettlementAllocation_tenantId_settlementId_idx" ON "SettlementAllocation"("tenantId","settlementId");
CREATE INDEX "SettlementAllocation_payableObligationId_idx" ON "SettlementAllocation"("payableObligationId");
CREATE INDEX "SettlementAllocation_receivableObligationId_idx" ON "SettlementAllocation"("receivableObligationId");
CREATE UNIQUE INDEX "CashbookEntry_tenantId_entryNumber_key" ON "CashbookEntry"("tenantId","entryNumber");
CREATE UNIQUE INDEX "CashbookEntry_settlementId_entryType_key" ON "CashbookEntry"("settlementId","entryType");
CREATE UNIQUE INDEX "CashbookEntry_reversalOfEntryId_key" ON "CashbookEntry"("reversalOfEntryId");
CREATE UNIQUE INDEX "CashbookEntry_reversedByEntryId_key" ON "CashbookEntry"("reversedByEntryId");
CREATE INDEX "CashbookEntry_tenantId_cashbookAccountId_occurredAt_idx" ON "CashbookEntry"("tenantId","cashbookAccountId","occurredAt");
CREATE INDEX "CashbookEntry_tenantId_settlementId_idx" ON "CashbookEntry"("tenantId","settlementId");

ALTER TABLE "CashbookAccount" ADD CONSTRAINT "CashbookAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementDocument" ADD CONSTRAINT "SettlementDocument_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenantId_settlementId_fkey" FOREIGN KEY ("tenantId","settlementId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenantId_payableObligationId_fkey" FOREIGN KEY ("tenantId","payableObligationId") REFERENCES "PayableObligation"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAllocation" ADD CONSTRAINT "SettlementAllocation_tenantId_receivableObligationId_fkey" FOREIGN KEY ("tenantId","receivableObligationId") REFERENCES "ReceivableObligation"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_tenantId_cashbookAccountId_fkey" FOREIGN KEY ("tenantId","cashbookAccountId") REFERENCES "CashbookAccount"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_tenantId_settlementId_fkey" FOREIGN KEY ("tenantId","settlementId") REFERENCES "SettlementDocument"("tenantId","id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_reversalOfEntryId_fkey" FOREIGN KEY ("reversalOfEntryId") REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashbookEntry" ADD CONSTRAINT "CashbookEntry_reversedByEntryId_fkey" FOREIGN KEY ("reversedByEntryId") REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend the code-owned permission catalog constraint without editing the prior migration.
ALTER TABLE "TenantRolePermission" DROP CONSTRAINT "TenantRolePermission_permissionCode_catalog_check";
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_permissionCode_catalog_check" CHECK ("permissionCode" IN (
  'settings.workspace.read','settings.workspace.manage','settings.users.read','settings.users.manage','settings.roles.read','settings.roles.manage','settings.roles.assign','settings.numbering.read','settings.numbering.manage','settings.review_policy.read','settings.review_policy.manage','settings.modules.read','settings.modules.manage','settings.import.manage','settings.warehouse_import.manage','settings.diagnostics.read','settings.export.read','audit.read','audit.read_sensitive',
  'returns.request.read','returns.request.create','returns.request.revise','returns.request.submit','returns.request.cancel','returns.customer_request.manage','returns.authorization.read','returns.authorization.approve','returns.authorization.reject','returns.authorization.cancel','returns.authorization.expire','returns.posting.read','returns.posting.prepare','returns.posting.ready','returns.posting.post','returns.posting.cancel','returns.posting.reverse','returns.quarantine.read','returns.quarantine.release_prepare','returns.quarantine.release_post','returns.quarantine.release_reverse',
  'receiving.read','receiving.prepare','receiving.post','receiving.reverse','sales_order.read','sales_order.create','sales_order.revise','sales_order.submit','sales_order.cancel','shipment.read','shipment.prepare','shipment.post','shipment.reverse','inventory.balance.read','inventory.transfer.read','inventory.transfer.create','inventory.transfer.post','inventory.transfer.reverse','inventory.count.read','inventory.count.create','inventory.count.submit','inventory.count.review','inventory.count.post','inventory.count.reverse','inventory.adjustment.read','inventory.adjustment.create','inventory.adjustment.approve','inventory.adjustment.post','inventory.adjustment.reverse',
  'finance.overview.read','finance.amounts.read','finance.partner_snapshot.read','procurement.prices.read','finance.supplier_invoice.read','finance.supplier_invoice.create','finance.supplier_invoice.revise','finance.supplier_invoice.submit','finance.supplier_invoice.approve','finance.three_way_match.read','finance.three_way_match.execute','finance.match_exception.review','finance.payable.read','finance.payable.hold','finance.payable.release','finance.payable.mark_export_ready','finance.supplier_credit.read','finance.supplier_credit.create','finance.supplier_credit.approve','finance.customer_invoice.read','finance.customer_invoice.create','finance.customer_invoice.submit','finance.customer_invoice.approve','finance.customer_invoice.issue','finance.receivable.read','finance.receivable.dispute','finance.receivable.resolve_dispute','finance.receivable.record_external_reference','finance.customer_credit.read','finance.customer_credit.create','finance.customer_credit.approve',
  'finance.cashbook.read','finance.cashbook.manage','finance.settlement.read','finance.settlement.create','finance.settlement.post','finance.settlement.reverse','finance.settlement.reconciliation.read'
));
