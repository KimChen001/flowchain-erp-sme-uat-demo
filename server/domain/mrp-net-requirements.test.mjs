import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMrpPlan,
  calculateNetRequirement,
  classifyMrpException,
  futureMonthLabels,
  plannedReleasePeriodFor,
  roundUpToBatch,
} from '../routes/mrp.routes.mjs'
import { assertNoMutation, deepCloneFixture, loadDemoDbSnapshot } from './json-adapter-contract-helpers.test.mjs'

test('roundUpToBatch honors MOQ and batch multiple', () => {
  assert.equal(roundUpToBatch(0, 20, 5), 0)
  assert.equal(roundUpToBatch(1, 20, 5), 20)
  assert.equal(roundUpToBatch(21, 20, 5), 25)
  assert.equal(roundUpToBatch(501, 500, 100), 600)
  assert.equal(roundUpToBatch(7, 0, 0), 7)
})

test('calculateNetRequirement makes gross scheduled and safety stock explicit', () => {
  assert.deepEqual(calculateNetRequirement({
    projectedAvailable: 50,
    scheduledReceipt: 20,
    grossRequirement: 90,
    safetyStock: 15,
  }), {
    availableBeforePlanning: -20,
    netRequirement: 35,
  })

  assert.deepEqual(calculateNetRequirement({
    projectedAvailable: 200,
    scheduledReceipt: 0,
    grossRequirement: 50,
    safetyStock: 30,
  }), {
    availableBeforePlanning: 150,
    netRequirement: 0,
  })
})

test('planned release periods apply lead time offset', () => {
  const labels = futureMonthLabels(4)

  assert.deepEqual(labels, ['26/6月', '26/7月', '26/8月', '26/9月'])
  assert.equal(plannedReleasePeriodFor(0, 2, labels), '立即释放')
  assert.equal(plannedReleasePeriodFor(2, 2, labels), '26/6月')
  assert.equal(plannedReleasePeriodFor(3, 1, labels), '26/8月')
})

test('exception classification separates urgent normal release and defer cancel', () => {
  assert.equal(classifyMrpException({
    plannedReceipt: 20,
    periodIndex: 0,
    leadTimePeriods: 2,
  }), '加急')

  assert.equal(classifyMrpException({
    plannedReceipt: 20,
    periodIndex: 2,
    leadTimePeriods: 1,
  }), '释放')

  assert.equal(classifyMrpException({
    plannedReceipt: 0,
    availableBeforePlanning: 260,
    safetyStock: 20,
    monthlyDemand: 100,
  }), '推迟/取消')

  assert.equal(classifyMrpException({
    plannedReceipt: 0,
    availableBeforePlanning: 100,
    safetyStock: 20,
    monthlyDemand: 100,
  }), '正常')
})

test('MRP plan schedule applies netting lot sizing and release semantics', () => {
  const db = loadDemoDbSnapshot()
  const before = deepCloneFixture(db)
  const plan = buildMrpPlan(db, { sku: 'SKU-00287', periods: 6 })
  const row = plan.rows[0]

  assert.equal(row.moq, 500)
  assert.equal(row.batchMultiple, 100)
  assert.equal(row.leadTimePeriods, 2)
  assert.ok(row.schedule.some((line) => line.scheduledReceipt > 0))
  assert.ok(row.schedule.some((line) => line.netRequirement > 0))
  assert.ok(row.schedule.every((line) => line.plannedReceipt === 0 || line.plannedReceipt >= row.moq))
  assert.ok(row.schedule.every((line) => line.plannedReceipt % row.batchMultiple === 0))
  assert.ok(row.schedule.every((line) => line.plannedRelease === line.plannedReceipt))
  assert.ok(row.schedule.some((line) => line.plannedReceipt > 0 && line.exception === '释放'))

  const releaseLine = row.schedule.find((line) => line.exception === '释放')
  const releaseIndex = row.schedule.findIndex((line) => line === releaseLine)
  assert.equal(releaseLine.plannedReleasePeriod, plan.periods[releaseIndex - row.leadTimePeriods])
  assertNoMutation(before, db)
})

test('MRP plan can surface urgent exceptions when lead time cannot be met', () => {
  const db = {
    products: [{
      sku: 'SKU-00412',
      name: '控制器主板 V3.2',
      category: '电气件',
      unit: '件',
      currentStock: 0,
      safetyStock: 20,
      monthlyDemand: 90,
    }],
  }
  const before = deepCloneFixture(db)
  const plan = buildMrpPlan(db, { sku: 'SKU-00412', periods: 2 })
  const row = plan.rows[0]

  assert.equal(row.exception, '加急')
  assert.equal(row.schedule[0].exception, '加急')
  assert.equal(row.schedule[0].plannedReleasePeriod, '立即释放')
  assert.ok(row.totalPlannedReceipt > 0)
  assert.equal(plan.summary.urgentCount, 1)
  assertNoMutation(before, db)
})
