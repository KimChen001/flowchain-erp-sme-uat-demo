-- Phase 5.2C is additive. Published Phase 5.2 and 5.2B migrations are immutable.

ALTER TABLE "DomainChangeFeed"
  ADD COLUMN "moduleKey" TEXT,
  ADD COLUMN "scopeWarehouseIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "authorizationClass" TEXT,
  ADD COLUMN "resourceTenantId" TEXT;

CREATE INDEX "DomainChangeFeed_tenantId_moduleKey_sequence_idx"
  ON "DomainChangeFeed"("tenantId", "moduleKey", "sequence");

ALTER TABLE "StagedUpload"
  ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN "storageVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN "storageBucket" TEXT,
  ADD COLUMN "storageRegion" TEXT,
  ADD COLUMN "persistedAt" TIMESTAMP(3),
  ADD COLUMN "storageHealthStatus" TEXT NOT NULL DEFAULT 'unknown';

UPDATE "StagedUpload"
SET "persistedAt" = COALESCE("persistedAt", "createdAt");

CREATE TABLE "SyncSnapshotSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "syncClientId" TEXT NOT NULL,
  "authorizationFingerprint" TEXT NOT NULL,
  "highWatermarkSequence" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "entityTypeCursor" TEXT,
  "pageSize" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SyncSnapshotSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SyncSnapshotSession_status_check" CHECK ("status" IN ('active','completed','expired','invalidated'))
);

CREATE UNIQUE INDEX "SyncSnapshotSession_tenantId_id_key"
  ON "SyncSnapshotSession"("tenantId", "id");
CREATE INDEX "SyncSnapshotSession_tenantId_userId_status_expiresAt_idx"
  ON "SyncSnapshotSession"("tenantId", "userId", "status", "expiresAt");
CREATE INDEX "SyncSnapshotSession_tenantId_syncClientId_status_idx"
  ON "SyncSnapshotSession"("tenantId", "syncClientId", "status");

ALTER TABLE "SyncSnapshotSession"
  ADD CONSTRAINT "SyncSnapshotSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SyncSnapshotSession_tenantId_userId_fkey"
    FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SyncSnapshotSession_tenantId_syncClientId_fkey"
    FOREIGN KEY ("tenantId", "syncClientId") REFERENCES "SyncClient"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
