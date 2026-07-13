import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const panelPath = path.join(repoRoot, 'src', 'modules', 'overview', 'TodayCockpitPanel.tsx')
const overviewPath = path.join(repoRoot, 'src', 'modules', 'overview', 'Page.tsx')

function readSource(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

test('overview page uses the authoritative procurement runtime without mounting the legacy cockpit', () => {
  const overview = readSource(overviewPath)

  assert.match(overview, /function RuntimeHomepage\b/)
  assert.match(overview, /"\/api\/procurement\/requests"/)
  assert.match(overview, /"\/api\/procurement\/orders"/)
  assert.match(overview, /"\/api\/procurement\/rfqs"/)
  assert.match(overview, /import AiSuggestionsPage from "\.\/AiSuggestionsPage"/)
  assert.match(overview, /<AiSuggestionsPage\b/)
  assert.doesNotMatch(overview, /<TodayCockpitPanel\b/)
  assert.doesNotMatch(overview, /<TodayCockpitRecentDocuments\b/)
  assert.doesNotMatch(overview, /function TodayCockpitV2Panel/)
  assert.doesNotMatch(overview, /function CockpitInventoryRiskList/)
  assert.doesNotMatch(overview, /function cockpitCardValue/)
})

test('today cockpit panel keeps focused rendering boundaries', () => {
  const panel = readSource(panelPath)

  for (const componentName of [
    'TodayCockpitSummaryCards',
    'TodayCockpitFollowups',
    'TodayCockpitInventoryRisks',
    'TodayCockpitRecentDocuments',
    'TodayCockpitRecommendedActions',
  ]) {
    assert.match(panel, new RegExp(`export function ${componentName}\\b`))
  }
})

test('today cockpit panel renders clean loading empty and error states', () => {
  const panel = readSource(panelPath)

  assert.match(panel, /今日驾驶舱正在加载/)
  assert.match(panel, /今日驾驶舱暂不可用/)
  assert.match(panel, /今日驾驶舱暂无数据/)
  assert.doesNotMatch(panel, />\s*(stack trace|undefined|null)\s*</i)
})

test('today cockpit panel preserves full amount and wide table formatting', () => {
  const panel = readSource(panelPath)

  assert.match(panel, /valueKind === "currency"\) return fmt\(Number\(card\.value \|\| 0\)\)/)
  assert.match(panel, /开放金额 \{fmt\(Number\(cockpit\.summary\.totalOpenAmount \|\| 0\)\)\}/)
  assert.match(panel, /min-w-\[760px\]/)
  assert.doesNotMatch(panel, /compactDisplay|notation:\s*["']compact["']|万元|14万/)
})
