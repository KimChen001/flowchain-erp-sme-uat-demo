import assert from "node:assert/strict";
import test from "node:test";
import { handleOperationalFinanceRoute } from "./operational-finance.routes.mjs";

function context({
  path = "/api/finance/supplier-invoices",
  method = "GET",
  enabled = true,
  read,
  command,
  o2cRead,
  o2cCommand,
  settlementRead,
  settlementCommand,
  body = {},
} = {}) {
  const sent = [];
  const ctx = {
    req: { method },
    res: {},
    url: new URL(`http://localhost${path}`),
    env: {
      FLOWCHAIN_PERSISTENCE_MODE: "database",
      FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: String(enabled),
      FLOWCHAIN_ENABLE_DB_INTERNAL_SETTLEMENT: String(enabled),
    },
    identity: {
      authenticated: true,
      tenantId: "signed-tenant",
      userId: "signed-user",
      role: "manager",
    },
    operationalFinancePrisma: {},
    operationalFinanceReadService:
      read ||
      ({
        listSupplierInvoices: async () => ({ items: [] }),
      }),
    operationalFinanceCommandService: command || {},
    operationalFinanceO2cReadService: o2cRead || {},
    operationalFinanceO2cCommandService: o2cCommand || {},
    internalSettlementReadService: settlementRead || {},
    internalSettlementCommandService: settlementCommand || {},
    readBody: async () => body,
    send: (_res, status, payload) => sent.push({ status, payload }),
  };
  return { ctx, sent };
}

test("finance writes fail closed when the explicit capability is disabled", async () => {
  const { ctx, sent } = context({
    path: "/api/finance/supplier-invoices/preview",
    method: "POST",
    enabled: false,
  });
  assert.equal(await handleOperationalFinanceRoute(ctx), true);
  assert.deepEqual(sent, [
    {
      status: 409,
      payload: {
        code: "OPERATIONAL_FINANCE_CAPABILITY_NOT_AVAILABLE",
        message:
          "Operational finance requires database persistence and explicit enablement.",
        details: { capability: "supplier-invoice" },
      },
    },
  ]);
});

test("O2C routes use focused capabilities and the centrally resolved tenant", async () => {
  let observed;
  const { ctx, sent } = context({
    path: "/api/finance/customer-invoices?tenantId=forged-tenant",
    o2cRead: {
      listCustomerInvoices: async (query, requestContext) => {
        observed = {
          query,
          tenantId: requestContext.identity.tenantId,
        };
        return { items: [], tenantId: requestContext.identity.tenantId };
      },
    },
  });
  assert.equal(await handleOperationalFinanceRoute(ctx), true);
  assert.deepEqual(observed, {
    query: { tenantId: "forged-tenant" },
    tenantId: "signed-tenant",
  });
  assert.equal(sent[0].payload.tenantId, "signed-tenant");

  const disabled = context({
    path: "/api/finance/customer-invoices/preview",
    method: "POST",
    enabled: false,
  });
  assert.equal(await handleOperationalFinanceRoute(disabled.ctx), true);
  assert.equal(disabled.sent[0].status, 409);
  assert.equal(disabled.sent[0].payload.details.capability, "customer-invoice");
});

test("finance routes never expose Prisma error codes or raw messages", async () => {
  const { ctx, sent } = context({
    path: "/api/finance/supplier-invoices/preview",
    method: "POST",
    command: {
      previewSupplierInvoice: async () => {
        throw Object.assign(new Error("Unique constraint P2002 on secret_field"), {
          code: "P2002",
        });
      },
    },
  });
  assert.equal(await handleOperationalFinanceRoute(ctx), true);
  assert.equal(sent[0].status, 500);
  assert.deepEqual(sent[0].payload, {
    code: "OPERATIONAL_FINANCE_FAILED",
    message: "Operational finance could not be completed.",
  });
  assert.doesNotMatch(JSON.stringify(sent[0].payload), /P2002|secret_field/);
});

test("finance read routes receive only the centrally resolved request context", async () => {
  let observed;
  const { ctx, sent } = context({
    read: {
      listSupplierInvoices: async (query, requestContext) => {
        observed = {
          query,
          tenantId: requestContext.identity.tenantId,
          userId: requestContext.identity.userId,
        };
        return { items: [], tenantId: requestContext.identity.tenantId };
      },
    },
  });
  ctx.url = new URL(
    "http://localhost/api/finance/supplier-invoices?tenantId=forged-tenant",
  );
  assert.equal(await handleOperationalFinanceRoute(ctx), true);
  assert.deepEqual(observed, {
    query: { tenantId: "forged-tenant" },
    tenantId: "signed-tenant",
    userId: "signed-user",
  });
  assert.equal(sent[0].payload.tenantId, "signed-tenant");
});

test("internal settlement routes use signed context and focused capability", async () => {
  let observed;
  const { ctx, sent } = context({
    path: "/api/finance/settlements/SET-1/post",
    method: "POST",
    body: { expectedVersion: 0, idempotencyKey: "post-1", tenantId: "forged" },
    settlementCommand: {
      postSettlement: async (id, body, requestContext) => {
        observed = { id, body, tenantId: requestContext.identity.tenantId };
        return { entityId: id, status: "posted" };
      },
    },
  });
  assert.equal(await handleOperationalFinanceRoute(ctx), true);
  assert.equal(sent[0].status, 200);
  assert.deepEqual(observed, { id: "SET-1", body: { expectedVersion: 0, idempotencyKey: "post-1", tenantId: "forged" }, tenantId: "signed-tenant" });

  const disabled = context({ path: "/api/finance/settlements/SET-1/post", method: "POST", enabled: false });
  assert.equal(await handleOperationalFinanceRoute(disabled.ctx), true);
  assert.equal(disabled.sent[0].status, 409);
  assert.equal(disabled.sent[0].payload.details.capability, "internal-settlement");
});

test("cashbook and reconciliation reads never trust a client tenant", async () => {
  const observed = [];
  const settlementRead = {
    listEntries: async (query, requestContext) => { observed.push({ query, tenantId: requestContext.identity.tenantId }); return { items: [] }; },
    reconciliation: async (id, requestContext) => { observed.push({ id, tenantId: requestContext.identity.tenantId }); return { status: "matched" }; },
  };
  const entries = context({ path: "/api/finance/cashbook/entries?tenantId=forged", settlementRead });
  await handleOperationalFinanceRoute(entries.ctx);
  const evidence = context({ path: "/api/finance/settlements/SET-1/reconciliation?tenantId=forged", settlementRead });
  await handleOperationalFinanceRoute(evidence.ctx);
  assert.deepEqual(observed, [{ query: { tenantId: "forged" }, tenantId: "signed-tenant" }, { id: "SET-1", tenantId: "signed-tenant" }]);
});
