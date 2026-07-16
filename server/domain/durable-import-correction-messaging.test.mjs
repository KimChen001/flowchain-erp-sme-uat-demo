import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = file => readFile(join(root, file), 'utf8')

test('durable import UI states correction boundary without offering automatic rollback', async () => {
  const [page, repository] = await Promise.all([
    source('src/modules/imports/Page.tsx'),
    source('server/repositories/import-persistence-repository.mjs'),
  ])

  assert.doesNotMatch(page, /可在回滚窗口内回滚|一键回滚|已自动撤销|可恢复原状态/)
  assert.match(page, /正式数据已写入；如需修正，请通过对应业务模块执行反向调整或人工修正。/)
  assert.match(page, /data-testid="durable-import-correction-limitation"/)
  assert.match(page, /!task\.batch\.rollbackAvailable/)
  assert.match(page, /不支持自动回滚 · 需业务反向调整/)
  assert.match(page, /targetRepositories/)
  assert.match(page, /task\.batch\.importBatchId/)
  assert.doesNotMatch(page, /<button[^>]*>[^<]*(?:一键回滚|回滚批次)/)

  assert.match(repository, /code: 'DURABLE_IMPORT_ROLLBACK_NOT_SUPPORTED'/)
  assert.match(repository, /当前版本不支持自动回滚。请通过对应业务模块创建反向调整或人工修正。/)
  assert.match(repository, /rollbackAvailable: false/)
})
