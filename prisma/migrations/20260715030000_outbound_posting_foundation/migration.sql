CREATE TABLE "SalesOrder" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "orderNumber" TEXT NOT NULL,
  "customerId" TEXT, "customerName" TEXT NOT NULL, "workflowStatus" TEXT NOT NULL DEFAULT 'draft',
  "reservationStatus" TEXT NOT NULL DEFAULT 'not_reserved', "fulfillmentStatus" TEXT NOT NULL DEFAULT 'not_fulfilled',
  "promisedDate" TIMESTAMP(3), "currency" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesOrder_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "SalesOrder_workflow_check" CHECK ("workflowStatus" IN ('draft','confirmed','on_hold','cancelled','closed')),
  CONSTRAINT "SalesOrder_reservation_check" CHECK ("reservationStatus" IN ('not_reserved','partially_reserved','fully_reserved')),
  CONSTRAINT "SalesOrder_fulfillment_check" CHECK ("fulfillmentStatus" IN ('not_fulfilled','partially_fulfilled','fully_fulfilled'))
);

CREATE TABLE "SalesOrderLine" (
  "id" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "itemId" TEXT NOT NULL, "sku" TEXT NOT NULL,
  "itemName" TEXT NOT NULL, "orderedQuantity" DECIMAL(18,4) NOT NULL,
  "reservedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0, "fulfilledQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesOrderLine_quantity_check" CHECK ("orderedQuantity" > 0 AND "reservedQuantity" >= 0 AND "fulfilledQuantity" >= 0 AND "reservedQuantity" + "fulfilledQuantity" <= "orderedQuantity")
);

CREATE TABLE "InventoryReservation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "salesOrderLineId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL, "sku" TEXT NOT NULL, "warehouseId" TEXT NOT NULL, "location" TEXT,
  "locationKey" TEXT NOT NULL DEFAULT '', "reservedQuantity" DECIMAL(18,4) NOT NULL,
  "allocatedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0, "consumedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "releasedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 0, "reservedById" TEXT NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "metadata" JSONB,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryReservation_quantity_check" CHECK ("reservedQuantity" >= 0 AND "allocatedQuantity" >= 0 AND "consumedQuantity" >= 0 AND "releasedQuantity" >= 0 AND "consumedQuantity" + "releasedQuantity" <= "reservedQuantity" AND "allocatedQuantity" <= "reservedQuantity" - "consumedQuantity" - "releasedQuantity")
);

CREATE TABLE "InventoryReservationEvent" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "reservationId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL, "commandType" TEXT NOT NULL, "commandExecutionId" TEXT,
  "actorId" TEXT NOT NULL, "reason" TEXT, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryReservationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryReservationEvent_type_check" CHECK ("eventType" IN ('reserved','released','allocated','deallocated','consumed','restored')),
  CONSTRAINT "InventoryReservationEvent_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "ShipmentDocument" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "shipmentNumber" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL,
  "workflowStatus" TEXT NOT NULL DEFAULT 'draft', "postingStatus" TEXT NOT NULL DEFAULT 'unposted',
  "postedAt" TIMESTAMP(3), "postedById" TEXT, "reversedAt" TIMESTAMP(3), "reversedById" TEXT,
  "reversalReason" TEXT, "version" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentDocument_workflow_check" CHECK ("workflowStatus" IN ('draft','ready','cancelled')),
  CONSTRAINT "ShipmentDocument_posting_check" CHECK ("postingStatus" IN ('unposted','posted','reversed'))
);

CREATE TABLE "ShipmentLine" (
  "id" TEXT NOT NULL, "shipmentId" TEXT NOT NULL, "salesOrderLineId" TEXT NOT NULL, "itemId" TEXT NOT NULL,
  "sku" TEXT NOT NULL, "requestedQuantity" DECIMAL(18,4) NOT NULL, "postedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  CONSTRAINT "ShipmentLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentLine_quantity_check" CHECK ("requestedQuantity" > 0 AND "postedQuantity" >= 0 AND "postedQuantity" <= "requestedQuantity")
);

CREATE TABLE "ShipmentAllocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "shipmentLineId" TEXT NOT NULL, "reservationId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL, "location" TEXT, "locationKey" TEXT NOT NULL DEFAULT '',
  "quantity" DECIMAL(18,4) NOT NULL, "status" TEXT NOT NULL DEFAULT 'allocated', "version" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
  CONSTRAINT "ShipmentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShipmentAllocation_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "ShipmentAllocation_status_check" CHECK ("status" IN ('allocated','consumed','deallocated','reversed'))
);

