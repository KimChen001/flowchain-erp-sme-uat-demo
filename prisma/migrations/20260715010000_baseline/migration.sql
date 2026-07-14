-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'zh-CN',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'buyer',
    "department" TEXT,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "riskLevel" TEXT,
    "score" DECIMAL(10,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "preferredSupplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "safetyStock" DECIMAL(18,4),
    "reorderPoint" DECIMAL(18,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTerm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "days" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(10,4),
    "taxType" TEXT,
    "region" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "source" TEXT,
    "createdById" TEXT,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "originEvidence" JSONB,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionDraftValidation" (
    "id" TEXT NOT NULL,
    "actionDraftId" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "missingFields" JSONB,
    "warnings" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionDraftValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionDraftAuditTrail" (
    "id" TEXT NOT NULL,
    "actionDraftId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionDraftAuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "module" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "requester" TEXT,
    "buyer" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "priority" TEXT,
    "requiredDate" TIMESTAMP(3),
    "amount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "reason" TEXT,
    "source" TEXT,
    "linkedRfqId" TEXT,
    "linkedPoId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestLine" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4),
    "metadata" JSONB,

    CONSTRAINT "PurchaseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "supplierCount" INTEGER NOT NULL DEFAULT 0,
    "respondedSupplierCount" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "bestPrice" DECIMAL(18,4),
    "awardedSupplier" TEXT,
    "supplierId" TEXT,
    "sourceRequestId" TEXT,
    "linkedPoId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqLine" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "metadata" JSONB,

    CONSTRAINT "RfqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rfqId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "quotedAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "submittedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierQuotationLine" (
    "id" TEXT NOT NULL,
    "supplierQuotationId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4),
    "metadata" JSONB,

    CONSTRAINT "SupplierQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "supplierId" TEXT,
    "supplierName" TEXT,
    "sourceRequestId" TEXT,
    "sourceRfqId" TEXT,
    "expectedDate" TIMESTAMP(3),
    "amount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "owner" TEXT,
    "priority" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "orderedQuantity" DECIMAL(18,4),
    "receivedQuantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4),
    "metadata" JSONB,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "poId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'receiving',
    "arrivedAt" TIMESTAMP(3),
    "receiver" TEXT,
    "warehouseId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingLine" (
    "id" TEXT NOT NULL,
    "receivingDocumentId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "acceptedQty" DECIMAL(18,4),
    "rejectedQty" DECIMAL(18,4),
    "unit" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ReceivingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "relatedPoId" TEXT,
    "relatedGrnId" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "amount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "matchStatus" TEXT,
    "varianceAmount" DECIMAL(18,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceLine" (
    "id" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitPrice" DECIMAL(18,4),
    "amount" DECIMAL(18,4),
    "metadata" JSONB,

    CONSTRAINT "SupplierInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreeWayMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "poId" TEXT,
    "grnId" TEXT,
    "invoiceId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "poAmount" DECIMAL(18,4),
    "invoiceAmount" DECIMAL(18,4),
    "varianceAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "blockingReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreeWayMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "status" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementFollowup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "dueDate" TIMESTAMP(3),
    "supplierId" TEXT,
    "supplierName" TEXT,
    "documentType" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT NOT NULL,
    "itemName" TEXT,
    "warehouseId" TEXT,
    "location" TEXT,
    "availableQuantity" DECIMAL(18,4),
    "onHandQuantity" DECIMAL(18,4),
    "reservedQuantity" DECIMAL(18,4),
    "safetyStock" DECIMAL(18,4),
    "reorderPoint" DECIMAL(18,4),
    "unit" TEXT,
    "status" TEXT,
    "riskLevel" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT NOT NULL,
    "itemName" TEXT,
    "warehouseId" TEXT,
    "location" TEXT,
    "quantity" DECIMAL(18,4),
    "qaStatus" TEXT,
    "expiryDate" TIMESTAMP(3),
    "supplierId" TEXT,
    "supplierName" TEXT,
    "sourceDocument" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySerial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT NOT NULL,
    "itemName" TEXT,
    "warehouseId" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "owner" TEXT,
    "sourceDocument" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySerial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT NOT NULL,
    "itemName" TEXT,
    "warehouseId" TEXT,
    "location" TEXT,
    "movementType" TEXT NOT NULL,
    "movementLabel" TEXT,
    "movementDate" TIMESTAMP(3),
    "sourceDocument" TEXT,
    "quantityIn" DECIMAL(18,4),
    "quantityOut" DECIMAL(18,4),
    "adjustmentQty" DECIMAL(18,4),
    "status" TEXT NOT NULL DEFAULT 'registered',
    "owner" TEXT,
    "unit" TEXT,
    "relatedPoId" TEXT,
    "relatedGrnId" TEXT,
    "relatedReturnId" TEXT,
    "relatedSalesOrderId" TEXT,
    "inventoryImpact" TEXT,
    "reason" TEXT,
    "evidence" JSONB,
    "timeline" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemId" TEXT,
    "sku" TEXT,
    "itemName" TEXT,
    "warehouseId" TEXT,
    "location" TEXT,
    "quantityImpact" DECIMAL(18,4),
    "unit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "owner" TEXT,
    "linkedMovementId" TEXT,
    "linkedDocument" TEXT,
    "nextAction" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_name_idx" ON "Supplier"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Item_tenantId_name_idx" ON "Item"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_tenantId_sku_key" ON "Item"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_tenantId_code_key" ON "Warehouse"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTerm_tenantId_code_key" ON "PaymentTerm"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCode_tenantId_code_key" ON "TaxCode"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ActionDraft_tenantId_type_status_idx" ON "ActionDraft"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "ActionDraft_tenantId_createdAt_idx" ON "ActionDraft"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionDraftValidation_actionDraftId_idx" ON "ActionDraftValidation"("actionDraftId");

-- CreateIndex
CREATE INDEX "ActionDraftAuditTrail_actionDraftId_createdAt_idx" ON "ActionDraftAuditTrail"("actionDraftId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiEvidence_tenantId_entityType_entityId_idx" ON "AiEvidence"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_tenantId_status_idx" ON "PurchaseRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_tenantId_createdAt_idx" ON "PurchaseRequest"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_purchaseRequestId_idx" ON "PurchaseRequestLine"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "Rfq_tenantId_status_idx" ON "Rfq"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Rfq_tenantId_dueDate_idx" ON "Rfq"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "RfqLine_rfqId_idx" ON "RfqLine"("rfqId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_tenantId_rfqId_idx" ON "SupplierQuotation"("tenantId", "rfqId");

-- CreateIndex
CREATE INDEX "SupplierQuotation_tenantId_supplierName_idx" ON "SupplierQuotation"("tenantId", "supplierName");

-- CreateIndex
CREATE INDEX "SupplierQuotationLine_supplierQuotationId_idx" ON "SupplierQuotationLine"("supplierQuotationId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_status_idx" ON "PurchaseOrder"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_tenantId_expectedDate_idx" ON "PurchaseOrder"("tenantId", "expectedDate");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "ReceivingDocument_tenantId_status_idx" ON "ReceivingDocument"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ReceivingDocument_tenantId_poId_idx" ON "ReceivingDocument"("tenantId", "poId");

-- CreateIndex
CREATE INDEX "ReceivingLine_receivingDocumentId_idx" ON "ReceivingLine"("receivingDocumentId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_tenantId_status_idx" ON "SupplierInvoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SupplierInvoice_tenantId_relatedPoId_idx" ON "SupplierInvoice"("tenantId", "relatedPoId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceLine_supplierInvoiceId_idx" ON "SupplierInvoiceLine"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "ThreeWayMatch_tenantId_status_idx" ON "ThreeWayMatch"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ThreeWayMatch_tenantId_invoiceId_idx" ON "ThreeWayMatch"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "DocumentLink_tenantId_sourceType_sourceId_idx" ON "DocumentLink"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "DocumentLink_tenantId_targetType_targetId_idx" ON "DocumentLink"("tenantId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ProcurementFollowup_tenantId_status_severity_idx" ON "ProcurementFollowup"("tenantId", "status", "severity");

-- CreateIndex
CREATE INDEX "ProcurementFollowup_tenantId_documentType_documentId_idx" ON "ProcurementFollowup"("tenantId", "documentType", "documentId");

-- CreateIndex
CREATE INDEX "InventoryBalance_tenantId_sku_idx" ON "InventoryBalance"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventoryBalance_tenantId_warehouseId_idx" ON "InventoryBalance"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventoryLot_tenantId_sku_idx" ON "InventoryLot"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventoryLot_tenantId_warehouseId_idx" ON "InventoryLot"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "InventorySerial_tenantId_sku_idx" ON "InventorySerial"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventorySerial_tenantId_status_idx" ON "InventorySerial"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_sku_idx" ON "InventoryMovement"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_movementDate_idx" ON "InventoryMovement"("tenantId", "movementDate");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_status_idx" ON "InventoryMovement"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryException_tenantId_status_idx" ON "InventoryException"("tenantId", "status");

-- CreateIndex
CREATE INDEX "InventoryException_tenantId_sku_idx" ON "InventoryException"("tenantId", "sku");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_preferredSupplierId_fkey" FOREIGN KEY ("preferredSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTerm" ADD CONSTRAINT "PaymentTerm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCode" ADD CONSTRAINT "TaxCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraft" ADD CONSTRAINT "ActionDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraft" ADD CONSTRAINT "ActionDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraftValidation" ADD CONSTRAINT "ActionDraftValidation_actionDraftId_fkey" FOREIGN KEY ("actionDraftId") REFERENCES "ActionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionDraftAuditTrail" ADD CONSTRAINT "ActionDraftAuditTrail_actionDraftId_fkey" FOREIGN KEY ("actionDraftId") REFERENCES "ActionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvidence" ADD CONSTRAINT "AiEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_supplierQuotationId_fkey" FOREIGN KEY ("supplierQuotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDocument" ADD CONSTRAINT "ReceivingDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_receivingDocumentId_fkey" FOREIGN KEY ("receivingDocumentId") REFERENCES "ReceivingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceLine" ADD CONSTRAINT "SupplierInvoiceLine_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreeWayMatch" ADD CONSTRAINT "ThreeWayMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementFollowup" ADD CONSTRAINT "ProcurementFollowup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySerial" ADD CONSTRAINT "InventorySerial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryException" ADD CONSTRAINT "InventoryException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
