-- Phase 5.1 authorization foundation. Permission definitions remain code-owned.
CREATE TABLE "TenantRole" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roleKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "isDefaultTemplate" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantRole_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE TABLE "TenantRolePermission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "permissionCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "TenantRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRoleAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserRoleAssignment_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");
CREATE UNIQUE INDEX "TenantRole_tenantId_roleKey_key" ON "TenantRole"("tenantId", "roleKey");
CREATE UNIQUE INDEX "TenantRole_tenantId_id_key" ON "TenantRole"("tenantId", "id");
CREATE INDEX "TenantRole_tenantId_status_idx" ON "TenantRole"("tenantId", "status");
CREATE UNIQUE INDEX "TenantRolePermission_roleId_permissionCode_key" ON "TenantRolePermission"("roleId", "permissionCode");
CREATE INDEX "TenantRolePermission_tenantId_permissionCode_idx" ON "TenantRolePermission"("tenantId", "permissionCode");
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_key" ON "UserRoleAssignment"("userId", "roleId");
CREATE INDEX "UserRoleAssignment_tenantId_userId_status_idx" ON "UserRoleAssignment"("tenantId", "userId", "status");
CREATE INDEX "UserRoleAssignment_tenantId_roleId_status_idx" ON "UserRoleAssignment"("tenantId", "roleId", "status");

ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "TenantRole"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_tenantId_roleId_fkey" FOREIGN KEY ("tenantId", "roleId") REFERENCES "TenantRole"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The database rejects permission codes outside the versioned catalog. Keep this
-- additive constraint synchronized with server/auth/permission-catalog.mjs.
ALTER TABLE "TenantRolePermission" ADD CONSTRAINT "TenantRolePermission_permissionCode_catalog_check" CHECK ("permissionCode" IN (
  'settings.workspace.read','settings.workspace.manage','settings.users.read','settings.users.manage','settings.roles.read','settings.roles.manage','settings.roles.assign','settings.numbering.read','settings.numbering.manage','settings.review_policy.read','settings.review_policy.manage','settings.modules.read','settings.modules.manage','settings.import.manage','settings.warehouse_import.manage','settings.diagnostics.read','settings.export.read','audit.read','audit.read_sensitive',
  'returns.request.read','returns.request.create','returns.request.revise','returns.request.submit','returns.request.cancel','returns.authorization.read','returns.authorization.approve','returns.authorization.reject','returns.authorization.cancel','returns.authorization.expire','returns.posting.read','returns.posting.prepare','returns.posting.ready','returns.posting.post','returns.posting.cancel','returns.posting.reverse','returns.quarantine.read','returns.quarantine.release_prepare','returns.quarantine.release_post','returns.quarantine.release_reverse',
  'receiving.read','receiving.prepare','receiving.post','receiving.reverse','sales_order.read','sales_order.create','sales_order.revise','sales_order.submit','sales_order.cancel','shipment.read','shipment.prepare','shipment.post','shipment.reverse','inventory.balance.read','inventory.transfer.read','inventory.transfer.create','inventory.transfer.post','inventory.transfer.reverse','inventory.count.read','inventory.count.create','inventory.count.submit','inventory.count.review','inventory.count.post','inventory.count.reverse','inventory.adjustment.read','inventory.adjustment.create','inventory.adjustment.approve','inventory.adjustment.post','inventory.adjustment.reverse',
  'finance.overview.read','finance.amounts.read','finance.partner_snapshot.read','procurement.prices.read','finance.supplier_invoice.read','finance.supplier_invoice.create','finance.supplier_invoice.revise','finance.supplier_invoice.submit','finance.supplier_invoice.approve','finance.three_way_match.read','finance.three_way_match.execute','finance.match_exception.review','finance.payable.read','finance.payable.hold','finance.payable.release','finance.payable.mark_export_ready','finance.supplier_credit.read','finance.supplier_credit.create','finance.supplier_credit.approve','finance.customer_invoice.read','finance.customer_invoice.create','finance.customer_invoice.submit','finance.customer_invoice.approve','finance.customer_invoice.issue','finance.receivable.read','finance.receivable.dispute','finance.receivable.resolve_dispute','finance.receivable.record_external_reference','finance.customer_credit.read','finance.customer_credit.create','finance.customer_credit.approve'
));
