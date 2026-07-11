import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createSettingsRuntimeRepository } from '../repositories/settings-runtime-repository.mjs'

async function temporarySettingsFile(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'flowchain-settings-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { directory, dataFile: path.join(directory, 'system-settings.json') }
}

test('all system settings and audit entries survive repository reconstruction', async (t) => {
  const { dataFile } = await temporarySettingsFile(t)
  let repository = createSettingsRuntimeRepository({ dataFile })
  let settings = await repository.getSettingsRuntime()

  await repository.updateSettingsSection('company', { ...settings.company, workspaceName: '重启后工作区' })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.company.workspaceName, '重启后工作区')

  await repository.updateSettingsSection('roles', { ...settings.roles, users: [...settings.roles.users, { id: 'USR-900', name: '持久化用户', email: 'persist@example.com', role: '只读访客', enabled: true }] })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.ok(settings.roles.users.some((user) => user.id === 'USR-900'))

  await repository.updateSettingsSection('roles', { ...settings.roles, permissions: { ...settings.roles.permissions, 只读访客: ['overview', 'reports'] } })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.deepEqual(settings.roles.permissions.只读访客, ['overview', 'reports'])

  const rules = settings.numbering.rules.map((rule) => rule.id === 'NUM-PO' ? { ...rule, prefix: 'POX' } : rule)
  await repository.updateSettingsSection('numbering', { rules })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.numbering.rules.find((rule) => rule.id === 'NUM-PO').prefix, 'POX')

  await repository.updateSettingsSection('review', { ...settings.review, amountThreshold: 188000 })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.review.amountThreshold, 188000)

  await repository.updateSettingsSection('modules', { ...settings.modules, defaultModule: 'reports' })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.modules.defaultModule, 'reports')

  const capabilities = settings.ai.capabilities.map((item) => item.id === 'draft' ? { ...item, level: '禁止' } : item)
  await repository.updateSettingsSection('ai', { ...settings.ai, capabilities })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.ai.capabilities.find((item) => item.id === 'draft').level, '禁止')

  await repository.updateSettingsSection('advanced', { ...settings.advanced, exportLimit: 4321 })
  repository = createSettingsRuntimeRepository({ dataFile })
  settings = await repository.getSettingsRuntime()
  assert.equal(settings.advanced.exportLimit, 4321)
  const auditEntries = await repository.listSettingsAuditEntries()
  assert.equal(auditEntries.length, 8)
  assert.ok(auditEntries.every((entry) => entry.before && entry.after && entry.module === 'settings'))
})

test('existing settings are not replaced by seed and invalid JSON fails explicitly', async (t) => {
  const { dataFile } = await temporarySettingsFile(t)
  let repository = createSettingsRuntimeRepository({ dataFile })
  const settings = await repository.getSettingsRuntime()
  await repository.updateSettingsSection('company', { ...settings.company, companyName: '已保存企业' })
  repository = createSettingsRuntimeRepository({ dataFile })
  assert.equal((await repository.getSettingsRuntime()).company.companyName, '已保存企业')

  await writeFile(dataFile, '{ invalid json', 'utf8')
  repository = createSettingsRuntimeRepository({ dataFile })
  await assert.rejects(repository.getSettingsRuntime(), (error) => error.code === 'settings_storage_error' && /JSON 无效/.test(error.message))
})

test('continuous writes remain valid JSON and preserve last-admin and protected-module rules', async (t) => {
  const { directory, dataFile } = await temporarySettingsFile(t)
  const repository = createSettingsRuntimeRepository({ dataFile })
  const settings = await repository.getSettingsRuntime()
  await assert.rejects(repository.updateSettingsSection('roles', { ...settings.roles, users: settings.roles.users.map((user) => ({ ...user, enabled: user.role === '管理员' ? false : user.enabled })) }), /至少保留一名/)
  await assert.rejects(repository.updateSettingsSection('modules', { ...settings.modules, items: settings.modules.items.map((item) => item.id === 'settings' ? { ...item, enabled: false } : item) }), /不能停用/)

  await Promise.all([
    repository.updateSettingsSection('company', { ...settings.company, workspaceName: '连续写入工作区' }),
    repository.updateSettingsSection('advanced', { ...settings.advanced, exportLimit: 7654 }),
    repository.updateSettingsSection('review', { ...settings.review, inventoryTolerancePercent: 7 }),
  ])
  const parsed = JSON.parse(await readFile(dataFile, 'utf8'))
  assert.equal(parsed.settings.company.workspaceName, '连续写入工作区')
  assert.equal(parsed.settings.advanced.exportLimit, 7654)
  assert.equal(parsed.settings.review.inventoryTolerancePercent, 7)
  assert.equal(parsed.auditEntries.length, 3)
  assert.equal((await readdir(directory)).filter((name) => name.includes('.tmp-')).length, 0)
})