CREATE UNIQUE INDEX "SalesOrder_tenantId_orderNumber_key" ON "SalesOrder"("tenantId", "orderNumber");
CREATE INDEX "SalesOrder_tenantId_workflowStatus_idx" ON "SalesOrder"("tenantId", "workflowStatus");
CREATE INDEX "SalesOrder_tenantId_reservationStatus_idx" ON "SalesOrder"("tenantId", "reservationStatus");
CREATE INDEX "SalesOrder_tenantId_fulfillmentStatus_idx" ON "SalesOrder"("tenantId", "fulfillmentStatus");
CREATE INDEX "SalesOrder_tenantId_promisedDate_idx" ON "SalesOrder"("tenantId", "promisedDate");
CREATE INDEX "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");
CREATE INDEX "SalesOrderLine_itemId_sku_idx" ON "SalesOrderLine"("itemId", "sku");
CREATE INDEX "InventoryReservation_tenantId_salesOrderId_idx" ON "InventoryReservation"("tenantId", "salesOrderId");
CREATE INDEX "InventoryReservation_tenantId_salesOrderLineId_idx" ON "InventoryReservation"("tenantId", "salesOrderLineId");
CREATE INDEX "InventoryReservation_tenantId_sku_warehouseId_locationKey_idx" ON "InventoryReservation"("tenantId", "sku", "warehouseId", "locationKey");
CREATE INDEX "InventoryReservation_tenantId_status_idx" ON "InventoryReservation"("tenantId", "status");
CREATE INDEX "InventoryReservationEvent_tenantId_reservationId_createdAt_idx" ON "InventoryReservationEvent"("tenantId", "reservationId", "createdAt");
CREATE INDEX "InventoryReservationEvent_tenantId_commandExecutionId_idx" ON "InventoryReservationEvent"("tenantId", "commandExecutionId");
CREATE UNIQUE INDEX "ShipmentDocument_tenantId_shipmentNumber_key" ON "ShipmentDocument"("tenantId", "shipmentNumber");
CREATE INDEX "ShipmentDocument_tenantId_salesOrderId_idx" ON "ShipmentDocument"("tenantId", "salesOrderId");
CREATE INDEX "ShipmentDocument_tenantId_postingStatus_idx" ON "ShipmentDocument"("tenantId", "postingStatus");
CREATE INDEX "ShipmentDocument_tenantId_workflowStatus_idx" ON "ShipmentDocument"("tenantId", "workflowStatus");
CREATE INDEX "ShipmentLine_shipmentId_idx" ON "ShipmentLine"("shipmentId");
CREATE INDEX "ShipmentLine_salesOrderLineId_idx" ON "ShipmentLine"("salesOrderLineId");
CREATE INDEX "ShipmentAllocation_tenantId_shipmentLineId_idx" ON "ShipmentAllocation"("tenantId", "shipmentLineId");
CREATE INDEX "ShipmentAllocation_tenantId_reservationId_idx" ON "ShipmentAllocation"("tenantId", "reservationId");
CREATE INDEX "ShipmentAllocation_tenantId_warehouseId_locationKey_idx" ON "ShipmentAllocation"("tenantId", "warehouseId", "locationKey");
CREATE INDEX "ShipmentAllocation_tenantId_status_idx" ON "ShipmentAllocation"("tenantId", "status");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_reservedById_fkey" FOREIGN KEY ("reservedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationEvent" ADD CONSTRAINT "InventoryReservationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationEvent" ADD CONSTRAINT "InventoryReservationEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationEvent" ADD CONSTRAINT "InventoryReservationEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentDocument" ADD CONSTRAINT "ShipmentDocument_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "ShipmentDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentLine" ADD CONSTRAINT "ShipmentLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentAllocation" ADD CONSTRAINT "ShipmentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentAllocation" ADD CONSTRAINT "ShipmentAllocation_shipmentLineId_fkey" FOREIGN KEY ("shipmentLineId") REFERENCES "ShipmentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentAllocation" ADD CONSTRAINT "ShipmentAllocation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentAllocation" ADD CONSTRAINT "ShipmentAllocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
