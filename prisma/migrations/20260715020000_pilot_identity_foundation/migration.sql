ALTER TABLE "Tenant"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'CN',
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  ADD COLUMN "workspaceCompletedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN "jobTitle" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN "defaultWarehouseId" TEXT,
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UserWarehouseScope" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "accessLevel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserWarehouseScope_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserWarehouseScope_accessLevel_check" CHECK ("accessLevel" IN ('read', 'operate'))
);

CREATE TABLE "WorkspaceInvitation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceInvitation_status_check" CHECK ("status" IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE UNIQUE INDEX "UserWarehouseScope_tenantId_userId_warehouseId_key" ON "UserWarehouseScope"("tenantId", "userId", "warehouseId");
CREATE INDEX "UserWarehouseScope_tenantId_warehouseId_idx" ON "UserWarehouseScope"("tenantId", "warehouseId");
CREATE UNIQUE INDEX "WorkspaceInvitation_tokenHash_key" ON "WorkspaceInvitation"("tokenHash");
CREATE INDEX "WorkspaceInvitation_tenantId_email_status_idx" ON "WorkspaceInvitation"("tenantId", "email", "status");
CREATE UNIQUE INDEX "WorkspaceInvitation_active_email_key" ON "WorkspaceInvitation"("tenantId", lower("email")) WHERE "status" = 'pending';
CREATE INDEX "User_defaultWarehouseId_idx" ON "User"("defaultWarehouseId");

ALTER TABLE "User" ADD CONSTRAINT "User_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserWarehouseScope" ADD CONSTRAINT "UserWarehouseScope_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserWarehouseScope" ADD CONSTRAINT "UserWarehouseScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserWarehouseScope" ADD CONSTRAINT "UserWarehouseScope_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
