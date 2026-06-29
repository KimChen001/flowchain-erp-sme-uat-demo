import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let modulePromise

async function loadPresentationModule() {
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ai-presentation-'))
    const outfile = path.join(dir, 'presentation.mjs')
    await build({
      entryPoints: ['src/modules/ai-assistant/presentation.ts'],
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

test('AI message sanitization removes markdown heading markers', async () => {
  const { mod } = await loadPresentationModule()
  assert.equal(mod.sanitizeAiMessage('### 分析结果\n已找到 PO-2026-1287。'), '分析结果\n已找到 PO-2026-1287。')
})

test('AI message sanitization preserves business ids', async () => {
  const { mod } = await loadPresentationModule()
  const output = mod.sanitizeAiMessage('#### 结果\nPR-2026-2400 / RFQ-26-0047 / SKU-00412 需要复核。')
  assert.match(output, /PR-2026-2400/)
  assert.match(output, /RFQ-26-0047/)
  assert.match(output, /SKU-00412/)
})

test('JSON-like content with cards uses safe card message', async () => {
  const { mod } = await loadPresentationModule()
  assert.equal(mod.aiDisplayMessage('{"cards":[{"type":"supplier_status"}]}', true), '已找到相关业务记录，请查看下方结果。')
})

test('JSON-like content without cards uses safe fallback', async () => {
  const { mod } = await loadPresentationModule()
  assert.equal(mod.aiDisplayMessage('{"intent":"debug","evidence":[]}', false), 'AI 助手暂时无法整理该结果，请换一种问法。')
})

test('unknown card fallback stays business-safe', async () => {
  const { mod } = await loadPresentationModule()
  assert.equal(mod.safeUnknownCardMessage(), '暂不支持展示该结果类型。')
})
