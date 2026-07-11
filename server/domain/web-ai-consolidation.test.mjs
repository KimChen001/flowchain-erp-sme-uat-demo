import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getSettingsRuntime, updateSettingsSection, listSettingsAuditEntries } from '../repositories/settings-runtime-repository.mjs'

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('focused AI presentation limits priorities, actions, evidence and follow-ups', async () => {
  const [model, renderer, panel] = await Promise.all([
    read('src/domain/ai/focused-response.ts'), read('src/components/ai/AiResponseV2Renderer.tsx'), read('src/modules/ai-assistant/Panel.tsx'),
  ])
  assert.match(model, /evidence\.slice\(0, 3\)/)
  assert.match(model, /availableActions\.slice\(1, 3\)/)
  assert.match(model, /evidence: evidence\.slice\(0, 5\)/)
  assert.match(model, /\.slice\(0, 2\)/)
  assert.match(renderer, /<details data-testid=/)
  assert.match(panel, /emptyPrompts\.slice\(0, 4\)/)
  assert.match(panel, /取消请求/)
  assert.doesNotMatch(panel, /getContextualQuickPrompts/)
})

test('settings runtime enforces last administrator and protected module invariants', () => {
  const current = getSettingsRuntime()
  assert.throws(() => updateSettingsSection('roles', {
    ...current.roles,
    users: current.roles.users.map((user) => ({ ...user, enabled: user.role === '管理员' ? false : user.enabled })),
  }), /至少保留一名/)
  assert.throws(() => updateSettingsSection('modules', {
    ...current.modules,
    items: current.modules.items.map((item) => item.id === 'settings' ? { ...item, enabled: false } : item),
  }), /不能停用/)
  const result = updateSettingsSection('company', { ...current.company, workspaceName: '供应链运营验证工作区' })
  assert.equal(result.settings.workspaceName, '供应链运营验证工作区')
  assert.equal(listSettingsAuditEntries()[0].entity.id, 'company')
})

test('settings, PO, master data and reports expose consolidated product surfaces', async () => {
  const [routes, settings, purchasing, masterRoutes, entityRoutes, reports] = await Promise.all([
    read('src/app/routeRegistry.tsx'), read('src/modules/settings/Page.tsx'), read('src/modules/purchasing/Page.tsx'),
    read('server/routes/master-data.routes.mjs'), read('src/components/business/businessEntityRoutes.ts'), read('src/modules/reports/BiDashboard.tsx'),
  ])
  for (const path of ['company', 'roles', 'numbering', 'review', 'modules', 'ai', 'audit', 'advanced']) assert.match(routes, new RegExp(`/app/settings/${path}`))
  assert.doesNotMatch(settings, /ControlledSettingsView/)
  assert.match(purchasing, /min-w-\[1200px\]/)
  assert.match(purchasing, /sticky left-0/)
  assert.match(purchasing, /sticky right-0/)
  assert.match(masterRoutes, /url\.pathname === '\/api\/master-data'/)
  for (const type of ['warehouse', 'bin', 'payment_term', 'tax_code']) assert.match(entityRoutes, new RegExp(`${type}:`))
  assert.match(reports, /自定义看板/)
  assert.match(reports, /aria-label="比较方式"/)
  assert.doesNotMatch(reports, /<Card className="flex flex-wrap items-end gap-3 p-3" data-testid="dashboard-configuration"/)
})
