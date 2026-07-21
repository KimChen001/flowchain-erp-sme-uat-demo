import assert from "node:assert/strict";
import test from "node:test";
import { handleMobileOperationsRoute } from "./mobile-operations.routes.mjs";

function ctx(method, path, service, body = {}) { const sent = []; return { sent, value: { req: { method }, res: {}, url: new URL(`http://local${path}`), identity: { authenticated: true, tenantId: "tenant", userId: "user", role: "admin" }, env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_MOBILE_OPERATIONS: "true" }, mobileOperationsPrisma: {}, mobileOperationsService: service, readBody: async () => body, send: (_res, status, payload) => sent.push({ status, payload }) } }; }

test("mobile receiving facade dispatches search, draft, submit, preview, post, and evidence reads", async () => {
  const calls = [];
  const service = { searchReceivingPurchaseOrders: async (search) => ({ items: [{ id: search }], total: 1 }), createReceivingDraft: async (body) => (calls.push(["create", body]), { entityId: "GRN-1" }), submitReceivingDraft: async (id, body) => (calls.push(["submit", id, body]), { entityId: id, receivingDocument: { workflowStatus: "ready_for_receiving" } }), previewReceiving: async (id) => ({ id, allowed: true }), postReceiving: async (id, body) => (calls.push(["post", id, body]), { receivingDocument: { id, postingStatus: "posted" } }), receivingEvidence: async (id) => ({ grn: { id }, inventoryImpact: [] }) };
  const search = ctx("GET", "/api/mobile/receiving/purchase-orders?search=PO-1", service); await handleMobileOperationsRoute(search.value); assert.equal(search.sent[0].payload.items[0].id, "PO-1");
  const draft = ctx("POST", "/api/mobile/receiving/drafts", service, { poId: "PO-1" }); await handleMobileOperationsRoute(draft.value); assert.equal(draft.sent[0].status, 201);
  const submit = ctx("POST", "/api/mobile/receiving/drafts/GRN-1/submit", service, { expectedVersion: 0 }); await handleMobileOperationsRoute(submit.value); assert.equal(submit.sent[0].payload.receivingDocument.workflowStatus, "ready_for_receiving");
  const preview = ctx("GET", "/api/mobile/receiving/GRN-1/preview", service); await handleMobileOperationsRoute(preview.value); assert.equal(preview.sent[0].payload.allowed, true);
  const post = ctx("POST", "/api/mobile/receiving/GRN-1/post", service, { expectedVersion: 1, idempotencyKey: "post-1" }); await handleMobileOperationsRoute(post.value); assert.equal(post.sent[0].payload.receivingDocument.postingStatus, "posted");
  const evidence = ctx("GET", "/api/mobile/receiving/GRN-1/inventory-impact", service); await handleMobileOperationsRoute(evidence.value); assert.equal(evidence.sent[0].payload.grn.id, "GRN-1"); assert.equal(calls.length, 3);
});
