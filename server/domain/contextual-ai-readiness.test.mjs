import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function source(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8')
}

test('R197 contextual AI action contract is review-first and non-mutating', () => {
  const actionSource = source('src', 'domain', 'contextual-ai', 'actions.ts')
  assert.match(actionSource, /mutationAllowed:\s*false/)
  assert.match(actionSource, /requiresReview:\s*true/)
  assert.match(actionSource, /explain_po_delay/)
  assert.match(actionSource, /explain_sku_shortage/)
  assert.match(actionSource, /trace_receiving_exception/)
  assert.match(actionSource, /trace_invoice_matching_failure/)
  assert.match(actionSource, /preview_replenishment_draft/)
  assert.match(actionSource, /preview_supplier_followup_draft/)
  assert.doesNotMatch(actionSource, /approve|pay|post|submit|send\(/i)
})

test('R193 PO delayed risk stays aligned with open partially received PO logic', () => {
  const readiness = source('src', 'domain', 'contextual-ai', 'readiness.ts')
  assert.match(readiness, /receivedQty\s*<\s*orderedQty/)
  assert.match(readiness, /\["已完成", "已关闭", "已取消"\]/)
  assert.match(readiness, /ETA .* has passed and open quantity/)
  assert.match(source('src', 'modules', 'purchasing', 'Page.tsx'), /poDelayedRisk/)
})

test('R194 SKU detail separates risk level from reason and supports review-first replenishment draft', () => {
  const inventory = source('src', 'modules', 'inventory', 'Page.tsx')
  assert.match(inventory, /风险等级/)
  assert.match(inventory, /原因/)
  assert.match(inventory, /Preview replenishment PR draft/)
  assert.match(inventory, /mutationAllowed:\s*false/)
  assert.doesNotMatch(inventory, /auto-create|自动创建 PR/)
})

test('R195-R196 GRN and invoice contextual actions do not auto-post approve or pay', () => {
  const receiving = source('src', 'modules', 'receiving', 'Page.tsx')
  const invoice = source('src', 'modules', 'procurement', 'SupplierInvoiceRegister.tsx')
  assert.match(receiving, /no auto-close, no receiving post, no inventory mutation/)
  assert.match(invoice, /no auto-approve, no payment, no AP posting/)
  assert.match(receiving, /Explain receiving exception/)
  assert.match(invoice, /Explain matching failure/)
})

test('R198 AI insight panel is embedded and not a standalone left navigation module', () => {
  const panel = source('src', 'components', 'ai', 'ContextualAIInsightPanel.tsx')
  const routes = source('src', 'app', 'routes.tsx')
  assert.match(panel, /Contextual AI insight/)
  assert.match(panel, /No mutation/)
  assert.match(panel, /mutationAllowed: false/)
  assert.doesNotMatch(routes, /label:\s*["']AI Assistant["']/)
  assert.doesNotMatch(routes, /label:\s*["']AI Command Center["']/)
  assert.doesNotMatch(routes, /label:\s*["']Ask AI["']/)
})

test('R200 business modules remain navigable and provider keys are not introduced', () => {
  const routes = source('src', 'app', 'routes.tsx')
  const allChangedSources = [
    source('src', 'domain', 'contextual-ai', 'actions.ts'),
    source('src', 'domain', 'contextual-ai', 'readiness.ts'),
    source('src', 'components', 'ai', 'ContextualAIInsightPanel.tsx'),
    source('src', 'modules', 'purchasing', 'Page.tsx'),
    source('src', 'modules', 'inventory', 'Page.tsx'),
    source('src', 'modules', 'receiving', 'Page.tsx'),
    source('src', 'modules', 'procurement', 'SupplierInvoiceRegister.tsx'),
  ].join('\n')
  for (const id of ['procurement', 'inventory', 'srm', 'finance', 'imports']) {
    assert.match(routes, new RegExp(`id:\\s*["']${id}`))
  }
  assert.doesNotMatch(allChangedSources, /OPENAI_API_KEY|ARK_API_KEY|DOUBAO_API_KEY|AI_PROVIDER_ENABLED/)
})
