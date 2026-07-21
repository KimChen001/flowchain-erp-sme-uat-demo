import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const migrationsRoot = join(root, "prisma", "migrations");
const coreMigration = "20260720010000_internal_settlement_cashbook_foundation";
const foundationMigration = "20260720020000_settlement_workflow_mobile_foundation";
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
const testFile = join(root, "server", "domain", "settlement-workflow-mobile-transaction.test.mjs");

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer().on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolvePort(port));
  });
});

const databaseUrl = ({ user, password, port, database }) => `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
const envFor = (url) => ({
  ...process.env,
  DATABASE_URL: url,
  DATABASE_URL_TEST: url,
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_INTERNAL_SETTLEMENT: "true",
  FLOWCHAIN_ENABLE_DB_SETTLEMENT_WORKFLOW: "true",
  FLOWCHAIN_ENABLE_DB_MOBILE_SYNC: "true",
  FLOWCHAIN_ENABLE_DB_MOBILE_OPERATIONS: "true",
  FLOWCHAIN_SYNC_CURSOR_SECRET: "phase-52b-test-sync-secret-at-least-32",
  FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: "true",
  NODE_ENV: "test",
});

async function run(args, env) {
  return execFileAsync(process.execPath, args, { cwd: root, env, maxBuffer: 30 * 1024 * 1024 });
}

async function query(pg, database, sql, params = []) {
  const client = pg.getPgClient(database, "127.0.0.1");
  await client.connect();
  try { return await client.query(sql, params); } finally { await client.end(); }
}

async function applyThroughCore(pg, database, url) {
  const names = (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name <= coreMigration)
    .map((entry) => entry.name)
    .sort();
  for (const name of names) {
    await query(pg, database, await readFile(join(migrationsRoot, name, "migration.sql"), "utf8"));
    await run([prismaCli, "migrate", "resolve", "--applied", name], envFor(url));
  }
  assert.equal(names.at(-1), coreMigration);
}

async function verifyUpgrade(pg, database, url) {
  await applyThroughCore(pg, database, url);
  await query(pg, database, `
    INSERT INTO "Tenant" ("id", "name", "updatedAt") VALUES ('phase52b-upgrade-tenant', 'Phase 5.2B Upgrade', CURRENT_TIMESTAMP);
    INSERT INTO "CashbookAccount" ("id", "tenantId", "accountCode", "name", "accountType", "currency", "openingBalance", "currentBalance", "status", "version", "updatedAt")
      VALUES ('phase52b-upgrade-account', 'phase52b-upgrade-tenant', 'LEGACY-CNY', 'Legacy CNY', 'bank', 'CNY', 100, 75, 'active', 1, CURRENT_TIMESTAMP);
    INSERT INTO "SettlementDocument" ("id", "tenantId", "settlementNumber", "direction", "counterpartyType", "counterpartyId", "cashbookAccountId", "currency", "amount", "settlementDate", "status", "version", "updatedAt") VALUES
      ('phase52b-upgrade-draft', 'phase52b-upgrade-tenant', 'LEGACY-DRAFT', 'disbursement', 'supplier', 'supplier-upgrade', 'phase52b-upgrade-account', 'CNY', 10, CURRENT_TIMESTAMP, 'draft', 0, CURRENT_TIMESTAMP),
      ('phase52b-upgrade-posted', 'phase52b-upgrade-tenant', 'LEGACY-POSTED', 'disbursement', 'supplier', 'supplier-upgrade', 'phase52b-upgrade-account', 'CNY', 25, CURRENT_TIMESTAMP, 'posted', 1, CURRENT_TIMESTAMP),
      ('phase52b-upgrade-reversed', 'phase52b-upgrade-tenant', 'LEGACY-REVERSED', 'receipt', 'customer', 'customer-upgrade', 'phase52b-upgrade-account', 'CNY', 15, CURRENT_TIMESTAMP, 'reversed', 2, CURRENT_TIMESTAMP),
      ('phase52b-upgrade-cancelled', 'phase52b-upgrade-tenant', 'LEGACY-CANCELLED', 'receipt', 'customer', 'customer-upgrade', 'phase52b-upgrade-account', 'CNY', 5, CURRENT_TIMESTAMP, 'cancelled', 1, CURRENT_TIMESTAMP);
    INSERT INTO "CashbookEntry" ("id", "tenantId", "cashbookAccountId", "settlementId", "entryNumber", "entryType", "direction", "amount", "currency", "occurredAt", "balanceBefore", "balanceAfter", "postingBatchId")
      VALUES ('phase52b-upgrade-entry', 'phase52b-upgrade-tenant', 'phase52b-upgrade-account', 'phase52b-upgrade-posted', 'CB-LEGACY-POSTED', 'settlement', 'outflow', 25, 'CNY', CURRENT_TIMESTAMP, 100, 75, 'phase52b-upgrade-batch');
  `);
  await run([prismaCli, "migrate", "deploy"], envFor(url));
  const latest = await query(pg, database, `SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL ORDER BY "migration_name" DESC LIMIT 1`);
  assert.equal(latest.rows[0].migration_name, foundationMigration);
  const settlements = await query(pg, database, `
    SELECT "settlementNumber", "workflowStatus", "postingStatus", "cashAmount"::text AS "cashAmount", "discountAmount"::text AS "discountAmount", "totalSettlementAmount"::text AS "totalSettlementAmount", "advanceCreatedAmount"::text AS "advanceCreatedAmount"
    FROM "SettlementDocument" WHERE "tenantId" = 'phase52b-upgrade-tenant' ORDER BY "settlementNumber"
  `);
  assert.deepEqual(settlements.rows, [
    { settlementNumber: "LEGACY-CANCELLED", workflowStatus: "cancelled", postingStatus: "unposted", cashAmount: "5.0000", discountAmount: "0.0000", totalSettlementAmount: "5.0000", advanceCreatedAmount: "0.0000" },
    { settlementNumber: "LEGACY-DRAFT", workflowStatus: "draft", postingStatus: "unposted", cashAmount: "10.0000", discountAmount: "0.0000", totalSettlementAmount: "10.0000", advanceCreatedAmount: "0.0000" },
    { settlementNumber: "LEGACY-POSTED", workflowStatus: "posted", postingStatus: "posted", cashAmount: "25.0000", discountAmount: "0.0000", totalSettlementAmount: "25.0000", advanceCreatedAmount: "0.0000" },
    { settlementNumber: "LEGACY-REVERSED", workflowStatus: "reversed", postingStatus: "reversed", cashAmount: "15.0000", discountAmount: "0.0000", totalSettlementAmount: "15.0000", advanceCreatedAmount: "0.0000" },
  ]);
  const preserved = await query(pg, database, `
    SELECT a."openingBalance"::text AS "openingBalance", a."currentBalance"::text AS "currentBalance", e."amount"::text AS "entryAmount", e."balanceBefore"::text AS "balanceBefore", e."balanceAfter"::text AS "balanceAfter"
    FROM "CashbookAccount" a JOIN "CashbookEntry" e ON e."cashbookAccountId" = a."id" WHERE a."id" = 'phase52b-upgrade-account'
  `);
  assert.deepEqual(preserved.rows[0], { openingBalance: "100.0000", currentBalance: "75.0000", entryAmount: "25.0000", balanceBefore: "100.0000", balanceAfter: "75.0000" });
}

const port = await freePort();
const password = `local-${randomUUID()}`;
const user = "flowchain_phase52b";
const directory = await mkdtemp(join(tmpdir(), "flowchain-phase52b-pg-"));
const freshDatabase = "flowchain_phase52b_fresh";
const upgradeDatabase = "flowchain_phase52b_upgrade";
const pg = new EmbeddedPostgres({ databaseDir: directory, user, password, port, persistent: false, onLog: () => {}, onError: () => {} });

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(freshDatabase);
  await pg.createDatabase(upgradeDatabase);
  const freshUrl = databaseUrl({ user, password, port, database: freshDatabase });
  await run([prismaCli, "migrate", "deploy"], envFor(freshUrl));
  const { stdout, stderr } = await run(["--test", testFile], envFor(freshUrl));
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  const upgradeUrl = databaseUrl({ user, password, port, database: upgradeDatabase });
  await verifyUpgrade(pg, upgradeDatabase, upgradeUrl);
  console.log("Settlement Workflow & Mobile PostgreSQL gate: fresh PASS; v0.5.2 upgrade PASS; 0 failed; 0 skipped");
} finally {
  await pg.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
