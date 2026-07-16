ALTER TABLE "ReturnPostingDocument"
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "readyById" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT;

UPDATE "ReturnPostingDocument"
SET "readyAt" = COALESCE("readyAt", "updatedAt")
WHERE "workflowStatus" = 'ready';

UPDATE "ReturnPostingDocument"
SET "cancelledAt" = COALESCE("cancelledAt", "updatedAt")
WHERE "workflowStatus" = 'cancelled';

UPDATE "ReturnPostingDocument"
SET "postedAt" = COALESCE("postedAt", "updatedAt")
WHERE "postingStatus" = 'posted';

UPDATE "ReturnPostingDocument"
SET "reversedAt" = COALESCE("reversedAt", "updatedAt")
WHERE "postingStatus" = 'reversed';

ALTER TABLE "ReturnPostingDocument"
  ADD CONSTRAINT "ReturnPostingDocument_lifecycle_timestamp_check"
  CHECK (
    ("workflowStatus" <> 'ready' OR "readyAt" IS NOT NULL) AND
    ("workflowStatus" <> 'cancelled' OR "cancelledAt" IS NOT NULL) AND
    ("postingStatus" <> 'posted' OR "postedAt" IS NOT NULL) AND
    ("postingStatus" <> 'reversed' OR "reversedAt" IS NOT NULL)
  );

CREATE INDEX "ReturnPostingDocument_tenantId_workflowStatus_postingStatus_idx"
  ON "ReturnPostingDocument"("tenantId", "workflowStatus", "postingStatus");
