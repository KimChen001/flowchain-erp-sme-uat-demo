import assert from "node:assert/strict";
import test from "node:test";
import { handleOperationalFinanceRoute } from "./operational-finance.routes.mjs";

function context({
  path = "/api/finance/supplier-invoices",
  method = "GET",
  enabled = true,
  read,
  command,
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
