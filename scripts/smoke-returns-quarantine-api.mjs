import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { createPrismaClient } from "../server/persistence/prisma-client.mjs";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const node = process.execPath;
const prismaCli = join(root, "node_modules", "prisma", "build", "index.js");
const tenantId = "tenant-returns-api";
const warehouseId = "warehouse-returns-api";
const itemId = "item-returns-api";
const sku = "RET-API-SKU";
const emails = {
  manager: "returns-manager@flowchain.invalid",
  specialist: "returns-specialist@flowchain.invalid",
  buyer: "returns-buyer@flowchain.invalid",
  viewer: "returns-viewer@flowchain.invalid",
};
const userId = (email) =>
  `USR-${createHash("sha256").update(email).digest("hex").slice(0, 16)}`;

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer().on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function waitFor(url) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("API server did not become ready");
}

function startApi(env) {
  const child = spawn(node, ["server/index.mjs"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => {
    if (/error|failed|exception/i.test(String(chunk)))
      process.stderr.write(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    const safe = String(chunk).replace(
      /postgres(?:ql)?:\/\/[^\s]+/gi,
      "[REDACTED_DATABASE_URL]",
    );
    if (safe.trim()) process.stderr.write(safe);
  });
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolveExit) => child.once("exit", resolveExit)),
    new Promise((resolveWait) => setTimeout(resolveWait, 3_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function raw(base, path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    throw new Error(
      `${method} ${path} returned non-JSON status=${response.status} body=${responseText.slice(0, 500)}`,
    );
  }
  if (!responseText)
    throw new Error(`${method} ${path} returned an empty ${response.status}`);
  return { response, payload };
}

async function request(base, path, options = {}) {
  const result = await raw(base, path, options);
  if (!result.response.ok)
    throw new Error(
      `${options.method || "GET"} ${path}: ${result.payload.code || result.response.status} ${result.payload.message || ""}`,
    );
  return result.payload;
}

async function login(base, email) {
  const result = await request(base, "/api/auth/login", {
    method: "POST",
    body: { email, name: "Ignored", company: "Ignored" },
  });
  assert.equal(result.user.id, userId(email));
  return result.token;
}

async function seed(prisma) {
  await prisma.tenant.create({
    data: { id: tenantId, name: "Returns API Tenant" },
  });
  await prisma.warehouse.create({
    data: {
      id: warehouseId,
      tenantId,
      code: "RET-API",
      name: "Returns API Warehouse",
    },
  });
  const users = [
    [emails.manager, "Returns Manager", "manager"],
    [emails.specialist, "Returns Specialist", "business-specialist"],
    [emails.buyer, "Returns Buyer", "buyer"],
    [emails.viewer, "Returns Viewer", "viewer"],
  ];
  for (const [email, name, role] of users) {
    const id = userId(email);
    await prisma.user.create({
      data: { id, tenantId, email, name, role },
    });
    await prisma.userWarehouseScope.create({
      data: {
        id: randomUUID(),
        tenantId,
        userId: id,
        warehouseId,
        accessLevel: role === "viewer" ? "read" : "operate",
      },
    });
  }
  await prisma.item.create({
    data: {
      id: itemId,
      tenantId,
      sku,
      name: "Returns API Item",
      unit: "EA",
    },
  });
  await prisma.inventoryBalance.create({
    data: {
      id: "available-returns-api",
      tenantId,
      itemId,
      sku,
      itemName: "Returns API Item",
      warehouseId,
      warehouseKey: warehouseId,
      location: "A-01",
      locationKey: "a-01",
      onHandQuantity: "20",
      reservedQuantity: "0",
      availableQuantity: "20",
      unit: "EA",
    },
  });
  await prisma.quarantineInventoryBalance.create({
    data: {
      id: "quarantine-returns-api",
      tenantId,
      itemId,
      sku,
      itemName: "Returns API Item",
      warehouseId,
      warehouseKey: warehouseId,
      location: "Q-01",
      locationKey: "q-01",
      onHandQuantity: "5",
      unit: "EA",
    },
  });
  await prisma.salesOrder.create({
    data: {
      id: "sales-order-returns-api",
      tenantId,
      orderNumber: "SO-RET-API",
      customerId: "customer-returns-api",
      customerName: "Returns Customer",
      workflowStatus: "confirmed",
      fulfillmentStatus: "partially_fulfilled",
      currency: "CNY",
      lines: {
        create: {
          id: "sales-line-returns-api",
          itemId,
          sku,
          itemName: "Returns API Item",
          orderedQuantity: "10",
          fulfilledQuantity: "8",
          unit: "EA",
        },
      },
    },
  });
  await prisma.inventoryReservation.create({
    data: {
      id: "reservation-returns-api",
      tenantId,
      salesOrderId: "sales-order-returns-api",
      salesOrderLineId: "sales-line-returns-api",
      itemId,
      sku,
      warehouseId,
      location: "A-01",
      locationKey: "a-01",
      reservedQuantity: "8",
      allocatedQuantity: "0",
      consumedQuantity: "8",
      releasedQuantity: "0",
      status: "consumed",
      reservedById: userId(emails.manager),
    },
  });
  await prisma.shipmentDocument.create({
    data: {
      id: "shipment-returns-api",
      tenantId,
      shipmentNumber: "SHIP-RET-API",
      salesOrderId: "sales-order-returns-api",
      workflowStatus: "ready",
      postingStatus: "posted",
      postedAt: new Date(),
      postedById: userId(emails.manager),
      lines: {
        create: {
          id: "shipment-line-returns-api",
          salesOrderLineId: "sales-line-returns-api",
          itemId,
          sku,
          requestedQuantity: "8",
          postedQuantity: "8",
          unit: "EA",
          allocations: {
            create: {
              id: "shipment-allocation-returns-api",
              tenantId,
              reservationId: "reservation-returns-api",
              warehouseId,
              location: "A-01",
              locationKey: "a-01",
              quantity: "8",
              status: "consumed",
            },
          },
        },
      },
    },
  });
  await prisma.purchaseOrder.create({
    data: {
      id: "purchase-order-returns-api",
      tenantId,
      status: "issued",
      supplierId: "supplier-returns-api",
      supplierName: "Returns Supplier",
      currency: "CNY",
      lines: {
        create: {
          id: "purchase-line-returns-api",
          itemId,
          sku,
          itemName: "Returns API Item",
          orderedQuantity: "10",
          receivedQuantity: "10",
          unit: "EA",
        },
      },
    },
  });
  await prisma.receivingDocument.create({
    data: {
      id: "receiving-returns-api",
      tenantId,
      documentNumber: "GRN-RET-API",
      poId: "purchase-order-returns-api",
      supplierId: "supplier-returns-api",
      supplierName: "Returns Supplier",
      workflowStatus: "approved",
      postingStatus: "posted",
      postedAt: new Date(),
      postedById: userId(emails.manager),
      warehouseId,
      currency: "CNY",
      lines: {
        create: {
          id: "receiving-line-returns-api",
          purchaseOrderLineId: "purchase-line-returns-api",
          itemId,
          sku,
          itemName: "Returns API Item",
          acceptedQty: "10",
          rejectedQty: "0",
          unit: "EA",
          warehouseId,
          location: "A-01",
          locationKey: "a-01",
        },
      },
    },
  });

  const otherTenant = "tenant-returns-other";
  await prisma.tenant.create({
    data: { id: otherTenant, name: "Other Returns Tenant" },
  });
  await prisma.item.create({
    data: {
      id: "other-item",
      tenantId: otherTenant,
      sku: "OTHER-SKU",
      name: "Other Item",
      unit: "EA",
    },
  });
  await prisma.salesOrder.create({
    data: {
      id: "other-sales-order",
      tenantId: otherTenant,
      orderNumber: "SO-OTHER",
      customerName: "Other Customer",
      workflowStatus: "confirmed",
      currency: "CNY",
      lines: {
        create: {
          id: "other-sales-line",
          itemId: "other-item",
          sku: "OTHER-SKU",
          itemName: "Other Item",
          orderedQuantity: "2",
          fulfilledQuantity: "2",
          unit: "EA",
        },
      },
    },
  });
  await prisma.shipmentDocument.create({
    data: {
      id: "other-shipment",
      tenantId: otherTenant,
      shipmentNumber: "SHIP-OTHER",
      salesOrderId: "other-sales-order",
      workflowStatus: "ready",
      postingStatus: "posted",
      postedAt: new Date(),
      lines: {
        create: {
          id: "other-shipment-line",
          salesOrderLineId: "other-sales-line",
          itemId: "other-item",
          sku: "OTHER-SKU",
          requestedQuantity: "2",
          postedQuantity: "2",
          unit: "EA",
        },
      },
    },
  });
}

async function protectedFacts(prisma) {
  const [
    inventoryBalances,
    quarantineBalances,
    movements,
    reservations,
    shipments,
    receivingDocuments,
  ] = await Promise.all([
    prisma.inventoryBalance.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    prisma.quarantineInventoryBalance.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    prisma.inventoryMovement.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    prisma.inventoryReservation.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    prisma.shipmentDocument.findMany({
      where: { tenantId },
      include: { lines: { include: { allocations: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.receivingDocument.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { id: "asc" },
    }),
  ]);
  return JSON.parse(
    JSON.stringify({
      inventoryBalances,
      quarantineBalances,
      movements,
      reservations,
      shipments,
      receivingDocuments,
    }),
  );
}

const requestBody = ({
  requestNumber,
  returnType = "customer_return",
  contextDocumentType = "SalesOrder",
  contextDocumentId = "sales-order-returns-api",
  sourceDocumentLineId = "shipment-line-returns-api",
  requestedQuantity = "3",
  idempotencyKey,
} = {}) => ({
  requestNumber,
  returnType,
  contextDocumentType,
  contextDocumentId,
  reasonCode: "damaged",
  reasonDetail: "API governed return",
  idempotencyKey,
  tenantId: "forged-tenant",
  lines: [
    {
      sourceDocumentLineId,
      requestedQuantity,
      itemId: "forged-item",
      sku: "FORGED",
      itemName: "Forged",
      unit: "BOX",
    },
  ],
});

const pgPort = await freePort();
const apiPort = await freePort();
const password = `local-${randomUUID()}`;
const directory = await mkdtemp(join(tmpdir(), "flowchain-returns-api-"));
const database = "flowchain_returns_api";
const databaseUrl = `postgresql://flowchain_returns_api:${encodeURIComponent(password)}@127.0.0.1:${pgPort}/${database}?schema=public`;
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "flowchain_returns_api",
  password,
  port: pgPort,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_TEST: databaseUrl,
  FLOWCHAIN_PERSISTENCE_MODE: "database",
  FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE: "true",
  FLOWCHAIN_DEFAULT_TENANT_ID: tenantId,
  FLOWCHAIN_ALLOW_LOCAL_ACTOR_BOOTSTRAP: "false",
  FLOWCHAIN_LOCAL_SESSION_SECRET: `returns-api-${randomUUID()}-secure`,
  SCM_API_PORT: String(apiPort),
  NODE_ENV: "production",
};
const base = `http://127.0.0.1:${apiPort}`;
let api;
let prisma;

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase(database);
  await execFileAsync(node, [prismaCli, "migrate", "deploy"], {
    cwd: root,
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
  prisma = await createPrismaClient(env);
  await seed(prisma);
  const before = await protectedFacts(prisma);

  api = startApi(env);
  await waitFor(`${base}/api/health`);
  const manager = await login(base, emails.manager);
  const specialist = await login(base, emails.specialist);
  const buyer = await login(base, emails.buyer);
  const viewer = await login(base, emails.viewer);

  const duplicatePreview = await request(
    base,
    "/api/returns/requests/preview",
    {
      token: manager,
      method: "POST",
      body: {
        ...requestBody({
          requestNumber: "RET-DUP",
          idempotencyKey: undefined,
        }),
        lines: [
          {
            sourceDocumentLineId: "shipment-line-returns-api",
            requestedQuantity: "1",
          },
          {
            sourceDocumentLineId: "shipment-line-returns-api",
            requestedQuantity: "1",
          },
        ],
      },
    },
  );
  assert.equal(duplicatePreview.allowed, false);
  assert.ok(
    duplicatePreview.blockingIssues.some(
      (row) => row.code === "RETURN_SOURCE_LINE_DUPLICATE",
    ),
  );

  const crossTenantPreview = await request(
    base,
    "/api/returns/requests/preview",
    {
      token: manager,
      method: "POST",
      body: requestBody({
        requestNumber: "RET-CROSS",
        contextDocumentType: "ShipmentDocument",
        contextDocumentId: "other-shipment",
        sourceDocumentLineId: "other-shipment-line",
      }),
    },
  );
  assert.equal(crossTenantPreview.allowed, false);

  const created = await request(base, "/api/returns/requests", {
    token: manager,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-CUST-001",
      idempotencyKey: "create-customer-return",
    }),
  });
  assert.equal(created.request.workflowStatus, "draft");
  assert.equal(created.inventoryMutation, false);
  const replay = await request(base, "/api/returns/requests", {
    token: manager,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-CUST-001",
      idempotencyKey: "create-customer-return",
    }),
  });
  assert.equal(replay.entityId, created.entityId);
  assert.equal(replay.idempotentReplay, true);
  const changedReplay = await raw(base, "/api/returns/requests", {
    token: manager,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-CUST-001",
      requestedQuantity: "2",
      idempotencyKey: "create-customer-return",
    }),
  });
  assert.equal(changedReplay.response.status, 409);
  assert.equal(
    changedReplay.payload.code,
    "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
  );

  const draftWorkbench = await request(
    base,
    `/api/returns/requests/${created.entityId}/workbench`,
    { token: viewer },
  );
  assert.equal(draftWorkbench.lines[0].itemId, itemId);
  assert.equal(draftWorkbench.lines[0].sku, sku);
  assert.equal(draftWorkbench.lines[0].unit, "EA");
  assert.equal(draftWorkbench.lines[0].sourceQuantity, "8.0000");
  assert.equal(draftWorkbench.availableActions.revise, false);

  const staleSubmit = await raw(
    base,
    `/api/returns/requests/${created.entityId}/submit`,
    {
      token: manager,
      method: "POST",
      body: { expectedVersion: 9, idempotencyKey: "stale-submit" },
    },
  );
  assert.equal(staleSubmit.response.status, 409);
  assert.equal(staleSubmit.payload.code, "RETURN_REQUEST_VERSION_CONFLICT");

  const submitted = await request(
    base,
    `/api/returns/requests/${created.entityId}/submit`,
    {
      token: manager,
      method: "POST",
      body: { expectedVersion: 0, idempotencyKey: "submit-customer-return" },
    },
  );
  assert.equal(submitted.request.workflowStatus, "submitted");
  const frozenRevision = await raw(
    base,
    `/api/returns/requests/${created.entityId}`,
    {
      token: manager,
      method: "PATCH",
      body: {
        ...requestBody({
          requestNumber: "RET-CUST-001",
          idempotencyKey: "revise-frozen",
        }),
        expectedVersion: 1,
      },
    },
  );
  assert.equal(frozenRevision.response.status, 409);
  assert.equal(frozenRevision.payload.code, "RETURN_REQUEST_FROZEN");

  const tooMuchAuthorization = await request(
    base,
    `/api/returns/requests/${created.entityId}/authorization-preview`,
    {
      token: manager,
      method: "POST",
      body: {
        authorizationNumber: "AUTH-TOO-MUCH",
        lines: [
          {
            returnRequestLineId: draftWorkbench.lines[0].id,
            authorizedQuantity: "4",
            dispositionRoute: "receive_to_quarantine",
          },
        ],
      },
    },
  );
  assert.equal(tooMuchAuthorization.allowed, false);
  assert.ok(
    tooMuchAuthorization.blockingIssues.some(
      (row) => row.code === "RETURN_AUTHORIZATION_EXCEEDS_REQUEST",
    ),
  );

  const specialistAuthorization = await raw(
    base,
    `/api/returns/requests/${created.entityId}/authorize`,
    {
      token: specialist,
      method: "POST",
      body: {
        expectedRequestVersion: 1,
        authorizationNumber: "AUTH-SPECIALIST",
        idempotencyKey: "specialist-authorize",
        lines: [
          {
            returnRequestLineId: draftWorkbench.lines[0].id,
            authorizedQuantity: "3",
            dispositionRoute: "receive_to_quarantine",
          },
        ],
      },
    },
  );
  assert.equal(specialistAuthorization.response.status, 403);

  const authorized = await request(
    base,
    `/api/returns/requests/${created.entityId}/authorize`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedRequestVersion: 1,
        authorizationNumber: "AUTH-CUST-001",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        idempotencyKey: "authorize-customer-return",
        lines: [
          {
            returnRequestLineId: draftWorkbench.lines[0].id,
            authorizedQuantity: "3",
            dispositionRoute: "receive_to_quarantine",
          },
        ],
      },
    },
  );
  assert.equal(authorized.authorization.workflowStatus, "approved");
  assert.equal(authorized.request.workflowStatus, "authorized");
  assert.equal(authorized.inventoryMutation, false);

  const secondAuthorization = await raw(
    base,
    `/api/returns/requests/${created.entityId}/authorize`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedRequestVersion: 2,
        authorizationNumber: "AUTH-CUST-002",
        idempotencyKey: "second-authorization",
        lines: [
          {
            returnRequestLineId: draftWorkbench.lines[0].id,
            authorizedQuantity: "1",
            dispositionRoute: "receive_to_quarantine",
          },
        ],
      },
    },
  );
  assert.equal(secondAuthorization.response.status, 409);

  const cumulative = await request(
    base,
    "/api/returns/requests/preview",
    {
      token: specialist,
      method: "POST",
      body: requestBody({
        requestNumber: "RET-CUST-CUMULATIVE",
        requestedQuantity: "6",
      }),
    },
  );
  assert.equal(cumulative.allowed, false, JSON.stringify(cumulative));
  assert.ok(
    cumulative.blockingIssues.some(
      (row) => row.code === "RETURN_QUANTITY_EXCEEDS_SOURCE",
    ),
  );

  const revisable = await request(base, "/api/returns/requests", {
    token: specialist,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-CUST-REVISE",
      requestedQuantity: "1",
      idempotencyKey: "create-revisable-return",
    }),
  });
  const revised = await request(
    base,
    `/api/returns/requests/${revisable.entityId}`,
    {
      token: specialist,
      method: "PATCH",
      body: {
        ...requestBody({
          requestNumber: "RET-CUST-REVISED",
          requestedQuantity: "2",
          idempotencyKey: "revise-return",
        }),
        expectedVersion: 0,
      },
    },
  );
  assert.equal(revised.request.requestNumber, "RET-CUST-REVISED");
  assert.equal(revised.request.version, 1);
  const cancelledRequest = await request(
    base,
    `/api/returns/requests/${revisable.entityId}/cancel`,
    {
      token: specialist,
      method: "POST",
      body: {
        expectedVersion: 1,
        reason: "Draft no longer required",
        idempotencyKey: "cancel-revised-return",
      },
    },
  );
  assert.equal(cancelledRequest.request.workflowStatus, "cancelled");

  const buyerCustomer = await raw(base, "/api/returns/requests/preview", {
    token: buyer,
    method: "POST",
    body: requestBody({ requestNumber: "RET-BUYER-CUSTOMER" }),
  });
  assert.equal(buyerCustomer.response.status, 403);

  const supplierCreated = await request(base, "/api/returns/requests", {
    token: buyer,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-SUP-001",
      returnType: "supplier_return",
      contextDocumentType: "PurchaseOrder",
      contextDocumentId: "purchase-order-returns-api",
      sourceDocumentLineId: "receiving-line-returns-api",
      requestedQuantity: "2",
      idempotencyKey: "create-supplier-return",
    }),
  });
  const supplierSubmitted = await request(
    base,
    `/api/returns/requests/${supplierCreated.entityId}/submit`,
    {
      token: buyer,
      method: "POST",
      body: { expectedVersion: 0, idempotencyKey: "submit-supplier-return" },
    },
  );
  assert.equal(supplierSubmitted.request.workflowStatus, "submitted");
  const supplierWorkbench = await request(
    base,
    `/api/returns/requests/${supplierCreated.entityId}/workbench`,
    { token: manager },
  );

  const wrongRequestLine = await request(
    base,
    `/api/returns/requests/${supplierCreated.entityId}/authorization-preview`,
    {
      token: manager,
      method: "POST",
      body: {
        authorizationNumber: "AUTH-WRONG-LINE",
        lines: [
          {
            returnRequestLineId: draftWorkbench.lines[0].id,
            authorizedQuantity: "1",
            dispositionRoute: "return_from_available",
          },
        ],
      },
    },
  );
  assert.equal(wrongRequestLine.allowed, false);
  assert.ok(
    wrongRequestLine.blockingIssues.some(
      (row) => row.code === "RETURN_AUTHORIZATION_LINE_INVALID",
    ),
  );

  const supplierAuthorized = await request(
    base,
    `/api/returns/requests/${supplierCreated.entityId}/authorize`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedRequestVersion: 1,
        authorizationNumber: "AUTH-SUP-001",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        idempotencyKey: "authorize-supplier-return",
        lines: [
          {
            returnRequestLineId: supplierWorkbench.lines[0].id,
            authorizedQuantity: "2",
            dispositionRoute: "return_from_available",
          },
        ],
      },
    },
  );
  const cancelledAuthorization = await request(
    base,
    `/api/returns/authorizations/${supplierAuthorized.authorization.id}/cancel`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedAuthorizationVersion: 0,
        expectedRequestVersion: 2,
        reason: "Supplier authorization replaced",
        idempotencyKey: "cancel-supplier-authorization",
      },
    },
  );
  assert.equal(
    cancelledAuthorization.authorization.workflowStatus,
    "cancelled",
  );
  assert.equal(cancelledAuthorization.request.workflowStatus, "submitted");

  const expiringAuthorized = await request(
    base,
    `/api/returns/requests/${supplierCreated.entityId}/authorize`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedRequestVersion: 3,
        authorizationNumber: "AUTH-SUP-EXP",
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        idempotencyKey: "authorize-supplier-expiring",
        lines: [
          {
            returnRequestLineId: supplierWorkbench.lines[0].id,
            authorizedQuantity: "2",
            dispositionRoute: "return_from_quarantine",
          },
        ],
      },
    },
  );
  await prisma.returnAuthorization.update({
    where: { id: expiringAuthorized.authorization.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await request(
    base,
    `/api/returns/authorizations/${expiringAuthorized.authorization.id}/expire`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedAuthorizationVersion: 0,
        expectedRequestVersion: 4,
        idempotencyKey: "expire-supplier-authorization",
      },
    },
  );
  assert.equal(expired.authorization.workflowStatus, "expired");
  assert.equal(expired.request.workflowStatus, "submitted");

  const rejectCreated = await request(base, "/api/returns/requests", {
    token: specialist,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-CUST-REJECT",
      requestedQuantity: "1",
      idempotencyKey: "create-reject-return",
    }),
  });
  await request(
    base,
    `/api/returns/requests/${rejectCreated.entityId}/submit`,
    {
      token: specialist,
      method: "POST",
      body: { expectedVersion: 0, idempotencyKey: "submit-reject-return" },
    },
  );
  const rejected = await request(
    base,
    `/api/returns/requests/${rejectCreated.entityId}/reject`,
    {
      token: manager,
      method: "POST",
      body: {
        expectedRequestVersion: 1,
        authorizationNumber: "AUTH-REJECT-001",
        reason: "Return evidence rejected",
        idempotencyKey: "reject-return",
      },
    },
  );
  assert.equal(rejected.request.workflowStatus, "rejected");
  assert.equal(rejected.authorization.workflowStatus, "rejected");

  assert.deepEqual(await protectedFacts(prisma), before);
  assert.equal(
    await prisma.businessCommandExecution.count({ where: { tenantId } }) > 0,
    true,
  );
  assert.equal(
    await prisma.auditLog.count({ where: { tenantId, module: "returns" } }) > 0,
    true,
  );

  await stop(api);
  api = startApi(env);
  await waitFor(`${base}/api/health`);
  const managerAfterRestart = await login(base, emails.manager);
  const persisted = await request(
    base,
    `/api/returns/requests/${created.entityId}/workbench`,
    { token: managerAfterRestart },
  );
  assert.equal(persisted.request.workflowStatus, "authorized");
  assert.equal(persisted.authorizations[0].workflowStatus, "approved");

  await stop(api);
  api = startApi({
    ...env,
    FLOWCHAIN_ENABLE_DB_RETURNS_QUARANTINE: "false",
  });
  await waitFor(`${base}/api/health`);
  const disabledToken = await login(base, emails.manager);
  const disabledRead = await request(
    base,
    `/api/returns/requests/${created.entityId}/workbench`,
    { token: disabledToken },
  );
  assert.equal(disabledRead.capabilities["return-request"].enabled, false);
  assert.ok(
    Object.values(disabledRead.availableActions)
      .filter((value) => typeof value === "boolean")
      .every((value) => value === false),
  );
  const disabledWrite = await raw(base, "/api/returns/requests", {
    token: disabledToken,
    method: "POST",
    body: requestBody({
      requestNumber: "RET-DISABLED",
      idempotencyKey: "disabled-return",
    }),
  });
  assert.equal(disabledWrite.response.status, 409);
  assert.equal(
    disabledWrite.payload.code,
    "RETURN_GOVERNANCE_CAPABILITY_NOT_AVAILABLE",
  );
  assert.deepEqual(await protectedFacts(prisma), before);

  console.log(
    "Returns and quarantine API smoke: PASS (request/authorization governance, PostgreSQL, signed roles, restart persistence, zero inventory mutation)",
  );
} finally {
  await stop(api);
  await prisma?.$disconnect().catch(() => {});
  await pg.stop().catch(() => {});
  await rm(directory, { recursive: true, force: true }).catch(() => {});
}
