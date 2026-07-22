import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "node_modules", "playwright", "cli.js");
const directory = await mkdtemp(join(tmpdir(), "flowchain-mobile-sync-controls-"));
const sentinel = join(directory, "must-not-exist", "legacy-procurement.json");
if (existsSync(sentinel)) throw new Error("Legacy procurement sentinel unexpectedly exists before browser acceptance.");
const env = {
  ...process.env,
  PLAYWRIGHT_MOBILE_OPERATIONS_DB: "true",
  PLAYWRIGHT_MOBILE_AUTHORITY: "true",
  PLAYWRIGHT_MOBILE_SYNC_CONTROLS: "true",
  PLAYWRIGHT_WORKERS: "1",
  FLOWCHAIN_ENABLE_LEGACY_PROCUREMENT_RUNTIME: "false",
  FLOWCHAIN_PROCUREMENT_RUNTIME_FILE: sentinel,
};

const code = await new Promise((resolveExit) => {
  const child = spawn(process.execPath, [cli, "test", "tests/browser/mobile-operations.spec.ts", "tests/browser/mobile-sync-controls.spec.ts"], { cwd: root, stdio: "inherit", env });
  child.once("exit", (value) => resolveExit(value ?? 1));
});
try {
  if (existsSync(sentinel)) throw new Error("Browser acceptance created or modified the forbidden legacy procurement sentinel.");
  if (code !== 0) process.exitCode = code;
} finally {
  await rm(directory, { recursive: true, force: true });
}
