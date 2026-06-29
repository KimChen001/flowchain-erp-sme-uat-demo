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

  assert.match(source, /tableBodyTextClass = "text-\[14px\] leading-\[22px\]"/)
  assert.match(source, /thClass = "text-left px-4 py-3 text-\[13px\] leading-5 font-semibold whitespace-nowrap"/)
  assert.match(source, /tableLinkClass = "text-\[14px\] leading-\[22px\] font-medium tabular-nums hover:underline/)
  assert.doesNotMatch(source, /tableMinLgClass = "w-full min-w-\[1280px\] text-xs"/)
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

  assert.match(source, /min-w-\[760px\] w-full text-\[14px\] leading-\[22px\]/)
  assert.match(source, /<thead className="text-\[13px\] leading-5"/)
  assert.match(source, /px-4 py-3 font-medium tabular-nums/)
})
