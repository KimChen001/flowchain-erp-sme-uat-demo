import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createReceivingPostingCommandService } from './receiving-posting-command-service.mjs'
import { cleanupReceivingScenario, expectCommandError, seedReceivingScenario, withLiveReceivingDatabase } from './receiving-posting-live-test-helpers.mjs'

test('database receiving reversal preserves history, restores state, and fails closed on unsafe use', async (t) => {
  await withLiveReceivingDatabase(t, async ({ prisma }) => {
    await t.test('reversal creates a linked reverse movement and restores balance and PO progress', async () => {
      const scenario = await seedReceivingScenario(prisma)
      try {
        const service = createReceivingPostingCommandService({ prisma })
        const posted = await service.postReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'post-before-reverse' }, { identity: scenario.actor })
        const originalMovementId = posted.movements[0].id
        const reversed = await service.reverseReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'reverse-safe', reason: 'Incorrect receiving quantity' }, { identity: scenario.actor })
        assert.equal(reversed.receivingDocument.postingStatus, 'reversed')
        assert.equal(reversed.purchaseOrder.status, 'issued')
        assert.equal(reversed.movements[0].movementType, 'receipt_reversal')
        assert.equal(reversed.movements[0].reversalOfMovementId, originalMovementId)
        const original = await prisma.inventoryMovement.findUnique({ where: { id: originalMovementId } })
        assert.equal(original.quantityIn.toString(), '4')
        assert.equal(original.reversedByMovementId, reversed.movements[0].id)
        const balance = await prisma.inventoryBalance.findFirst({ where: { tenantId: scenario.tenantId } })
        assert.equal(balance.onHandQuantity.toString(), '0')
        assert.equal(balance.availableQuantity.toString(), '0')
        const reconciliation = await service.reconcileInventoryBalance({ tenantId: scenario.tenantId, sku: scenario.items[0].sku, warehouseId: scenario.warehouseId, location: 'A-01' })
        assert.equal(reconciliation.calculatedOnHandQuantity, '0.0000')
        assert.equal(reconciliation.matches, true)
        assert.equal(await prisma.auditLog.count({ where: { tenantId: scenario.tenantId } }), 2)
        await expectCommandError(service.reverseReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'reverse-twice', reason: 'Duplicate reversal' }, { identity: scenario.actor }), 'RECEIVING_ALREADY_REVERSED')
        assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: scenario.tenantId, movementType: 'receipt_reversal' } }), 1)
      } finally {
        await cleanupReceivingScenario(prisma, scenario)
      }
    })

    await t.test('explicit downstream outbound movement blocks reversal without partial writes', async () => {
      const scenario = await seedReceivingScenario(prisma)
      try {
        const service = createReceivingPostingCommandService({ prisma })
        const posted = await service.postReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'post-before-unsafe-reverse' }, { identity: scenario.actor })
        await prisma.inventoryMovement.create({
          data: {
            id: randomUUID(), tenantId: scenario.tenantId, itemId: scenario.items[0].itemId, sku: scenario.items[0].sku,
            warehouseId: scenario.warehouseId, location: 'A-01', locationKey: 'a-01', movementType: 'outbound_posting',
            sourceDocumentType: 'shipment', sourceDocumentId: `shipment-${randomUUID()}`, sourceDocumentLineId: `shipment-line-${randomUUID()}`,
            quantityIn: '0', quantityOut: '1', adjustmentQty: '0', status: 'posted', actorId: scenario.actor.userId,
            occurredAt: new Date(Date.now() + 1_000), movementDate: new Date(Date.now() + 1_000), postingBatchId: randomUUID(),
          },
        })
        await expectCommandError(service.reverseReceiving({ receivingDocumentId: scenario.receivingDocumentId, idempotencyKey: 'reverse-unsafe', reason: 'Should be blocked' }, { identity: scenario.actor }), 'RECEIVING_REVERSAL_NOT_SAFE')
        assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: scenario.tenantId, movementType: 'receipt_reversal' } }), 0)
        assert.equal((await prisma.receivingDocument.findUnique({ where: { id: scenario.receivingDocumentId } })).postingStatus, 'posted')
        assert.equal((await prisma.inventoryMovement.findUnique({ where: { id: posted.movements[0].id } })).quantityIn.toString(), '4')
      } finally {
        await cleanupReceivingScenario(prisma, scenario)
      }
    })
  })
})

