import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { buildDataAccessQualityV2, FORBIDDEN_DATA_ACCESS_ACTION_PATTERN, FORBIDDEN_DATA_ACCESS_TECHNICAL_PATTERN } from './data-access-quality-v2.mjs'
import { buildOperationsControlTowerV2 } from './operations-control-tower-v2.mjs'

function loadDb() {
  return JSON.parse(fs.readFileSync(new URL('../../data/scm-demo.json', import.meta.url), 'utf8'))
}

function visibleText(value) {
  if (Array.isArray(value)) return value.map(visibleText).join(' ')
  if (!value || typeof value !== 'object') return String(value ?? '')
  return Object.entries(value)
    .filter(([key]) => !/entityType|documentType|canonicalField|draftType|actionType|payload|provider|fastPath|tool_result/i.test(key))
    .map(([, item]) => visibleText(item))
    .join(' ')
}

test('data access quality v2 returns expected top-level contract', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  for (const key of ['summary', 'sources', 'fieldMappings', 'qualityIssues', 'relationshipGaps', 'evidenceGaps', 'downstreamImpacts', 'recommendedFixes', 'dataLimitations', 'generatedAt', 'dataScopeLabel']) {
    assert.ok(Object.hasOwn(quality, key), key)
  }
  assert.ok(quality.summary.sourceCount >= 7)
  assert.ok(quality.summary.connectedSourceCount >= 5)
  assert.ok(quality.summary.mappedFieldCount >= 1)
  assert.ok(quality.summary.unmappedFieldCount >= 1)
  assert.ok(quality.summary.criticalIssueCount >= 0)
  assert.ok(quality.summary.warningIssueCount >= 0)
  assert.ok(quality.summary.relationshipGapCount >= 0)
  assert.ok(quality.summary.evidenceGapCount >= 0)
})

test('sources cover core business areas', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  const areas = quality.sources.map((source) => source.businessArea)
  for (const area of ['Procurement / PR', 'RFQ / Sourcing', 'PO', 'Receiving / GRN', 'Invoice / Three-way Match', 'Supplier', 'Inventory']) {
    assert.ok(areas.includes(area), area)
  }
})

test('quality issues cover required data gaps', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  const categories = new Set(quality.qualityIssues.map((issue) => issue.category))
  for (const category of ['missing_supplier_response', 'missing_grn_evidence', 'missing_invoice_line', 'missing_supplier_profile_evidence', 'unmapped_field', 'data_quality_gap']) {
    assert.ok(categories.has(category), category)
  }
  assert.ok(quality.qualityIssues.every((issue) => issue.navigationLinks.length >= 1))
  assert.ok(quality.qualityIssues.every((issue) => issue.reviewActions.every((action) => action.previewOnly && action.requiresHumanReview)))
})

test('relationship and evidence gaps include business chain breaks', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  const relationships = quality.relationshipGaps.map((gap) => gap.missingRelationship).join(' | ')
  for (const expected of ['PR → RFQ / PO', 'PO → GRN', 'GRN → Invoice', 'Supplier → Transaction Evidence', 'SKU → Inventory / Procurement Evidence']) {
    assert.match(relationships, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  const evidence = quality.evidenceGaps.map((gap) => `${gap.evidenceType} ${gap.missingEvidence}`).join(' | ')
  assert.match(evidence, /供应商报价回复/)
  assert.match(evidence, /收货行/)
  assert.match(evidence, /发票行/)
})

test('downstream impacts align with AI and risk workspace', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  const targets = quality.downstreamImpacts.map((impact) => impact.target)
  assert.ok(targets.includes('AI Response Contract v2'))
  assert.ok(targets.includes('风险与异常'))
  assert.ok(targets.includes('Supplier Operational Profile'))
  assert.ok(targets.includes('Three-way Match'))
  assert.ok(quality.downstreamImpacts.every((impact) => impact.relatedIssueIds.length >= 1))
})

test('recommended fixes are preview-only and human reviewed', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  assert.ok(quality.recommendedFixes.length >= 3)
  assert.ok(quality.recommendedFixes.every((fix) => fix.previewOnly === true))
  assert.ok(quality.recommendedFixes.every((fix) => fix.requiresHumanReview === true))
  assert.ok(quality.recommendedFixes.every((fix) => fix.prohibitedActions.length >= 5))
})

test('visible text avoids forbidden execution and technical wording', () => {
  const quality = buildDataAccessQualityV2(loadDb())
  const text = visibleText(quality)
  assert.doesNotMatch(text, FORBIDDEN_DATA_ACCESS_ACTION_PATTERN)
  assert.doesNotMatch(text, FORBIDDEN_DATA_ACCESS_TECHNICAL_PATTERN)
})

test('empty data returns limitations and quality issues without throwing', () => {
  const quality = buildDataAccessQualityV2({})
  assert.ok(quality.summary.sourceCount >= 7)
  assert.ok(quality.dataLimitations.length >= 1)
  assert.ok(quality.qualityIssues.some((issue) => issue.category === 'unmapped_field'))
  assert.ok(quality.evidenceGaps.length >= 1)
})

test('data quality issue aligns with operations control tower data quality gap', () => {
  const db = loadDb()
  const quality = buildDataAccessQualityV2(db)
  const tower = buildOperationsControlTowerV2(db)
  const towerGap = tower.items.find((item) => item.category === 'data_quality_gap')
  assert.ok(towerGap)
  assert.ok(quality.qualityIssues.some((issue) =>
    issue.category === 'data_quality_gap'
    || issue.affectedModule === '风险与异常'
    || issue.businessObjectId === towerGap.entityId
  ))
})
