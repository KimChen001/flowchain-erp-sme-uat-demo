import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js')

const child = spawn(process.execPath, [playwrightCli, 'test', 'tests/browser/ai-empty-mode.spec.ts'], {
  cwd: root,
  env: {
    ...process.env,
    FLOWCHAIN_DATA_MODE: 'empty',
  },
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
