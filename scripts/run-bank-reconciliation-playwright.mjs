import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "node_modules", "playwright", "cli.js");
const code = await new Promise((resolveExit) => {
  const child = spawn(process.execPath, [cli, "test", "tests/browser/bank-reconciliation.spec.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_OPERATIONAL_FINANCE_DB: "true", PLAYWRIGHT_BANK_RECONCILIATION: "true", PLAYWRIGHT_WORKERS: "1" },
  });
  child.once("exit", (value) => resolveExit(value ?? 1));
});
process.exitCode = code;
