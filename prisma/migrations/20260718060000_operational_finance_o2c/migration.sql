ALTER TABLE "SalesOrderLine"
  ADD COLUMN "unitPrice" DECIMAL(18,4),
  ADD COLUMN "amount" DECIMAL(18,4);
ALTER TABLE "SalesOrderLine"
  ADD CONSTRAINT "SalesOrderLine_price_check"
  CHECK (
    ("unitPrice" IS NULL AND "amount" IS NULL) OR
    ("unitPrice" >= 0 AND "amount" >= 0 AND "amount" = round("orderedQuantity" * "unitPrice", 4))
  );

CREATE TABLE "CustomerInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerNameSnapshot" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "subtotalAmount" DECIMAL(18,4) NOT NULL,
  "enteredTaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submittedAt" TIMESTAMP(3),
  "submittedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "issuedAt" TIMESTAMP(3),
  "issuedById" TEXT,
  "disputedAt" TIMESTAMP(3),
  "disputeReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerInvoice_amounts_check"
    CHECK (
      "subtotalAmount" >= 0 AND "enteredTaxAmount" >= 0 AND
      "totalAmount" = "subtotalAmount" + "enteredTaxAmount"
    ),
  CONSTRAINT "CustomerInvoice_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CustomerInvoice_status_check"
    CHECK ("status" IN ('draft', 'submitted', 'approved', 'issued', 'disputed', 'cancelled'))
);

CREATE UNIQUE INDEX "CustomerInvoice_tenantId_invoiceNumber_key"
  ON "CustomerInvoice"("tenantId", "invoiceNumber");
CREATE INDEX "CustomerInvoice_tenantId_status_idx"
  ON "CustomerInvoice"("tenantId", "status");
CREATE INDEX "CustomerInvoice_tenantId_customerId_idx"
  ON "CustomerInvoice"("tenantId", "customerId");
CREATE INDEX "CustomerInvoice_tenantId_shipmentId_idx"
  ON "CustomerInvoice"("tenantId", "shipmentId");
CREATE INDEX "CustomerInvoice_tenantId_dueDate_idx"
  ON "CustomerInvoice"("tenantId", "dueDate");

ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "ShipmentDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerInvoiceLine" (
  "id" TEXT NOT NULL,
  "customerInvoiceId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "shipmentLineId" TEXT NOT NULL,
  "salesOrderLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "lineAmount" DECIMAL(18,4) NOT NULL,
  "enteredTaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  CONSTRAINT "CustomerInvoiceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerInvoiceLine_values_check"
    CHECK (
      "quantity" > 0 AND "unitPrice" >= 0 AND
      "lineAmount" = round("quantity" * "unitPrice", 4) AND
      "enteredTaxAmount" >= 0 AND
      "totalAmount" = "lineAmount" + "enteredTaxAmount"
    )
);

CREATE UNIQUE INDEX "CustomerInvoiceLine_invoice_shipment_key"
  ON "CustomerInvoiceLine"("customerInvoiceId", "shipmentLineId");
CREATE INDEX "CustomerInvoiceLine_shipmentLineId_idx"
  ON "CustomerInvoiceLine"("shipmentLineId");
CREATE INDEX "CustomerInvoiceLine_salesOrderLineId_idx"
  ON "CustomerInvoiceLine"("salesOrderLineId");

ALTER TABLE "CustomerInvoiceLine"
  ADD CONSTRAINT "CustomerInvoiceLine_customerInvoiceId_fkey"
  FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceLine"
  ADD CONSTRAINT "CustomerInvoiceLine_shipmentLineId_fkey"
  FOREIGN KEY ("shipmentLineId") REFERENCES "ShipmentLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceLine"
  ADD CONSTRAINT "CustomerInvoiceLine_salesOrderLineId_fkey"
  FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceLine"
  ADD CONSTRAINT "CustomerInvoiceLine_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReceivableObligation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerInvoiceId" TEXT NOT NULL,
  "obligationNumber" TEXT NOT NULL,
  "originalAmount" DECIMAL(18,4) NOT NULL,
  "outstandingAmount" DECIMAL(18,4) NOT NULL,
  "approvedCreditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "disputeStatus" TEXT NOT NULL DEFAULT 'none',
  "disputeReason" TEXT,
  "externalSettlementReference" TEXT,
  "externalSettlementEnteredAt" TIMESTAMP(3),
  "externalSettlementEnteredById" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceivableObligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReceivableObligation_amounts_check"
    CHECK (
      "originalAmount" >= 0 AND "outstandingAmount" >= 0 AND
      "approvedCreditAmount" >= 0 AND
      "outstandingAmount" + "approvedCreditAmount" = "originalAmount"
    ),
  CONSTRAINT "ReceivableObligation_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ReceivableObligation_status_check"
    CHECK ("status" IN ('open', 'partially_settled', 'settled', 'overdue', 'disputed', 'cancelled')),
  CONSTRAINT "ReceivableObligation_dispute_status_check"
    CHECK ("disputeStatus" IN ('none', 'open', 'resolved'))
);

