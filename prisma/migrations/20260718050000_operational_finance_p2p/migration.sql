ALTER TABLE "SupplierInvoice"
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "supplierSnapshot" JSONB,
  ADD COLUMN "subtotalAmount" DECIMAL(18,4),
  ADD COLUMN "enteredTaxAmount" DECIMAL(18,4),
  ADD COLUMN "totalAmount" DECIMAL(18,4),
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "heldAt" TIMESTAMP(3),
  ADD COLUMN "heldById" TEXT,
  ADD COLUMN "holdReason" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SupplierInvoice"
  ALTER COLUMN "status" SET DEFAULT 'draft';

ALTER TABLE "SupplierInvoiceLine"
  ADD COLUMN "lineNumber" INTEGER,
  ADD COLUMN "purchaseOrderLineId" TEXT,
  ADD COLUMN "receivingLineId" TEXT,
  ADD COLUMN "lineAmount" DECIMAL(18,4),
  ADD COLUMN "enteredTaxAmount" DECIMAL(18,4),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ThreeWayMatch"
  ADD COLUMN "matchNumber" TEXT,
  ADD COLUMN "matchedAt" TIMESTAMP(3),
  ADD COLUMN "matchedById" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "SupplierInvoice_tenant_supplier_number_key"
  ON "SupplierInvoice"("tenantId", "supplierId", "invoiceNumber")
  WHERE "invoiceNumber" IS NOT NULL;
CREATE INDEX "SupplierInvoice_tenantId_supplierId_invoiceNumber_idx"
  ON "SupplierInvoice"("tenantId", "supplierId", "invoiceNumber");
CREATE INDEX "SupplierInvoiceLine_purchaseOrderLineId_idx"
  ON "SupplierInvoiceLine"("purchaseOrderLineId");
CREATE INDEX "SupplierInvoiceLine_receivingLineId_idx"
  ON "SupplierInvoiceLine"("receivingLineId");

ALTER TABLE "ThreeWayMatch"
  ADD CONSTRAINT "ThreeWayMatch_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

CREATE TABLE "ThreeWayMatchLine" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "supplierInvoiceLineId" TEXT NOT NULL,
  "purchaseOrderLineId" TEXT NOT NULL,
  "receivingLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "unit" TEXT,
  "orderedQuantity" DECIMAL(18,4) NOT NULL,
  "receivedQuantity" DECIMAL(18,4) NOT NULL,
  "previouslyInvoicedQuantity" DECIMAL(18,4) NOT NULL,
  "invoiceQuantity" DECIMAL(18,4) NOT NULL,
  "poUnitPrice" DECIMAL(18,4) NOT NULL,
  "invoiceUnitPrice" DECIMAL(18,4) NOT NULL,
  "poLineAmount" DECIMAL(18,4) NOT NULL,
  "invoiceLineAmount" DECIMAL(18,4) NOT NULL,
  "quantityVariance" DECIMAL(18,4) NOT NULL,
  "priceVariance" DECIMAL(18,4) NOT NULL,
  "amountVariance" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "ThreeWayMatchLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ThreeWayMatchLine_status_check"
    CHECK ("status" IN ('matched', 'exception'))
);

CREATE UNIQUE INDEX "ThreeWayMatchLine_matchId_supplierInvoiceLineId_key"
  ON "ThreeWayMatchLine"("matchId", "supplierInvoiceLineId");
CREATE INDEX "ThreeWayMatchLine_supplierInvoiceLineId_idx"
  ON "ThreeWayMatchLine"("supplierInvoiceLineId");
CREATE INDEX "ThreeWayMatchLine_purchaseOrderLineId_idx"
  ON "ThreeWayMatchLine"("purchaseOrderLineId");
CREATE INDEX "ThreeWayMatchLine_receivingLineId_idx"
  ON "ThreeWayMatchLine"("receivingLineId");

ALTER TABLE "ThreeWayMatchLine"
  ADD CONSTRAINT "ThreeWayMatchLine_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "ThreeWayMatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThreeWayMatchLine"
  ADD CONSTRAINT "ThreeWayMatchLine_supplierInvoiceLineId_fkey"
  FOREIGN KEY ("supplierInvoiceLineId") REFERENCES "SupplierInvoiceLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FinanceMatchException" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "matchLineId" TEXT,
  "supplierInvoiceId" TEXT NOT NULL,
  "exceptionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "expectedValue" DECIMAL(18,4),
  "actualValue" DECIMAL(18,4),
  "varianceValue" DECIMAL(18,4),
  "currency" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceMatchException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceMatchException_status_check"
    CHECK ("status" IN ('open', 'approved', 'rejected', 'resolved'))
);

CREATE INDEX "FinanceMatchException_tenantId_status_idx"
  ON "FinanceMatchException"("tenantId", "status");
CREATE INDEX "FinanceMatchException_matchId_idx"
  ON "FinanceMatchException"("matchId");
CREATE INDEX "FinanceMatchException_supplierInvoiceId_idx"
  ON "FinanceMatchException"("supplierInvoiceId");

