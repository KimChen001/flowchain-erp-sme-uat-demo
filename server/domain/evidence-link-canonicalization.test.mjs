import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('canonical evidence helper maps business evidence to focus targets', () => {
  const source = readSource('src', 'lib', 'evidenceLinks.ts')

  assert.match(source, /export type CanonicalEvidenceLink = \{/)
  assert.match(source, /export type CanonicalNavigationIntent = \{/)
  assert.match(source, /pr: \{ entityType: "purchase_request", moduleId: "procurement:requests"/)
  assert.match(source, /po: \{ entityType: "purchase_order", moduleId: "procurement:orders"/)
  assert.match(source, /rfq: \{ entityType: "rfq", moduleId: "procurement:rfq"/)
  assert.match(source, /grn: \{ entityType: "receiving_doc", moduleId: "procurement:receiving"/)
  assert.match(source, /inventory_item: \{ moduleId: "inventory", entityType: "inventory_item"/)
  assert.match(source, /supplier_master: \{ moduleId: "srm:master", entityType: "supplier"/)
})

test('canonical evidence helper filters broken targets without raw object rendering', () => {
  const source = readSource('src', 'lib', 'evidenceLinks.ts')

  assert.match(source, /const canonicalModuleId = target\?\.moduleId \|\| \(route && !route\.startsWith\("\/"\) \? route : moduleId\)/)
  assert.match(source, /const clickable = Boolean\(entityId && canonicalModuleId && normalizedEntityType\)/)
  assert.match(source, /focusTarget: clickable \? \{ entityType: normalizedEntityType, entityId \} : undefined/)
  assert.match(source, /readableLabel\(raw: EvidenceLike/)
  assert.doesNotMatch(source, /JSON\.stringify/)
})

test('global search opens canonical focus targets where safe', () => {
  const source = readSource('src', 'app', 'FlowChainApp.tsx')

  assert.match(source, /navigationIntentFromGlobalSearchResult\(result, \{ returnTo: active \}\)/)
  assert.match(source, /splitNavigationId\(active\)/)
  assert.match(source, /navigationIntentFromModule\(moduleId, \{/)
  assert.match(source, /onNavigate=\{navigateTo\}/)
  assert.match(readSource('src', 'lib', 'evidenceLinks.ts'), /source: "globalSearch"/)
})

test('navigation intent helper preserves module view and API-route focus targets', () => {
  const source = readSource('src', 'lib', 'evidenceLinks.ts')

  assert.match(source, /export function splitNavigationId\(active = ""\)/)
  assert.match(source, /export function navigationActiveId\(moduleId = "overview", viewId\?: string\)/)
  assert.match(source, /export function navigationIntentFromEvidenceLink/)
  assert.match(source, /export function navigationIntentFromGlobalSearchResult/)
  assert.match(source, /if \(link\.moduleId\) return link\.moduleId/)
  assert.match(source, /navigationIntentFromModule\(moduleId, \{/)
})

test('AI and Today Cockpit render evidence through canonical links', () => {
  const ai = readSource('src', 'modules', 'ai-assistant', 'Panel.tsx')
  const cockpit = readSource('src', 'modules', 'overview', 'TodayCockpitPanel.tsx')

  assert.match(ai, /normalizeEvidenceLinks\(evidence, \{ source: "ai" \}\)/)
  assert.match(ai, /navigationIntentFromEvidenceLink\(link, \{ source: "ai" \}\)/)
  assert.match(ai, /link\.clickable && intent && onNavigate/)
  assert.match(ai, /textValue\(title\)/)
  assert.match(cockpit, /normalizeTodayCockpitTarget\(card\)/)
  assert.match(cockpit, /normalizeTodayCockpitTarget\(doc\)/)
  assert.match(cockpit, /onNavigate\(moduleId, link\?\.focusTarget \|\| null\)/)
})
