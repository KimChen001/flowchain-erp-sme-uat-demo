import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const cli = join(resolve(import.meta.dirname, ".."), "node_modules", "playwright", "cli.js");
const child = spawn(process.execPath, [cli, "test", "tests/browser/mobile-operations.spec.ts"], {
  stdio: "inherit",
  env: { ...process.env, PLAYWRIGHT_MOBILE_OPERATIONS_DB: "true", PLAYWRIGHT_MOBILE_AUTHORITY: "true", PLAYWRIGHT_WORKERS: "1" },
});
child.once("exit", (code) => process.exit(code ?? 1));
