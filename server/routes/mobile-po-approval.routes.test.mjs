import assert from "node:assert/strict";
import test from "node:test";
import { handleMobileOperationsRoute } from "./mobile-operations.routes.mjs";

function ctx(method, path, service, body = {}) { const sent = []; return { sent, value: { req: { method }, res: {}, url: new URL(`http://local${path}`), identity: { authenticated: true, tenantId: "tenant", userId: "user", role: "admin" }, env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_MOBILE_OPERATIONS: "true" }, mobileOperationsPrisma: {}, mobileOperationsService: service, readBody: async () => body, send: (_res, status, payload) => sent.push({ status, payload }) } }; }

test("mobile PO facade lists tasks, returns redacted-ready detail, and dispatches canonical actions", async () => {
  const actions = [];
  const service = { listTasks: async () => ({ items: [{ taskId: "purchase_order_approval:PO-1" }], total: 1 }), purchaseOrderDetail: async (id) => ({ id, entityVersion: 2, fieldVisibility: { procurement_prices: { visible: false } }, amountSummary: null }), actOnPurchaseOrder: async (id, action, body) => (actions.push({ id, action, body }), { entityId: id, status: "approved", entityVersion: 3, pendingSync: false }) };
  const tasks = ctx("GET", "/api/mobile/tasks", service); await handleMobileOperationsRoute(tasks.value); assert.equal(tasks.sent[0].payload.total, 1);
  const detail = ctx("GET", "/api/mobile/purchase-orders/PO-1", service); await handleMobileOperationsRoute(detail.value); assert.equal(detail.sent[0].payload.amountSummary, null);
  const approve = ctx("POST", "/api/mobile/purchase-orders/PO-1/approve", service, { expectedVersion: 2, idempotencyKey: "approve-1" }); await handleMobileOperationsRoute(approve.value); assert.equal(approve.sent[0].payload.pendingSync, false); assert.deepEqual(actions[0], { id: "PO-1", action: "approve", body: { expectedVersion: 2, idempotencyKey: "approve-1" } });
});
