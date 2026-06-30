import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

let modulePromise

async function loadForecastModule() {
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forecast-engine-domain-'))
    const outfile = path.join(dir, 'forecast.mjs')
    await build({
      entryPoints: ['src/domain/forecast/index.ts'],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      logLevel: 'silent',
    })
    const mod = await import(pathToFileURL(outfile).href)
    return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) }
  })()
  return modulePromise
}

test.after(async () => {
  if (!modulePromise) return
  const loaded = await modulePromise
  await loaded.cleanup()
})

const params = { alpha: 0.4, beta: 0.15, gamma: 0.25, season: 12 }
const history = [
  100, 112, 124, 138, 146, 152, 148, 142, 136, 132, 128, 130,
  118, 130, 142, 156, 168, 174, 170, 160, 152, 146, 140, 144,
]

test('forecast methods return stable output shape and finite metrics', async () => {
  const { mod } = await loadForecastModule()

  for (const method of ['naive', 'sma', 'ses', 'holt', 'hw']) {
    const result = mod.runForecast(history, method, params, 6)
    assert.equal(result.fitted.length, history.length)
    assert.equal(result.forecast.length, 6)
    for (const value of result.forecast) {
      assert.equal(Number.isFinite(value), true, `${method} forecast must be finite`)
      assert.ok(value >= 0, `${method} forecast must not be negative`)
    }
    for (const metric of ['mape', 'wmape', 'rmse', 'mae', 'trackingSignal']) {
      assert.equal(Number.isFinite(result[metric]), true, `${method} ${metric} must be finite`)
    }
  }
})

test('forecast metrics match deterministic naive calculation', async () => {
  const { mod } = await loadForecastModule()
  const result = mod.runForecast([10, 12, 13, 15], 'naive', params, 2)

  assert.deepEqual(result.fitted, [null, 10, 12, 13])
  assert.deepEqual(result.forecast, [15, 15])
  assert.equal(Number(result.mae.toFixed(4)), 1.6667)
  assert.equal(Number(result.rmse.toFixed(4)), 1.7321)
  assert.equal(Number(result.mape.toFixed(4)), 12.5641)
  assert.equal(Number(result.wmape.toFixed(4)), 12.5)
  assert.equal(Number(result.trackingSignal.toFixed(4)), 3)
})

test('short histories and invalid values degrade safely without NaN output', async () => {
  const { mod } = await loadForecastModule()
  const dirty = [10, Number.NaN, -2, 12, Infinity]

  for (const method of ['sma', 'holt', 'hw']) {
    const result = mod.runForecast(dirty, method, params, 3)
    assert.equal(result.fitted.length, 2)
    assert.equal(result.forecast.length, 3)
    assert.equal(result.forecast.every((value) => Number.isFinite(value) && value >= 0), true)
    assert.equal(Number.isFinite(result.mape), true)
    assert.equal(Number.isFinite(result.rmse), true)
  }

  const empty = mod.runForecast([Number.NaN, -1], 'hw', params, 2)
  assert.deepEqual(empty.fitted, [])
  assert.deepEqual(empty.forecast, [0, 0])
})

test('scenario adjustment is domain-level and clamps negative promotion lift', async () => {
  const { mod } = await loadForecastModule()

  assert.deepEqual(mod.applyForecastScenario([100, 200], 'base', 0), [100, 200])
  assert.deepEqual(mod.applyForecastScenario([100], 'opt', 10).map((value) => Number(value.toFixed(2))), [123.2])
  assert.deepEqual(mod.applyForecastScenario([100], 'pess', 0), [88])
  assert.deepEqual(mod.applyForecastScenario([100], 'base', -250), [0])
})

test('demand parsing and diagnostics tolerate messy input', async () => {
  const { mod } = await loadForecastModule()
  const parsed = mod.parseDemandSeries('10, 12; bad\n-4 0 15')

  assert.deepEqual(parsed, [10, 12, 0, 15])
  const diag = mod.demandDiagnostics(parsed)
  assert.equal(diag.n, 4)
  assert.equal(diag.zeros, 1)
  assert.equal(Number.isFinite(diag.cov), true)
})
