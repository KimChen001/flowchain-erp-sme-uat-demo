import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
const testFile = join(root, "server", "domain", "internal-settlement-transaction.test.mjs");
const freePort = () => new Promise((resolvePort, reject) => { const server = createServer().on("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolvePort(port)); }); });
const port = await freePort();
const password = `local-${randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), "flowchain-settlement-pg-"));
const database = "flowchain_internal_settlement_test";
const url = `postgresql://flowchain_settlement:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_TEST: url, FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_INTERNAL_SETTLEMENT: "true", FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: "true", NODE_ENV: "test" };
const pg = new EmbeddedPostgres({ databaseDir: directory, user: "flowchain_settlement", password, port, persistent: false, onLog: () => {}, onError: () => {} });
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  await execFileAsync(process.execPath, [prismaCli, "migrate", "deploy"], { cwd: root, env, maxBuffer: 20 * 1024 * 1024 });
  const { stdout, stderr } = await execFileAsync(process.execPath, ["--test", testFile], { cwd: root, env, maxBuffer: 20 * 1024 * 1024 });
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  console.log("Internal Settlement PostgreSQL gate: PASS (0 failed, 0 skipped)");
} finally {
  await pg.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
