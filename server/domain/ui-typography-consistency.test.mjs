import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')

function readSource(...parts) {
  return fs.readFileSync(path.join(repoRoot, ...parts), 'utf8')
}

test('workbench table typography defines body header and link scales', () => {
  const source = readSource('src', 'components', 'ui', 'workbenchTable.ts')

  assert.match(source, /tableBodyTextClass = typography\.tableCell/)
  assert.match(source, /thClass = `text-left px-4 py-3 \$\{typography\.tableHeader\} whitespace-nowrap`/)
  assert.match(source, /thRightClass = `text-right px-4 py-3 \$\{typography\.tableHeader\} whitespace-nowrap`/)
  assert.match(source, /tableLinkClass = `\$\{typography\.tableLink\} tabular-nums hover:underline/)
  assert.doesNotMatch(source, /tableMinLgClass = "w-full min-w-\[1280px\] text-xs"/)
})

test('typography tokens expose consolidated operational scale', () => {
  const source = readSource('src', 'components', 'ui', 'typography.ts')

  assert.match(source, /pageTitle: "text-\[20px\] leading-7 font-semibold/)
  assert.match(source, /sectionTitle: "text-\[16px\] leading-6 font-semibold/)
  assert.match(source, /body: "text-\[14px\] leading-\[22px\]/)
  assert.match(source, /tableHeader: "text-\[13px\] leading-5 font-semibold/)
  assert.match(source, /tableCell: "text-\[14px\] leading-\[22px\]/)
  assert.match(source, /tableLink: "text-\[14px\] leading-\[22px\] font-medium/)
  assert.match(source, /formLabel: "text-\[13px\] leading-5 font-semibold/)
  assert.match(source, /chip: "text-\[12px\] leading-\[18px\] font-semibold/)
})

test('primary procurement table id links use table link class', () => {
  const purchasing = readSource('src', 'modules', 'purchasing', 'Page.tsx')
  const requests = readSource('src', 'modules', 'purchase-requests', 'Page.tsx')
  const rfq = readSource('src', 'modules', 'rfq', 'Page.tsx')

  for (const source of [purchasing, requests, rfq]) {
    assert.match(source, /tableLinkClass/)
    assert.match(source, /className=\{tableLinkClass\}/)
  }
})

test('shared field input and chip typography follows compact SaaS scale', () => {
  const source = readSource('src', 'components', 'ui', 'index.tsx')

  assert.match(source, /text-\[12px\] leading-\[18px\] font-semibold/)
  assert.match(source, /text-\[13px\] leading-5 font-semibold/)
  assert.match(source, /fontSize: 14, lineHeight: "22px"/)
})

test('today cockpit recent document table uses standard table body scale', () => {
  const source = readSource('src', 'modules', 'overview', 'TodayCockpitPanel.tsx')

  assert.match(source, /tableBodyTextClass/)
  assert.match(source, /thRightClass/)
  assert.match(source, /tdNumericRightClass/)
  assert.match(source, /className=\{tableLinkClass\}/)
})
