import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

export function deepCloneFixture(value) {
  return JSON.parse(JSON.stringify(value))
}

export function loadDemoDbSnapshot() {
  const raw = readFileSync(new URL('../../data/scm-demo.json', import.meta.url), 'utf8')
  return JSON.parse(raw)
}

export function assertNoMutation(before, after, message = 'contract must not mutate demo db') {
  assert.deepEqual(after, before, message)
}

export function expectNoSecrets(value) {
  const text = JSON.stringify(value)
  assert.doesNotMatch(text, /(^|[^A-Za-z0-9_])sk-[A-Za-z0-9._-]{12,}/)
  assert.doesNotMatch(text, /Bearer\s+[A-Za-z0-9._~+/=-]+/i)
  assert.doesNotMatch(text, /OPENAI_API_KEY|ARK_API_KEY|DOUBAO_API_KEY|DATABASE_URL/)
}

export function expectNoStackTrace(value) {
  const text = JSON.stringify(value)
  assert.doesNotMatch(text, /\bError:\s/)
  assert.doesNotMatch(text, /\bat\s+\w+/)
  assert.doesNotMatch(text, /node:internal/)
}

export function expectPreviewOnly(result) {
  const draft = result?.draft || result
  assert.equal(draft?.requiresConfirmation, true)
  assert.equal(draft?.confirmationBoundary?.previewOnly, true)
  assert.equal(draft?.confirmationBoundary?.submitted, false)
}

export function expectCanonicalEvidence(item = {}) {
  assert.equal(typeof item.type, 'string')
  assert.equal(typeof item.id, 'string')
  if (item.route) assert.match(item.route, /^\/api\//)
}

export function expectStableTopLevelFields(value = {}, fields = []) {
  assert.deepEqual(Object.keys(value), fields)
}
