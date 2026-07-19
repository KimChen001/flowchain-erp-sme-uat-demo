import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const cli = join(
  resolve(import.meta.dirname, ".."),
  "node_modules",
  "playwright",
  "cli.js",
);
function run(spec, extra = {}) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [cli, "test", spec], {
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_RETURNS_QUARANTINE_DB: "true",
        PLAYWRIGHT_WORKERS: "1",
        ...extra,
      },
    });
    child.once("exit", (code) => resolveRun(code ?? 1));
  });
}
const main = await run("tests/browser/returns-quarantine.spec.ts");
if (main !== 0) process.exit(main);
process.exit(
  await run("tests/browser/returns-quarantine-disabled.spec.ts", {
    PLAYWRIGHT_RETURNS_QUARANTINE_DISABLED: "true",
  }),
);
