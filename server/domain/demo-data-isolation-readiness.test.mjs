import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmptyDataset, DATA_MODES, resolveFlowchainDataMode } from './data-mode.mjs'
import { createAiUserScenarioDb } from './test-fixtures/ai-user-scenario.mjs'
import { summarizeDemoDataDryRun } from '../../scripts/demo-data-dry-run.mjs'
import { getAiProviderSafetyState } from './ai-provider-safety.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEMO_ID_PATTERN = /PO-2026-1282|SKU-00412|RFQ-26-0046|PR-2026-2401|GRN-202605-0418|INV-SZ-260601|SUP-SZXY/

function source(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('R160 data modes are explicit and keep demo out of empty and user modes', () => {
  assert.deepEqual(Object.keys(DATA_MODES).sort(), ['demo', 'empty', 'test', 'user'])
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'demo' }).readsDemoData, true)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'empty' }).readsDemoData, false)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'user' }).readsDemoData, false)
  assert.equal(resolveFlowchainDataMode({ FLOWCHAIN_DATA_MODE: 'test' }).dataSource, 'in-memory-test')
  assert.equal(createEmptyDataset({ mode: 'user' }).purchaseOrders.length, 0)
})

test('R160 user-like fixture and empty route tests prove data-driven AI boundaries', () => {
  const userFixture = JSON.stringify(createAiUserScenarioDb())
  assert.match(userFixture, /PO-USER-0001/)
  assert.match(userFixture, /RFQ-USER-0001/)
  assert.match(userFixture, /SKU-USER-0001/)
  assert.match(userFixture, /SUP-USER-0001/)
  assert.doesNotMatch(userFixture, DEMO_ID_PATTERN)

  assert.match(source('server', 'domain', 'ai-empty-data-mode.test.mjs'), /R153 empty dataset AI routes/)
  assert.match(source('server', 'domain', 'ai-user-data-fixture.test.mjs'), /R155 AI routes use user-like data ids/)
})

test('R160 demo clear remains dry-run only and cannot write protected demo data', () => {
  const packageJson = JSON.parse(source('package.json'))
  assert.equal(packageJson.scripts['demo:clear:dry-run'], 'node scripts/demo-data-dry-run.mjs clear')
  assert.equal(packageJson.scripts['demo:reset:dry-run'], 'node scripts/demo-data-dry-run.mjs reset')
  assert.equal(packageJson.scripts['demo:clear'], undefined)
  assert.equal(packageJson.scripts['demo:reset'], undefined)

  const summary = summarizeDemoDataDryRun({ purchaseOrders: [{ po: 'PO-X' }] }, { operation: 'clear' })
  assert.equal(summary.dryRun, true)
  assert.equal(summary.writesFiles, false)
  assert.equal(summary.deletesUserData, false)
})

test('R160 browser coverage includes demo UAT and gated empty-mode UAT', () => {
  assert.match(source('tests', 'browser', 'ai-copilot.spec.ts'), /PO-2026-1282/)
  const emptySpec = source('tests', 'browser', 'ai-empty-mode.spec.ts')
  assert.match(emptySpec, /FLOWCHAIN_DATA_MODE !== "empty"/)
  assert.match(emptySpec, /diagnostics\.dataMode\)\.toBe\("empty"\)/)
  assert.match(emptySpec, /not\.toContainText\(demoIds\)/)
})

test('R160 provider and mutation boundaries remain disabled by default', () => {
  const previous = process.env.AI_PROVIDER_ENABLED
  delete process.env.AI_PROVIDER_ENABLED
  try {
    assert.equal(getAiProviderSafetyState().enabled, false)
  } finally {
    if (previous === undefined) delete process.env.AI_PROVIDER_ENABLED
    else process.env.AI_PROVIDER_ENABLED = previous
  }

  assert.match(source('server', 'routes', 'scm-legacy.routes.mjs'), /if \(!dataMode\.writable\) return/)
  assert.match(source('server', 'routes', 'ai.routes.mjs'), /persist: false/)
})