CREATE UNIQUE INDEX "ReceivableObligation_customerInvoiceId_key"
  ON "ReceivableObligation"("customerInvoiceId");
CREATE UNIQUE INDEX "ReceivableObligation_tenantId_obligationNumber_key"
  ON "ReceivableObligation"("tenantId", "obligationNumber");
CREATE INDEX "ReceivableObligation_tenantId_status_idx"
  ON "ReceivableObligation"("tenantId", "status");
CREATE INDEX "ReceivableObligation_tenantId_dueDate_idx"
  ON "ReceivableObligation"("tenantId", "dueDate");
CREATE INDEX "ReceivableObligation_tenantId_currency_idx"
  ON "ReceivableObligation"("tenantId", "currency");

ALTER TABLE "ReceivableObligation"
  ADD CONSTRAINT "ReceivableObligation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivableObligation"
  ADD CONSTRAINT "ReceivableObligation_customerInvoiceId_fkey"
  FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerCreditNote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "creditNoteNumber" TEXT NOT NULL,
  "customerInvoiceId" TEXT NOT NULL,
  "returnPostingId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerNameSnapshot" TEXT NOT NULL,
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
  CONSTRAINT "CustomerCreditNote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerCreditNote_amounts_check"
    CHECK (
      "subtotalAmount" >= 0 AND "enteredTaxAmount" >= 0 AND
      "totalAmount" = "subtotalAmount" + "enteredTaxAmount"
    ),
  CONSTRAINT "CustomerCreditNote_currency_check"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "CustomerCreditNote_status_check"
    CHECK ("status" IN ('draft', 'approved', 'cancelled'))
);

CREATE UNIQUE INDEX "CustomerCreditNote_tenantId_creditNoteNumber_key"
  ON "CustomerCreditNote"("tenantId", "creditNoteNumber");
CREATE INDEX "CustomerCreditNote_tenantId_status_idx"
  ON "CustomerCreditNote"("tenantId", "status");
CREATE INDEX "CustomerCreditNote_customerInvoiceId_idx"
  ON "CustomerCreditNote"("customerInvoiceId");
CREATE INDEX "CustomerCreditNote_returnPostingId_idx"
  ON "CustomerCreditNote"("returnPostingId");

ALTER TABLE "CustomerCreditNote"
  ADD CONSTRAINT "CustomerCreditNote_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditNote"
  ADD CONSTRAINT "CustomerCreditNote_customerInvoiceId_fkey"
  FOREIGN KEY ("customerInvoiceId") REFERENCES "CustomerInvoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditNote"
  ADD CONSTRAINT "CustomerCreditNote_returnPostingId_fkey"
  FOREIGN KEY ("returnPostingId") REFERENCES "ReturnPostingDocument"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerCreditNoteLine" (
  "id" TEXT NOT NULL,
  "customerCreditNoteId" TEXT NOT NULL,
  "customerInvoiceLineId" TEXT NOT NULL,
  "returnPostingLineId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "lineAmount" DECIMAL(18,4) NOT NULL,
  "enteredTaxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "pricingSource" TEXT NOT NULL,
  "metadata" JSONB,
  CONSTRAINT "CustomerCreditNoteLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerCreditNoteLine_values_check"
    CHECK (
      "quantity" > 0 AND "unitPrice" >= 0 AND
      "lineAmount" = round("quantity" * "unitPrice", 4) AND
      "enteredTaxAmount" >= 0 AND
      "totalAmount" = "lineAmount" + "enteredTaxAmount"
    ),
  CONSTRAINT "CustomerCreditNoteLine_pricing_source_check"
    CHECK ("pricingSource" IN ('original_invoice', 'manual_reviewed'))
);

CREATE UNIQUE INDEX "CustomerCreditNoteLine_note_invoice_return_key"
  ON "CustomerCreditNoteLine"("customerCreditNoteId", "customerInvoiceLineId", "returnPostingLineId");
CREATE INDEX "CustomerCreditNoteLine_customerInvoiceLineId_idx"
  ON "CustomerCreditNoteLine"("customerInvoiceLineId");
CREATE INDEX "CustomerCreditNoteLine_returnPostingLineId_idx"
  ON "CustomerCreditNoteLine"("returnPostingLineId");

ALTER TABLE "CustomerCreditNoteLine"
  ADD CONSTRAINT "CustomerCreditNoteLine_customerCreditNoteId_fkey"
  FOREIGN KEY ("customerCreditNoteId") REFERENCES "CustomerCreditNote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditNoteLine"
  ADD CONSTRAINT "CustomerCreditNoteLine_customerInvoiceLineId_fkey"
  FOREIGN KEY ("customerInvoiceLineId") REFERENCES "CustomerInvoiceLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCreditNoteLine"
  ADD CONSTRAINT "CustomerCreditNoteLine_returnPostingLineId_fkey"
  FOREIGN KEY ("returnPostingLineId") REFERENCES "ReturnPostingLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
