import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { capabilityFor } from './capability-registry.mjs'

const appSource = fs.readFileSync(path.resolve(import.meta.dirname, '..', '..', 'src', 'app', 'FlowChainApp.tsx'), 'utf8')

test('application shell has no fixed notification count or fixture notification center', () => {
  assert.doesNotMatch(appSource, /unreadCount/)
  assert.doesNotMatch(appSource, /notification(?:s|Items)\s*=\s*\[/i)
  assert.match(appSource, /disabled aria-label="通知中心尚未接入"/)
})

test('login product claims match current finance capability boundary', () => {
  assert.doesNotMatch(appSource, /统一支撑[^。]*结算管理/)
  assert.doesNotMatch(appSource, /会计净利润|完整财务闭环/)
  assert.match(appSource, /当前连接基础资料、采购、销售、库存和经营分析/)
  assert.match(appSource, /发票、对账与结算将在正式财务数据链路接通后启用/)
  const finance = capabilityFor('finance')
  assert.equal(finance.maturity, 'unavailable')
  assert.equal(finance.enabled, false)
  assert.match(finance.reason, /settlement runtime is not fully connected/)
})
