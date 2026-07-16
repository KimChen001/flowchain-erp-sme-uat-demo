import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import EmbeddedPostgres from 'embedded-postgres'

const execFileAsync = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const node = process.execPath
const prismaCli = join(root, 'node_modules', 'prisma', 'build', 'index.js')
const testFiles = ['server/domain/outbound-posting-transaction.test.mjs']
const sanitize = (value, secrets = []) => secrets.reduce((output, secret) => output.split(secret).join('[REDACTED]'), String(value || '')).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')

async function run(command, args, { env, secrets = [] } = {}) {
  try {
    const result = await execFileAsync(command, args, { cwd: root, env, maxBuffer: 20 * 1024 * 1024 })
    const output = `${result.stdout || ''}${result.stderr || ''}`
    if (output.trim()) process.stdout.write(sanitize(output, secrets))
    return output
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`
    if (output.trim()) process.stdout.write(sanitize(output, secrets))
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${error.code}`)
  }
}

async function availablePort() {
  return new Promise((resolvePort, reject) => { const server = createServer(); server.unref(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => resolvePort(address.port)) }) })
}

async function main() {
  const port = await availablePort(), user = 'flowchain_outbound', password = `local-${randomUUID()}`, database = 'flowchain_outbound_test'
  const directory = await mkdtemp(join(tmpdir(), 'flowchain-outbound-pg-'))
  const pg = new EmbeddedPostgres({ databaseDir: directory, user, password, port, persistent: false, onLog: () => {}, onError: (error) => process.stderr.write(`${sanitize(error, [password])}\n`) })
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_TEST: url, FLOWCHAIN_PERSISTENCE_MODE: 'database', FLOWCHAIN_ENABLE_DB_OUTBOUND_POSTING: 'true', FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: 'true', NODE_ENV: 'test' }
  try {
    await pg.initialise(); await pg.start(); await pg.createDatabase(database)
    const client = pg.getPgClient(database, '127.0.0.1'); await client.connect()
    const identity = await client.query('SELECT version(), current_database(), current_user')
    console.log(`PostgreSQL: ${identity.rows[0].version}`)
    console.log(`Connection: host=127.0.0.1 port=${port} database=${identity.rows[0].current_database} user=${identity.rows[0].current_user} schema=public`)
    await client.end()
    console.log('\n[fresh] Running all additive migrations')
    await run(node, [prismaCli, 'migrate', 'deploy'], { env, secrets: [password] })
    const output = await run(node, ['--test', '--test-concurrency=1', '--test-reporter=tap', ...testFiles], { env, secrets: [password] })
    assert.match(output, /# fail 0(?:\r?\n|$)/)
    assert.match(output, /# skipped 0(?:\r?\n|$)/)
    console.log('\nPostgreSQL outbound verification: PASS')
  } finally { await pg.stop().catch(() => {}); await rm(directory, { recursive: true, force: true }).catch(() => {}) }
}

main().catch((error) => { console.error(`PostgreSQL outbound verification: FAIL\n${sanitize(error?.stack || error)}`); process.exit(1) })
