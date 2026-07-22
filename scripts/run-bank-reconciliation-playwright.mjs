import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "node_modules", "playwright", "cli.js");
const run = (spec, enabled) => new Promise((resolveExit) => {
  const child = spawn(process.execPath, [cli, "test", spec], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_OPERATIONAL_FINANCE_DB: "true", PLAYWRIGHT_BANK_RECONCILIATION: enabled ? "true" : "false", PLAYWRIGHT_WORKERS: "1" },
  });
  child.once("exit", (value) => resolveExit(value ?? 1));
});
const enabled = await run("tests/browser/bank-reconciliation.spec.ts", true);
if (enabled !== 0) process.exit(enabled);
process.exitCode = await run("tests/browser/bank-reconciliation-disabled.spec.ts", false);
