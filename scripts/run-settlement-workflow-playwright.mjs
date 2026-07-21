import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const cli = join(resolve(import.meta.dirname, ".."), "node_modules", "playwright", "cli.js");
function run(spec, extra = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [cli, "test", spec], { stdio: "inherit", env: { ...process.env, PLAYWRIGHT_SETTLEMENT_WORKFLOW_DB: "true", PLAYWRIGHT_WORKERS: "1", ...extra } });
    child.once("exit", (code) => resolveRun(code ?? 1));
  });
}
const enabled = await run("tests/browser/settlement-workflow.spec.ts");
if (enabled !== 0) process.exit(enabled);
process.exit(await run("tests/browser/settlement-workflow-disabled.spec.ts", { PLAYWRIGHT_SETTLEMENT_WORKFLOW_DISABLED: "true" }));
