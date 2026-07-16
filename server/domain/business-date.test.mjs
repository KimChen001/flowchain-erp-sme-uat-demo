import test from 'node:test'
import assert from 'node:assert/strict'
import { dueDateLabel, overdueDays, parseIsoBusinessDate } from './business-date.mjs'

test('business dates require complete valid ISO dates', () => {
  assert.equal(parseIsoBusinessDate('2026-06-02')?.toISOString(), '2026-06-02T00:00:00.000Z')
  for (const value of ['6月02日', '06-02', '2026-02-30', '', 'not-a-date']) assert.equal(parseIsoBusinessDate(value), null)
})

test('invalid or yearless dates never become epoch-like overdue day counts', () => {
  const asOf = new Date('2026-07-13T18:00:00+08:00')
  assert.equal(overdueDays('6月02日', asOf), null)
  assert.equal(dueDateLabel('6月02日', asOf), '待确认')
  assert.equal(overdueDays('2026-07-10', asOf), 3)
  assert.equal(dueDateLabel('2026-07-10', asOf), '逾期 3 天')
})
