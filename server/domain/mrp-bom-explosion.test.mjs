import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMrpPlan } from '../routes/mrp.routes.mjs'
import { assertNoMutation, deepCloneFixture, loadDemoDbSnapshot } from './json-adapter-contract-helpers.test.mjs'

function rowFor(sku, periods = 6) {
  const db = loadDemoDbSnapshot()
  const before = deepCloneFixture(db)
  const plan = buildMrpPlan(db, { sku, periods })
  assertNoMutation(before, db)
  return plan.rows[0]
}

test('BOM explosion traces multi-level phantom assembly component demand', () => {
  const row = rowFor('SKU-00412')
  const sources = row.schedule.flatMap((line) => line.dependentDemandSources || [])

  assert.ok(sources.some((source) => source.parent === 'SA-DRIVE-KIT'))
  assert.ok(sources.some((source) => source.top === 'FG-ROBOT-ARM'))
  assert.ok(sources.every((source) => source.level >= 1))

  const first = sources.find((source) => source.parent === 'SA-DRIVE-KIT')
  assert.equal(first.parentName, '伺服驱动套件')
  assert.equal(first.topName, '工业机器人关节模组')
  assert.equal(first.qtyPer, 2)
  assert.equal(first.scrapPct, 0.02)
  assert.equal(first.leadTimeOffset, 0)
  assert.equal(first.quantityContribution, first.demand)
  assert.equal(typeof first.sourcePeriodIndex, 'number')
  assert.equal(typeof first.requirementPeriodIndex, 'number')
})

test('BOM explosion applies scrap percentage and qty per deterministically', () => {
  const row = rowFor('SKU-00623')
  const firstLine = row.schedule[0]
  const source = firstLine.dependentDemandSources.find((entry) => entry.parent === 'FG-ROBOT-ARM')

  assert.equal(source.qtyPer, 1)
  assert.equal(source.scrapPct, 0.01)
  assert.equal(source.demand, Math.ceil(18 * 1 * 1.01))
  assert.equal(firstLine.dependentDemand, source.demand)
})

test('BOM explosion offsets dependent demand by child lead time', () => {
  const row = rowFor('SKU-00815')
  const firstLineSources = row.schedule[0].dependentDemandSources || []
  const offsetSource = firstLineSources.find((source) => source.parent === 'SA-DRIVE-KIT')

  assert.ok(offsetSource, 'lead-time-offset component should appear in earlier requirement bucket')
  assert.equal(offsetSource.leadTimeOffset, 1)
  assert.equal(offsetSource.sourcePeriodIndex, 1)
  assert.equal(offsetSource.requirementPeriodIndex, 0)
})

test('BOM explosion aggregates shared components from multiple top-level parents', () => {
  const row = rowFor('SKU-00287')

  assert.ok(row.bomSources.some((source) => source.top === 'FG-ROBOT-ARM'))
  assert.ok(row.bomSources.some((source) => source.top === 'FG-HYDRAULIC-STATION'))

  const periodSources = row.schedule.flatMap((line) => line.dependentDemandSources || [])
  assert.ok(periodSources.some((source) => source.parent === 'FG-ROBOT-ARM'))
  assert.ok(periodSources.some((source) => source.parent === 'FG-HYDRAULIC-STATION'))

  for (const source of row.bomSources) {
    assert.equal(typeof source.demand, 'number')
    assert.ok(source.demand > 0)
    assert.ok(Array.isArray(source.sourcePeriods))
    assert.ok(source.sourcePeriods.length > 0)
  }
})
