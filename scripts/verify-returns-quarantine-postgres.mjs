import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { createInventoryAuthoritativeReadService } from "../server/domain/inventory-authoritative-read-service.mjs";
import { createPrismaClient } from "../server/persistence/prisma-client.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const migrationsRoot = join(root, "prisma", "migrations");
const foundationMigration = "20260717010000_returns_quarantine_foundation";
const node = process.execPath;
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");

function sanitize(value, secrets = []) {
  let output = String(value || "");
  for (const secret of secrets.filter(Boolean))
    output = output.split(secret).join("[REDACTED]");
  return output.replace(
    /postgres(?:ql)?:\/\/[^\s]+/gi,
    "[REDACTED_DATABASE_URL]",
  );
}

async function run(command, args, { env, secrets = [] } = {}) {
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

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });
}

function databaseUrl({ port, user, password, database }) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}?schema=public`;
}

function databaseEnv(url) {
  return {
    ...process.env,
    DATABASE_URL: url,
    DATABASE_URL_TEST: url,
    FLOWCHAIN_PERSISTENCE_MODE: "database",
    FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE: "true",
    FLOWCHAIN_REQUIRE_REAL_POSTGRES_TESTS: "true",
    NODE_ENV: "test",
  };
}

async function query(pg, database, sql, params = []) {
  const client = pg.getPgClient(database, "127.0.0.1");
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
}

async function expectDatabaseError(pg, database, sql, expectedCode) {
  try {
    await query(pg, database, sql);
    assert.fail(`Expected PostgreSQL error ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode);
  }
}

async function deploy(url, secrets) {
  await run(node, [prismaCli, "migrate", "deploy"], {
    env: databaseEnv(url),
    secrets,
  });
}

