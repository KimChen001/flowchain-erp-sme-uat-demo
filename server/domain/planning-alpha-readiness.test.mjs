import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

test('planning readiness gate allows only optional guided Alpha scope', () => {
  const notes = fs.readFileSync(path.join(repoRoot, 'docs', 'planning-mrp-readiness-notes.md'), 'utf8')

  assert.match(notes, /Forecast\/MRP ready for optional guided Alpha scenario\./)
  assert.match(notes, /ActionDraft `purchase_request_draft` preview/)
  assert.match(notes, /confirmation remains intentionally disabled/)
  assert.match(notes, /Do not position it as autonomous MRP, production replenishment, or final PR\/PO release\./)
  assert.doesNotMatch(notes, /ready for production/i)
})
