import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('R66 Alpha readiness classification is documented without production claims', () => {
  const review = readSource('docs', 'frontend-stability-review.md')

  assert.match(review, /Core Alpha ready/)
  assert.match(review, /Optional guided Alpha/)
  assert.match(review, /Observation-only/)
  assert.match(review, /Excluded from Alpha/)
  assert.match(review, /Forecast \/ MRP planning review and draft preview only/)
  assert.match(review, /Preview flows must remain non-mutating/)
  assert.doesNotMatch(review, /ready for production/i)
})

test('Overview planning CTAs use review and draft preview wording for Alpha', () => {
  const overview = readSource('src', 'modules', 'overview', 'Page.tsx')

  assert.match(overview, /审阅 MRP 计划订单/)
  assert.match(overview, /预览补货 PR 草稿/)
  assert.doesNotMatch(overview, /title: "释放 MRP 计划订单"/)
  assert.doesNotMatch(overview, /suggestedAction: .*"生成补货 PR"/)
})
