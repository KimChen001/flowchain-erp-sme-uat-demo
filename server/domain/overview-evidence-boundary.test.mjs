import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('overview evidence builders are extracted from page composition', () => {
  const page = readSource('src', 'modules', 'overview', 'Page.tsx')
  const evidence = readSource('src', 'modules', 'overview', 'overviewEvidence.ts')

  assert.match(page, /from "\.\/overviewEvidence"/)
  assert.doesNotMatch(page, /function buildPrEvidence/)
  assert.doesNotMatch(page, /function buildPoEvidence/)
  assert.doesNotMatch(page, /function buildInventoryEvidence/)
  assert.doesNotMatch(page, /function evidenceRowsForExport/)
  assert.match(evidence, /export function buildPrEvidence/)
  assert.match(evidence, /export function buildPoEvidence/)
  assert.match(evidence, /export function buildInventoryEvidence/)
  assert.match(evidence, /export function buildRfqEvidence/)
  assert.match(evidence, /export function evidenceRowsForExport/)
})

test('overview evidence builders preserve module targets and export fields', () => {
  const evidence = readSource('src', 'modules', 'overview', 'overviewEvidence.ts')

  for (const moduleId of [
    'procurement:requests',
    'procurement:orders',
    'inventory:movements',
    'procurement:rfq',
    'procurement:receiving',
    'procurement:invoices',
    'srm:performance',
    'master-data',
  ]) {
    assert.match(evidence, new RegExp(moduleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const field of ['对象', '标题', '优先级', '模块', '证据项', '证据值', '业务原因', '建议动作']) {
    assert.match(evidence, new RegExp(field))
  }
})

test('overview page keeps UI state and Today Cockpit composition only', () => {
  const page = readSource('src', 'modules', 'overview', 'Page.tsx')

  assert.match(page, /useState<EvidenceDetail \| null>/)
  assert.match(page, /<TodayCockpitPanel\b/)
  assert.match(page, /exportRowsToCsv/)
  assert.match(page, /setSelectedEvidence/)
})
