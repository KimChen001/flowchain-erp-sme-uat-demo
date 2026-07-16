import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";

const execFileAsync = promisify(execFile),
  root = resolve(import.meta.dirname, ".."),
  node = process.execPath;
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
const sanitize = (value, secrets = []) =>
  secrets
    .reduce(
      (output, secret) => output.split(secret).join("[REDACTED]"),
      String(value || ""),
    )
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]");
const port = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
async function run(command, args, env, secrets) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: root,
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if (output.trim()) process.stdout.write(sanitize(output, secrets));
    return output;
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    if (output.trim()) process.stdout.write(sanitize(output, secrets));
    throw error;
  }
}

const pgPort = await port(),
  password = `local-${randomUUID()}`,
  directory = await mkdtemp(
    join(tmpdir(), "flowchain-inventory-operations-pg-"),
  ),
  database = "flowchain_inventory_operations_test";
const url = `postgresql://flowchain_inventory_operations:${encodeURIComponent(password)}@127.0.0.1:${pgPort}/${database}?schema=public`;
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "flowchain_inventory_operations",
  password,
  port: pgPort,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
const env = {
  ...process.env,
  DATABASE_URL: url,
  DATABASE_URL_TEST: url,
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS: "true",
  FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: "true",
  NODE_ENV: "test",
};
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  await run(node, [prismaCli, "migrate", "deploy"], env, [password]);
  const output = await run(
    node,
    [
      "--test",
      "--test-concurrency=1",
      "--test-reporter=tap",
      "server/domain/inventory-operations-transaction.test.mjs",
    ],
    env,
    [password],
  );
  assert.match(output, /# fail 0(?:\r?\n|$)/);
  assert.match(output, /# skipped 0(?:\r?\n|$)/);
  console.log("PostgreSQL inventory operations verification: PASS");
} finally {
  await pg.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
