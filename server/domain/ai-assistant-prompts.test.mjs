import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let modulePromise

async function loadPromptModule() {
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ai-prompts-'))
    const outfile = path.join(dir, 'prompts.mjs')
    await build({
      entryPoints: ['src/modules/ai-assistant/prompts.ts'],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    })
    const mod = await import(pathToFileURL(outfile).href)
    return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) }
  })()
  return modulePromise
}

test.after(async () => {
  if (!modulePromise) return
  const loaded = await modulePromise
  await loaded.cleanup()
})

async function promptsFor(input) {
  const { mod } = await loadPromptModule()
  return mod.getContextualQuickPrompts(input)
}

test('active supplier context returns supplier prompts', async () => {
  assert.deepEqual(await promptsFor({
    moduleId: 'srm',
    activeContext: { entityType: 'supplier', entityId: 'SUP-001' },
  }), ['解释这个供应商', '查看供应商风险', '查看 RFQ 参与'])
})

test('active item context returns item prompts', async () => {
  assert.deepEqual(await promptsFor({
    moduleId: 'inventory',
    activeContext: { entityType: 'item', entityId: 'SKU-001' },
  }), ['查看库存风险', '准备 PR 草稿', '下一步建议'])
})

test('active RFQ context returns RFQ prompts', async () => {
  assert.deepEqual(await promptsFor({
    moduleId: 'procurement',
    activeContext: { entityType: 'rfq', entityId: 'RFQ-001' },
  }), ['查看 RFQ 状态', '谁还没回复', '下一步建议'])
})

test('active purchase request context returns PR prompts', async () => {
  assert.deepEqual(await promptsFor({
    moduleId: 'procurement',
    activeContext: { entityType: 'purchase_request', entityId: 'PR-001' },
  }), ['查看 PR 状态', '为什么没转 PO', '下一步建议'])
})

test('module prompts apply without active context', async () => {
  assert.deepEqual(await promptsFor({ moduleId: 'srm', activeContext: null }), ['查看高风险供应商', '解释评分规则', '下一步跟进'])
  assert.deepEqual(await promptsFor({ moduleId: 'procurement' }), ['今天采购有什么要跟？', '哪些 PO 快逾期？', '哪些 RFQ 没回复？'])
  assert.deepEqual(await promptsFor({ moduleId: 'forecast' }), [
    '今天计划模块最需要处理什么？',
    '哪些 SKU 有 MRP 例外？',
    'MRP 计划释放有哪些需要审阅？',
    '这个 forecast 的 MAPE 怎么样？',
    '哪些补货建议需要转成草稿？',
    '这个 SKU 的计划参数是什么？',
  ])
})

test('unknown module falls back to generic prompts and every result has exactly three prompts', async () => {
  const cases = [
    { moduleId: 'unknown' },
    { moduleId: 'master-data' },
    { moduleId: 'finance' },
    { moduleId: 'reports' },
    { moduleId: 'imports' },
    { moduleId: 'srm', activeContext: { entityType: 'future_entity', entityId: 'X' } },
  ]
  for (const input of cases) {
    const prompts = await promptsFor(input)
    assert.equal(prompts.length, 3)
  }
  assert.deepEqual(await promptsFor({ moduleId: 'unknown' }), ['解释当前页面', '下一步建议', '从哪里开始'])
})
