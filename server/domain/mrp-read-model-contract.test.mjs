import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMrpPlan, handleMrpRoute } from '../routes/mrp.routes.mjs'
import { assertNoMutation, deepCloneFixture, loadDemoDbSnapshot } from './json-adapter-contract-helpers.test.mjs'

function sendRecorder() {
  const calls = []
  return {
    calls,
    send(res, status, payload) {
      calls.push({ res, status, payload })
      return true
    },
  }
}

test('MRP read model exposes explicit planning contract and source metadata', () => {
  const db = loadDemoDbSnapshot()
  const before = deepCloneFixture(db)
  const plan = buildMrpPlan(db, { periods: 6, sku: 'SKU-00412' })

  assert.equal(plan.horizon, 6)
  assert.equal(plan.periods.length, 6)
  assert.equal(plan.sourceMetadata.generatedFrom, 'json-products-plus-static-planning-profile')
  assert.equal(plan.sourceMetadata.persistence, 'read-only-generated-plan')
  assert.equal(plan.summary.skuCount, 1)
  assert.equal(plan.rows.length, 1)

  const row = plan.rows[0]
  assert.equal(row.sku, 'SKU-00412')
  assert.equal(typeof row.name, 'string')
  assert.equal(typeof row.unit, 'string')
  assert.equal(row.sourceMetadata.profileSource, 'static-profile')
  assert.equal(row.sourceMetadata.hasStaticBom, true)
  assert.equal(row.sourceMetadata.staticBomSource, plan.sourceMetadata.staticBomSource)

  for (const field of [
    'onHand',
    'allocated',
    'safetyStock',
    'moq',
    'batchMultiple',
    'leadTimePeriods',
    'totalPlannedReceipt',
    'maxNetRequirement',
    'amount',
  ]) {
    assert.equal(typeof row[field], 'number', `${field} should be numeric`)
  }

  const line = row.schedule[0]
  assert.equal(line.period, plan.periods[0])
  assert.equal(typeof line.independentDemand, 'number')
  assert.equal(typeof line.dependentDemand, 'number')
  assert.equal(line.grossRequirement, line.independentDemand + line.dependentDemand)
  assert.equal(typeof line.scheduledReceipt, 'number')
  assert.equal(typeof line.inventoryPositionBeforePlanning, 'number')
  assert.equal(typeof line.projectedAvailable, 'number')
  assert.equal(typeof line.netRequirement, 'number')
  assert.equal(typeof line.plannedReceipt, 'number')
  assert.equal(line.plannedRelease, line.plannedReceipt)
  assert.equal(line.releasePeriod, line.plannedReleasePeriod)
  assert.equal(line.generatedFrom, plan.sourceMetadata.generatedFrom)
  assert.match(line.bomSource, /bomMaster|none/)
  assert.match(line.exception, /正常|加急|释放|推迟\/取消/)

  assert.ok(row.bomSources?.length > 0)
  assert.ok(row.schedule.some((entry) => entry.dependentDemandSources?.length > 0))
  assertNoMutation(before, db)
})

test('MRP route handles GET /api/mrp-plan as read-only contract response', async () => {
  const db = loadDemoDbSnapshot()
  const before = deepCloneFixture(db)
  const recorder = sendRecorder()
  const handled = await handleMrpRoute({
    req: { method: 'GET' },
    res: {},
    url: new URL('http://local.test/api/mrp-plan?periods=4&sku=SKU-00287'),
    db,
    send: recorder.send,
  })

  assert.equal(handled, true)
  assert.equal(recorder.calls[0].status, 200)
  assert.equal(recorder.calls[0].payload.horizon, 4)
  assert.deepEqual(recorder.calls[0].payload.rows.map((row) => row.sku), ['SKU-00287'])
  assert.equal(recorder.calls[0].payload.rows[0].schedule.length, 4)
  assert.equal(recorder.calls[0].payload.sourceMetadata.persistence, 'read-only-generated-plan')
  assertNoMutation(before, db)
})
