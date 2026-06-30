import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { classifyRoute, ROUTE_CLASSES, isDatabaseModeWriteBlocked } from './route-classification.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('Planning workbench exposes five distinct canonical subviews', () => {
  const routes = readSource('src', 'app', 'routes.tsx')
  const forecast = readSource('src', 'modules', 'forecast', 'Page.tsx')
  const app = readSource('src', 'app', 'FlowChainApp.tsx')

  for (const routeId of ['forecast:cockpit', 'forecast:demand', 'forecast:mrp', 'forecast:replenishment', 'forecast:parameters']) {
    assert.match(routes, new RegExp(routeId))
    assert.match(forecast, new RegExp(routeId))
  }

  for (const component of ['PlanningCockpitView', 'DemandForecastView', 'MrpPlanView', 'ReplenishmentWorkbenchView', 'PlanningParametersView']) {
    assert.match(forecast, new RegExp(component))
  }

  assert.match(app, /<ForecastPanel initialView=\{activeView as any\} onReviewActionDraft=\{openActionDraftReview\}/)
  assert.match(forecast, /data-planning-view=\{activePlanningView\}/)
})

test('Demand Forecast stays focused on forecast quality rather than release CTA', () => {
  const forecast = readSource('src', 'modules', 'forecast', 'Page.tsx')
  const demandSection = forecast.slice(forecast.indexOf('const DemandForecastView'), forecast.indexOf('const ReconciliationTable'))

  assert.match(demandSection, /历史需求输入/)
  assert.match(demandSection, /模型对比 \(Champion \/ Challenger\)/)
  assert.match(demandSection, /需求 - 供给对账 \(S&OP\)/)
  assert.doesNotMatch(demandSection, /releaseMrpAsPr/)
  assert.doesNotMatch(demandSection, /预览 PR 草稿/)
})

test('MRP Plan view makes MRP schedule, exceptions, and BOM evidence primary', () => {
  const forecast = readSource('src', 'modules', 'forecast', 'Page.tsx')
  const mrpSection = forecast.slice(forecast.indexOf('const MrpPlanView'), forecast.indexOf('const ReplenishmentWorkbenchView'))

  assert.match(mrpSection, /MRP 例外消息/)
  assert.match(mrpSection, /MRP 净需求计划/)
  assert.match(mrpSection, /BOM 和需求来源证据/)
  assert.match(mrpSection, /计划释放只表示审阅节奏/)
  assert.match(mrpSection, /releaseMrpAsPr/)
})

test('Replenishment Workbench uses ActionDraft preview and never direct purchase request POST', () => {
  const forecast = readSource('src', 'modules', 'forecast', 'Page.tsx')
  const replenishmentSection = forecast.slice(forecast.indexOf('const ReplenishmentWorkbenchView'), forecast.indexOf('const PlanningParametersView'))

  assert.match(replenishmentSection, /ActionDraft preview only/)
  assert.match(replenishmentSection, /createRequestFromForecast/)
  assert.match(forecast, /purchase_request_draft/)
  assert.match(forecast, /onReviewActionDraft/)
  assert.doesNotMatch(forecast, /apiJson<PurchaseRequest>/)
  assert.doesNotMatch(forecast, /\/api\/purchase-requests/)
})

test('Planning Parameters exposes read-only planning assumptions', () => {
  const forecast = readSource('src', 'modules', 'forecast', 'Page.tsx')
  const paramsSection = forecast.slice(forecast.indexOf('const PlanningParametersView'), forecast.indexOf('const PlanningCockpitView'))

  for (const label of ['Lead time', 'MOQ', 'Batch multiple', 'Safety stock', 'Reorder point', 'Preferred supplier', 'Buyer', 'Unit cost']) {
    assert.match(paramsSection, new RegExp(label))
  }

  assert.match(paramsSection, /demo\/static assumptions/)
})

test('Planning routes remain read-only or DB-mode guarded legacy mutations', () => {
  assert.equal(classifyRoute('GET', '/api/mrp-plan').classification, ROUTE_CLASSES.readOnly)
  assert.equal(classifyRoute('GET', '/api/mrp-plan').writesJson, false)

  for (const [method, pathname] of [
    ['POST', '/api/forecast-plans'],
    ['POST', '/api/sop-cycle'],
    ['POST', '/api/purchase-requests'],
  ]) {
    assert.equal(classifyRoute(method, pathname).classification, ROUTE_CLASSES.legacyMutation, pathname)
    assert.equal(isDatabaseModeWriteBlocked({ persistenceMode: 'database', method, pathname }), true, pathname)
  }
})
