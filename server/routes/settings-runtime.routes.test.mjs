import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'
import { handleSettingsRuntimeRoute } from './settings-runtime.routes.mjs'

test('settings API persists writes and returns explicit storage errors', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowchain-settings-route-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const dataFile = path.join(directory, 'system-settings.json')
  const repository = createSettingsRuntimeRepository({ dataFile })
  const responses = []
  const base = { res: {}, send: (_res, status, body) => responses.push({ status, body }), repositories: { settingsRuntime: repository } }

  assert.equal(await handleSettingsRuntimeRoute({ ...base, req: { method: 'GET' }, url: new URL('http://local/api/settings-runtime'), readBody: async () => ({}) }), true)
  assert.equal(responses.at(-1).status, 200)
  const company = responses.at(-1).body.company

  assert.equal(await handleSettingsRuntimeRoute({ ...base, req: { method: 'PATCH' }, url: new URL('http://local/api/settings-runtime/company'), readBody: async () => ({ settings: { ...company, workspaceName: 'API 持久化工作区' }, actor: { id: 'USR-T', name: '测试员', role: '管理员' } }) }), true)
  assert.equal(responses.at(-1).status, 200)
  const restarted = createSettingsRuntimeRepository({ dataFile })
  assert.equal((await restarted.getSettingsRuntime()).company.workspaceName, 'API 持久化工作区')
  assert.equal((await restarted.listSettingsAuditEntries())[0].actor.name, '测试员')
})