async function migrationNames() {
  return (await readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function applyPhase4ABaseline(pg, database, url, secrets) {
  const names = (await migrationNames()).filter(
    (name) => name < foundationMigration,
  );
  for (const name of names) {
    const sql = await readFile(
      join(migrationsRoot, name, "migration.sql"),
      "utf8",
    );
    await query(pg, database, sql);
    await run(node, [prismaCli, "migrate", "resolve", "--applied", name], {
      env: databaseEnv(url),
      secrets,
    });
  }
  return names;
}

async function assertFoundationTables(pg, database) {
  const expected = [
    "QuarantineInventoryBalance",
    "ReturnRequest",
    "ReturnRequestLine",
    "ReturnAuthorization",
    "ReturnAuthorizationLine",
    "ReturnPostingDocument",
    "ReturnPostingLine",
  ];
  const result = await query(
    pg,
    database,
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      ORDER BY table_name
    `,
    [expected],
  );
  assert.deepEqual(
    result.rows.map((row) => row.table_name).sort(),
    [...expected].sort(),
  );
}

async function seedCore(pg, database, prefix) {
  const tenantId = `${prefix}-tenant`;
  const warehouseId = `${prefix}-warehouse`;
  const itemId = `${prefix}-item`;
  const userId = `${prefix}-manager`;
  await query(
    pg,
    database,
    `INSERT INTO "Tenant" ("id", "name", "updatedAt") VALUES ($1, 'Returns Tenant', NOW())`,
    [tenantId],
  );
  await query(
    pg,
    database,
    `INSERT INTO "Warehouse" ("id", "tenantId", "code", "name", "updatedAt") VALUES ($1, $2, 'RET', 'Returns Warehouse', NOW())`,
    [warehouseId, tenantId],
  );
  await query(
    pg,
    database,
    `INSERT INTO "User" ("id", "tenantId", "email", "name", "role", "status", "updatedAt") VALUES ($1, $2, $3, 'Returns Manager', 'manager', 'active', NOW())`,
    [userId, tenantId, `${prefix}-manager@flowchain.test`],
  );
  await query(
    pg,
    database,
    `INSERT INTO "UserWarehouseScope" ("id", "tenantId", "userId", "warehouseId", "accessLevel", "updatedAt") VALUES ($1, $2, $3, $4, 'read', NOW())`,
    [`${prefix}-scope`, tenantId, userId, warehouseId],
  );
  await query(
    pg,
    database,
    `INSERT INTO "Item" ("id", "tenantId", "sku", "name", "unit", "updatedAt") VALUES ($1, $2, 'SKU-RET-1', 'Return Item', 'EA', NOW())`,
    [itemId, tenantId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "InventoryBalance" (
        "id", "tenantId", "itemId", "sku", "itemName", "warehouseId",
        "warehouseKey", "location", "locationKey", "availableQuantity",
        "onHandQuantity", "reservedQuantity", "unit", "updatedAt"
      ) VALUES (
        $1, $2, $3, 'SKU-RET-1', 'Return Item', $4,
        $4, 'A-01', 'a-01', 8, 10, 2, 'EA', NOW()
      )
    `,
    [`${prefix}-available`, tenantId, itemId, warehouseId],
  );
}

async function verifyAuthoritativeSelectors(url, prefix) {
  const prisma = await createPrismaClient(databaseEnv(url));
  try {
    const service = createInventoryAuthoritativeReadService({ prisma });
    const context = {
      identity: {
        authenticated: true,
        tenantId: `${prefix}-tenant`,
        userId: `${prefix}-manager`,
        role: "manager",
      },
    };
    const query = { sku: "SKU-RET-1" };
    const [available, quarantine] = await Promise.all([
      service.listAvailableBalanceOptions(query, context),
      service.listQuarantineBalanceOptions(query, context),
    ]);

    assert.equal(available.dataSource, "Authoritative PostgreSQL");
    assert.equal(available.inventoryClass, "available");
    assert.equal(available.options.length, 1);
    assert.deepEqual(
      {
        balanceType: available.options[0].balanceType,
        availableQuantity: available.options[0].availableQuantity,
        quarantineQuantity: available.options[0].quarantineQuantity,
        reservable: available.options[0].reservable,
      },
      {
        balanceType: "available",
        availableQuantity: "8.0000",
        quarantineQuantity: null,
        reservable: true,
      },
    );

    assert.equal(quarantine.dataSource, "Authoritative PostgreSQL");
    assert.equal(quarantine.inventoryClass, "quarantine");
    assert.equal(quarantine.options.length, 1);
    assert.deepEqual(
      {
        balanceType: quarantine.options[0].balanceType,
        availableQuantity: quarantine.options[0].availableQuantity,
        quarantineQuantity: quarantine.options[0].quarantineQuantity,
        reservable: quarantine.options[0].reservable,
      },
      {
        balanceType: "quarantine",
        availableQuantity: null,
        quarantineQuantity: "4.0000",
        reservable: false,
      },
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyFoundationFacts(pg, database, prefix) {
  const tenantId = `${prefix}-tenant`;
  const warehouseId = `${prefix}-warehouse`;
  const itemId = `${prefix}-item`;
  const availableId = `${prefix}-available`;
  const quarantineId = `${prefix}-quarantine`;
  const requestId = `${prefix}-request`;
  const requestLineId = `${prefix}-request-line`;
  const authorizationId = `${prefix}-authorization`;
  const authorizationLineId = `${prefix}-authorization-line`;
  const postingId = `${prefix}-posting`;
  const emptyPostingId = `${prefix}-empty-posting`;

  await query(
    pg,
    database,
    `
      INSERT INTO "QuarantineInventoryBalance" (
        "id", "tenantId", "itemId", "sku", "itemName", "warehouseId",
        "warehouseKey", "location", "locationKey", "onHandQuantity",
        "unit", "updatedAt"
      ) VALUES (
        $1, $2, $3, 'SKU-RET-1', 'Return Item', $4,
        $4, 'Q-01', 'q-01', 4, 'EA', NOW()
      )
    `,
    [quarantineId, tenantId, itemId, warehouseId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnRequest" (
        "id", "tenantId", "requestNumber", "returnType", "partnerId",
        "partnerNameSnapshot", "sourceDocumentType", "sourceDocumentId",
        "reasonCode", "requestedById", "updatedAt"
      ) VALUES (
        $1, $2, 'RET-REQ-1', 'customer_return', 'customer-1',
        'Customer Snapshot', 'ShipmentDocument', 'shipment-1',
        'damaged', 'manager-1', NOW()
      )
    `,
    [requestId, tenantId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnRequestLine" (
        "id", "returnRequestId", "sourceDocumentLineId", "itemId", "sku",
        "itemName", "requestedQuantity", "unit", "reasonCode"
      ) VALUES (
        $1, $2, 'shipment-line-1', $3, 'SKU-RET-1',
        'Return Item', 2, 'EA', 'damaged'
      )
    `,
    [requestLineId, requestId, itemId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnAuthorization" (
        "id", "tenantId", "authorizationNumber", "returnRequestId",
        "workflowStatus", "authorizedAt", "authorizedById", "updatedAt"
      ) VALUES (
        $1, $2, 'RET-AUTH-1', $3, 'approved', NOW(), 'manager-1', NOW()
      )
    `,
    [authorizationId, tenantId, requestId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnAuthorizationLine" (
        "id", "returnAuthorizationId", "returnRequestLineId",
        "authorizedQuantity", "dispositionRoute"
      ) VALUES (
        $1, $2, $3, 2, 'receive_to_quarantine'
      )
    `,
    [authorizationLineId, authorizationId, requestLineId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnPostingDocument" (
        "id", "tenantId", "postingNumber", "returnAuthorizationId",
        "postingType", "warehouseId", "updatedAt"
      ) VALUES (
        $1, $2, 'RET-POST-1', $3, 'customer_return_receipt', $4, NOW()
      )
    `,
    [postingId, tenantId, authorizationId, warehouseId],
  );
  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnPostingLine" (
        "id", "returnPostingId", "returnAuthorizationLineId", "itemId",
        "sku", "itemName", "quantity", "unit", "warehouseId", "location",
        "locationKey", "quarantineBalanceId"
      ) VALUES (
        $1, $2, $3, $4, 'SKU-RET-1', 'Return Item', 2, 'EA', $5,
        'Q-01', 'q-01', $6
      )
    `,
    [
      `${prefix}-posting-line`,
      postingId,
      authorizationLineId,
      itemId,
      warehouseId,
      quarantineId,
    ],
  );

  const balances = await query(
    pg,
    database,
    `
      SELECT
        (SELECT "onHandQuantity"::text FROM "InventoryBalance" WHERE "id" = $1) AS available_on_hand,
        (SELECT "reservedQuantity"::text FROM "InventoryBalance" WHERE "id" = $1) AS available_reserved,
        (SELECT "availableQuantity"::text FROM "InventoryBalance" WHERE "id" = $1) AS available_quantity,
        (SELECT "onHandQuantity"::text FROM "QuarantineInventoryBalance" WHERE "id" = $2) AS quarantine_on_hand
    `,
    [availableId, quarantineId],
  );
  assert.deepEqual(balances.rows[0], {
    available_on_hand: "10.0000",
    available_reserved: "2.0000",
    available_quantity: "8.0000",
    quarantine_on_hand: "4.0000",
  });

  const chain = await query(
    pg,
    database,
    `
      SELECT
        rr."returnType",
        ra."workflowStatus" AS authorization_status,
        ral."dispositionRoute",
        rpd."postingType",
        rpl."quarantineBalanceId",
        rpl."inventoryBalanceId",
        rpl."destinationInventoryBalanceId"
      FROM "ReturnRequest" rr
      JOIN "ReturnAuthorization" ra ON ra."returnRequestId" = rr."id"
      JOIN "ReturnAuthorizationLine" ral ON ral."returnAuthorizationId" = ra."id"
      JOIN "ReturnPostingDocument" rpd ON rpd."returnAuthorizationId" = ra."id"
      JOIN "ReturnPostingLine" rpl ON rpl."returnPostingId" = rpd."id"
      WHERE rr."id" = $1
    `,
    [requestId],
  );
  assert.deepEqual(chain.rows[0], {
    returnType: "customer_return",
    authorization_status: "approved",
    dispositionRoute: "receive_to_quarantine",
    postingType: "customer_return_receipt",
    quarantineBalanceId: quarantineId,
    inventoryBalanceId: null,
    destinationInventoryBalanceId: null,
  });

  await expectDatabaseError(
    pg,
    database,
    `
      INSERT INTO "QuarantineInventoryBalance" (
        "id", "tenantId", "itemId", "sku", "warehouseId", "warehouseKey",
        "locationKey", "onHandQuantity", "updatedAt"
      ) VALUES (
        '${prefix}-negative', '${tenantId}', '${itemId}', 'SKU-RET-NEG',
        '${warehouseId}', '${warehouseId}', 'q-neg', -1, NOW()
      )
    `,
    "23514",
  );

  await expectDatabaseError(
    pg,
    database,
    `
      INSERT INTO "QuarantineInventoryBalance" (
        "id", "tenantId", "itemId", "sku", "warehouseId", "warehouseKey",
        "location", "locationKey", "onHandQuantity", "updatedAt"
      ) VALUES (
        '${prefix}-duplicate', '${tenantId}', '${itemId}', 'SKU-RET-1',
        '${warehouseId}', '${warehouseId}', 'Different Label', 'q-01', 1, NOW()
      )
    `,
    "23505",
  );

  await query(
    pg,
    database,
    `
      INSERT INTO "ReturnPostingDocument" (
        "id", "tenantId", "postingNumber", "returnAuthorizationId",
        "postingType", "warehouseId", "updatedAt"
      ) VALUES ($1, $2, $3, $4, 'customer_return_receipt', $5, NOW())
    `,
    [
      emptyPostingId,
      tenantId,
      `RET-EMPTY-${prefix}`,
      authorizationId,
      warehouseId,
    ],
  );
  await expectDatabaseError(
    pg,
    database,
    `
      INSERT INTO "ReturnPostingLine" (
        "id", "returnPostingId", "returnAuthorizationLineId", "itemId",
        "sku", "itemName", "quantity", "warehouseId"
      ) VALUES (
        '${prefix}-empty-target', '${emptyPostingId}', '${authorizationLineId}',
        '${itemId}', 'SKU-RET-1', 'Return Item', 1, '${warehouseId}'
      )
    `,
    "23514",
  );
}

async function verifyFresh(pg, database, url, secrets) {
  console.log("\n[fresh] Applying all migrations");
  await deploy(url, secrets);
  await assertFoundationTables(pg, database);
  await seedCore(pg, database, "fresh");
  await verifyFoundationFacts(pg, database, "fresh");
  await verifyAuthoritativeSelectors(url, "fresh");
}

async function verifyUpgrade(pg, database, url, secrets) {
  console.log("\n[phase-4a-upgrade] Applying migrations through Phase 4A");
  const oldMigrations = await applyPhase4ABaseline(
    pg,
    database,
    url,
    secrets,
  );
  assert.equal(oldMigrations.at(-1), "20260716010000_inventory_operations_foundation");
  await seedCore(pg, database, "upgrade");
  console.log("[phase-4a-upgrade] Applying Phase 4B.0 additive migration");
  await deploy(url, secrets);
  await assertFoundationTables(pg, database);
  await verifyFoundationFacts(pg, database, "upgrade");
  await verifyAuthoritativeSelectors(url, "upgrade");
  const preserved = await query(
    pg,
    database,
    `
      SELECT "onHandQuantity"::text AS on_hand,
             "reservedQuantity"::text AS reserved,
             "availableQuantity"::text AS available
      FROM "InventoryBalance" WHERE "id" = 'upgrade-available'
    `,
  );
  assert.deepEqual(preserved.rows[0], {
    on_hand: "10.0000",
    reserved: "2.0000",
    available: "8.0000",
  });
}

const pgPort = await availablePort();
const user = "flowchain_returns";
const password = `local-${randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), "flowchain-returns-pg-"));
const freshDatabase = "flowchain_returns_fresh_test";
const upgradeDatabase = "flowchain_returns_upgrade_test";
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user,
  password,
  port: pgPort,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(freshDatabase);
  await pg.createDatabase(upgradeDatabase);
  const secrets = [password];
  await verifyFresh(
    pg,
    freshDatabase,
    databaseUrl({
      port: pgPort,
      user,
      password,
      database: freshDatabase,
    }),
    secrets,
  );
  await verifyUpgrade(
    pg,
    upgradeDatabase,
    databaseUrl({
      port: pgPort,
      user,
      password,
      database: upgradeDatabase,
    }),
    secrets,
  );
  console.log("PostgreSQL returns and quarantine foundation verification: PASS");
} finally {
  await pg.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
