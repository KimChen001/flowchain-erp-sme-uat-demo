import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { summarizeDemoDataDryRun } from '../../scripts/demo-data-dry-run.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const demoDataPath = path.join(repoRoot, 'data', 'scm-demo.json')

function fileSnapshot(filePath) {
  const body = readFileSync(filePath)
  const info = statSync(filePath)
  return {
    size: info.size,
    mtimeMs: info.mtimeMs,
    hash: createHash('sha256').update(body).digest('hex'),
  }
}

function runNodeScript(operation) {
  return spawnSync(process.execPath, ['scripts/demo-data-dry-run.mjs', operation], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

function runNpmScript(scriptName) {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `npm run ${scriptName} --silent`]
    : ['run', scriptName, '--silent']
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
}

test('R157 demo data dry-run summarizes seed clear and reset without write intent', () => {
  const source = {
    purchaseOrders: [{ po: 'PO-X' }],
    purchaseRequests: [{ pr: 'PR-X' }],
    rfqs: [{ id: 'RFQ-X' }],
    products: [{ sku: 'SKU-X' }],
    receivingDocs: [{ grn: 'GRN-X' }],
    supplierInvoices: [{ invoiceNumber: 'INV-X' }],
    suppliers: [{ id: 'SUP-X' }],
  }

  for (const operation of ['seed', 'clear', 'reset']) {
    const summary = summarizeDemoDataDryRun(source, { operation })
    assert.equal(summary.dryRun, true)
    assert.equal(summary.writesFiles, false)
    assert.equal(summary.deletesUserData, false)
    assert.equal(summary.counts.purchaseOrders, 1)
    assert.equal(summary.protectedSource, 'data/scm-demo.json')
  }
})

test('R158 demo clear dry-run does not mutate protected demo data file', () => {
  const before = fileSnapshot(demoDataPath)
  const result = runNpmScript('demo:clear:dry-run')
  const after = fileSnapshot(demoDataPath)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(after.hash, before.hash)
  assert.equal(after.size, before.size)
  assert.equal(after.mtimeMs, before.mtimeMs)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.operation, 'clear')
  assert.equal(payload.dryRun, true)
  assert.equal(payload.writesFiles, false)
  assert.ok(payload.counts.purchaseOrders >= 0)
})

test('R158 demo seed and reset dry-runs are read-only and report counts', () => {
  for (const operation of ['seed', 'reset']) {
    const before = fileSnapshot(demoDataPath)
    const result = runNodeScript(operation)
    const after = fileSnapshot(demoDataPath)
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(after.hash, before.hash)
    assert.equal(after.size, before.size)
    assert.equal(after.mtimeMs, before.mtimeMs)
    const payload = JSON.parse(result.stdout)
    assert.equal(payload.operation, operation)
    assert.equal(payload.dryRun, true)
    assert.equal(payload.writesFiles, false)
    assert.ok(payload.counts.suppliers >= 0)
  }
})

test('R158 package exposes only dry-run demo data scripts', () => {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  assert.equal(packageJson.scripts['demo:seed:dry-run'], 'node scripts/demo-data-dry-run.mjs seed')
  assert.equal(packageJson.scripts['demo:clear:dry-run'], 'node scripts/demo-data-dry-run.mjs clear')
  assert.equal(packageJson.scripts['demo:reset:dry-run'], 'node scripts/demo-data-dry-run.mjs reset')
  assert.equal(packageJson.scripts['demo:clear'], undefined)
  assert.equal(packageJson.scripts['demo:reset'], undefined)
})
