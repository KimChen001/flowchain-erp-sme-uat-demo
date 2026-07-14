import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDurableProcurementRepository } from '../repositories/durable-procurement-repository.mjs'

test('procurement JSON transactions serialize concurrent writes and advance revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-mutex-'))
  try {
    const repository = createDurableProcurementRepository({ dataFile: join(directory, 'procurement.json') })
    await Promise.all(Array.from({ length: 8 }, (_, index) => repository.transact(async document => {
      await new Promise(resolve => setTimeout(resolve, index % 2))
      document.workItems.push({ id: `W-${index}` })
    })))
    const snapshot = await repository.snapshot()
    assert.equal(snapshot.workItems.length, 8)
    assert.equal(snapshot.revision, 8)
    assert.ok(snapshot.updatedAt)
    assert.equal(snapshot.schemaVersion, 2)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