ALTER TABLE "FinanceMatchException"
  ADD CONSTRAINT "FinanceMatchException_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceMatchException"
  ADD CONSTRAINT "FinanceMatchException_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "ThreeWayMatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceMatchException"
  ADD CONSTRAINT "FinanceMatchException_matchLineId_fkey"
  FOREIGN KEY ("matchLineId") REFERENCES "ThreeWayMatchLine"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceMatchException"
  ADD CONSTRAINT "FinanceMatchException_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayableObligation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "obligationNumber" TEXT NOT NULL,
  "originalAmount" DECIMAL(18,4) NOT NULL,
  "outstandingAmount" DECIMAL(18,4) NOT NULL,
  "approvedCreditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "heldAt" TIMESTAMP(3),
  "heldById" TEXT,
  "holdReason" TEXT,
  "exportReadyAt" TIMESTAMP(3),
  "exportReadyById" TEXT,
  "exportedAt" TIMESTAMP(3),
  "externalExportReference" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayableObligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayableObligation_amounts_check"
    CHECK ("originalAmount" >= 0 AND "outstandingAmount" >= 0 AND "approvedCreditAmount" >= 0),
  CONSTRAINT "PayableObligation_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PayableObligation_status_check"
    CHECK ("status" IN ('draft', 'approved', 'held', 'export_ready', 'exported', 'cancelled'))
);

CREATE UNIQUE INDEX "PayableObligation_supplierInvoiceId_key"
  ON "PayableObligation"("supplierInvoiceId");
CREATE UNIQUE INDEX "PayableObligation_tenantId_obligationNumber_key"
  ON "PayableObligation"("tenantId", "obligationNumber");
CREATE INDEX "PayableObligation_tenantId_status_idx"
  ON "PayableObligation"("tenantId", "status");
CREATE INDEX "PayableObligation_tenantId_dueDate_idx"
  ON "PayableObligation"("tenantId", "dueDate");

ALTER TABLE "PayableObligation"
  ADD CONSTRAINT "PayableObligation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayableObligation"
  ADD CONSTRAINT "PayableObligation_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierCreditMemo" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "creditMemoNumber" TEXT NOT NULL,
  "supplierInvoiceId" TEXT NOT NULL,
  "returnPostingId" TEXT NOT NULL,
  "supplierId" TEXT,
  "supplierNameSnapshot" TEXT,
  "currency" TEXT NOT NULL,
  "subtotalAmount" DECIMAL(18,4) NOT NULL,
  "enteredTaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierCreditMemo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCreditMemo_amounts_check"
    CHECK ("subtotalAmount" >= 0 AND "enteredTaxAmount" >= 0 AND "totalAmount" >= 0),
  CONSTRAINT "SupplierCreditMemo_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "SupplierCreditMemo_status_check"
    CHECK ("status" IN ('draft', 'approved', 'cancelled'))
);

CREATE UNIQUE INDEX "SupplierCreditMemo_tenantId_creditMemoNumber_key"
  ON "SupplierCreditMemo"("tenantId", "creditMemoNumber");
CREATE INDEX "SupplierCreditMemo_tenantId_status_idx"
  ON "SupplierCreditMemo"("tenantId", "status");
CREATE INDEX "SupplierCreditMemo_supplierInvoiceId_idx"
  ON "SupplierCreditMemo"("supplierInvoiceId");
CREATE INDEX "SupplierCreditMemo_returnPostingId_idx"
  ON "SupplierCreditMemo"("returnPostingId");

ALTER TABLE "SupplierCreditMemo"
  ADD CONSTRAINT "SupplierCreditMemo_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditMemo"
  ADD CONSTRAINT "SupplierCreditMemo_supplierInvoiceId_fkey"
  FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditMemo"
  ADD CONSTRAINT "SupplierCreditMemo_returnPostingId_fkey"
  FOREIGN KEY ("returnPostingId") REFERENCES "ReturnPostingDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupplierCreditMemoLine" (
  "id" TEXT NOT NULL,
  "supplierCreditMemoId" TEXT NOT NULL,
  "supplierInvoiceLineId" TEXT NOT NULL,
  "returnPostingLineId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "lineAmount" DECIMAL(18,4) NOT NULL,
  "enteredTaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "pricingSource" TEXT NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "SupplierCreditMemoLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierCreditMemoLine_values_check"
    CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "lineAmount" >= 0 AND "enteredTaxAmount" >= 0 AND "totalAmount" >= 0),
  CONSTRAINT "SupplierCreditMemoLine_pricing_source_check"
    CHECK ("pricingSource" IN ('original_invoice', 'manual_reviewed'))
);

CREATE UNIQUE INDEX "SupplierCreditMemoLine_memo_invoice_return_key"
  ON "SupplierCreditMemoLine"("supplierCreditMemoId", "supplierInvoiceLineId", "returnPostingLineId");
CREATE INDEX "SupplierCreditMemoLine_supplierInvoiceLineId_idx"
  ON "SupplierCreditMemoLine"("supplierInvoiceLineId");
CREATE INDEX "SupplierCreditMemoLine_returnPostingLineId_idx"
  ON "SupplierCreditMemoLine"("returnPostingLineId");

ALTER TABLE "SupplierCreditMemoLine"
  ADD CONSTRAINT "SupplierCreditMemoLine_supplierCreditMemoId_fkey"
  FOREIGN KEY ("supplierCreditMemoId") REFERENCES "SupplierCreditMemo"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditMemoLine"
  ADD CONSTRAINT "SupplierCreditMemoLine_supplierInvoiceLineId_fkey"
  FOREIGN KEY ("supplierInvoiceLineId") REFERENCES "SupplierInvoiceLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierCreditMemoLine"
  ADD CONSTRAINT "SupplierCreditMemoLine_returnPostingLineId_fkey"
  FOREIGN KEY ("returnPostingLineId") REFERENCES "ReturnPostingLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
