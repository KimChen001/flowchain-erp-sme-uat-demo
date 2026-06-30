import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const aiPanelSource = readFileSync(new URL('../../src/modules/ai-assistant/Panel.tsx', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../../src/app/FlowChainApp.tsx', import.meta.url), 'utf8')
const inventorySource = readFileSync(new URL('../../src/modules/inventory/Page.tsx', import.meta.url), 'utf8')

test('AI assistant UI has duplicate request guard, abort, and timeout fallback', () => {
  assert.match(aiPanelSource, /requestInFlightRef/)
  assert.match(aiPanelSource, /AbortController/)
  assert.match(aiPanelSource, /setTimeout\(\(\) =>/)
  assert.match(aiPanelSource, /AI 助手响应超时，可能是本地 API 服务未响应。可以重试，或先查看 Today Cockpit。/)
  assert.match(aiPanelSource, /retryPrompt/)
  assert.match(aiPanelSource, /重试/)
  assert.match(aiPanelSource, /disabled=\{asking\}/)
})

test('global focus recovery renders return and clear focus controls', () => {
  assert.match(appSource, /当前聚焦/)
  assert.match(appSource, /返回上一层/)
  assert.match(appSource, /清除聚焦/)
  assert.match(appSource, /setSearchFocus\(null\)/)
})

test('inventory SKU focus renders visible recovery and related document entry points', () => {
  assert.match(inventorySource, /当前 SKU 聚焦/)
  assert.match(inventorySource, /返回库存列表/)
  assert.match(inventorySource, /查看事务流水/)
  assert.match(inventorySource, /查看异常单据/)
})
