import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createReceivingPostingCommandService } from './receiving-posting-command-service.mjs'
import { createReceivingWorkbenchQueryService } from './receiving-workbench-query-service.mjs'
import { cleanupReceivingScenario, expectCommandError, seedReceivingScenario, withLiveReceivingDatabase } from './receiving-posting-live-test-helpers.mjs'

test('database receiving workbench query service is tenant-scoped, read-only, and fixed-scale', async (t) => {
  await withLiveReceivingDatabase(t, async ({ prisma }) => {
    const scenario = await seedReceivingScenario(prisma)
    const other = await seedReceivingScenario(prisma)
    try {
      const service = createReceivingWorkbenchQueryService({ prisma, capabilities: { posting: { enabled: true, maturity: 'beta' }, reversal: { enabled: true, maturity: 'beta' } } })
      const detail = await service.getReceivingDetail({ receivingDocumentId: scenario.receivingDocumentId }, { identity: scenario.actor })
      assert.equal(detail.receivingDocument.workflowStatus, 'approved')
      assert.equal(detail.receivingDocument.postingStatus, 'unposted')
      assert.equal(detail.purchaseOrder.workflowStatus, 'issued')
      assert.equal(detail.purchaseOrder.fulfillmentStatus, 'not_received')
      assert.equal(detail.lines[0].acceptedQuantity, '4.0000')
      assert.equal(detail.lines[0].lotSerialCapability.postingAvailable, false)

      const before = {
        movements: await prisma.inventoryMovement.count(), balances: await prisma.inventoryBalance.count(),
        audits: await prisma.auditLog.count(), commands: await prisma.businessCommandExecution.count(),
      }
      const preview = await service.getReceivingImpactPreview({ receivingDocumentId: scenario.receivingDocumentId, operation: 'post' }, { identity: scenario.actor })
      assert.equal(preview.allowed, true)
      assert.equal(preview.inventoryImpacts[0].onHandBefore, '0.0000')
      assert.equal(preview.inventoryImpacts[0].onHandAfter, '4.0000')
      assert.equal(preview.statusImpact.poFulfillmentAfter, 'partially_received')
      assert.deepEqual({ movements: await prisma.inventoryMovement.count(), balances: await prisma.inventoryBalance.count(), audits: await prisma.auditLog.count(), commands: await prisma.businessCommandExecution.count() }, before)

      await expectCommandError(service.getReceivingDetail({ receivingDocumentId: other.receivingDocumentId }, { identity: scenario.actor }), 'RECEIVING_NOT_FOUND')
      const command = createReceivingPostingCommandService({ prisma, env: { NODE_ENV: 'test' } })
      await command.postReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'query-post' }, { identity: scenario.actor })
      const links = await service.getReceivingSmartLinks({ receivingDocumentId: scenario.receivingDocumentId }, { identity: scenario.actor })
      assert.equal(links.links.find((link) => link.label === 'Movements').count, 1)
      assert.equal(links.links.find((link) => link.label === 'Audit').count, 1)
      const evidence = await service.getReceivingEvidenceTimeline({ receivingDocumentId: scenario.receivingDocumentId }, { identity: scenario.actor })
      assert.equal(evidence.events.some((event) => event.type === 'business_fact' && event.event === 'inventory_movement_created'), true)
      assert.equal(evidence.events.some((event) => event.type === 'audit' && event.event === 'receiving_posted'), true)
      assert.equal(evidence.events.some((event) => event.type === 'limitation'), true)

      const reverse = await service.getReceivingImpactPreview({ receivingDocumentId: scenario.receivingDocumentId, operation: 'reverse' }, { identity: scenario.actor })
      assert.equal(reverse.allowed, true)
      await prisma.inventoryMovement.create({ data: { id: randomUUID(), tenantId: scenario.tenantId, itemId: scenario.items[0].itemId, sku: scenario.items[0].sku, warehouseId: scenario.warehouseId, location: 'A-01', locationKey: 'a-01', movementType: 'outbound_posting', sourceDocumentType: 'shipment', sourceDocumentId: randomUUID(), sourceDocumentLineId: randomUUID(), quantityIn: '0', quantityOut: '1', adjustmentQty: '0', status: 'posted', occurredAt: new Date(Date.now() + 1000), movementDate: new Date(Date.now() + 1000) } })
      const unsafe = await service.getReceivingImpactPreview({ receivingDocumentId: scenario.receivingDocumentId, operation: 'reverse' }, { identity: scenario.actor })
      assert.equal(unsafe.allowed, false)
      assert.equal(unsafe.blockingIssues.some((issue) => issue.code === 'RECEIVING_REVERSAL_NOT_SAFE'), true)
      const summary = await service.getPurchaseOrderReceivingSummary({ purchaseOrderId: scenario.poId }, { identity: scenario.actor })
      assert.equal(summary.receiptsCount, 1)
      assert.equal(summary.receivedQuantitySummary, '4.0000')
    } finally {
      await cleanupReceivingScenario(prisma, scenario)
      await cleanupReceivingScenario(prisma, other)
    }
  })
})
