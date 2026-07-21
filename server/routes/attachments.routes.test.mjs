import assert from "node:assert/strict";
import test from "node:test";
import { handleAttachmentRoute } from "./attachments.routes.mjs";

function context(method, path, service, body = {}, options = {}) {
  const sent = [], response = {
    headers: null,
    bytes: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(bytes) { this.bytes = bytes; },
  };
  return {
    sent,
    response,
    value: {
      req: { method },
      res: response,
      url: new URL(`http://local${path}`),
      identity: options.identity ?? { authenticated: true, tenantId: "tenant", userId: "user" },
      env: options.env ?? { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_SETTLEMENT_WORKFLOW: "true" },
      attachmentPrisma: {},
      attachmentService: service,
      readBody: async () => body,
      send: (_res, status, payload) => sent.push({ status, payload }),
    },
  };
}

test("attachment routes dispatch staged upload, evidence binding, status, and deletion", async () => {
  const calls = [];
  const service = {
    stageUpload: async (body) => (calls.push(["stage", body]), { uploadId: "upload-1" }),
    status: async (id) => (calls.push(["status", id]), { uploadId: id, status: "staged" }),
    bindSettlement: async (id, body) => (calls.push(["settlement", id, body]), { attachmentId: "settlement-attachment" }),
    bindReceiving: async (id, body) => (calls.push(["receiving", id, body]), { attachmentId: "receiving-attachment" }),
    deleteAttachment: async (id) => (calls.push(["delete", id]), { attachmentId: id, status: "deleted" }),
  };
  const stage = context("POST", "/api/uploads/stage", service, { fileName: "proof.txt" });
  assert.equal(await handleAttachmentRoute(stage.value), true);
  assert.equal(stage.sent[0].status, 201);
  const status = context("GET", "/api/uploads/upload-1/status", service);
  await handleAttachmentRoute(status.value);
  assert.equal(status.sent[0].payload.status, "staged");
  const settlement = context("POST", "/api/finance/settlements/SET%2F1/attachments", service, { uploadId: "upload-1" });
  await handleAttachmentRoute(settlement.value);
  assert.deepEqual(calls.at(-1), ["settlement", "SET/1", { uploadId: "upload-1" }]);
  const receiving = context("POST", "/api/receiving/drafts/GRN-1/attachments", service, { uploadId: "upload-2" });
  await handleAttachmentRoute(receiving.value);
  assert.deepEqual(calls.at(-1), ["receiving", "GRN-1", { uploadId: "upload-2" }]);
  const remove = context("DELETE", "/api/attachments/attachment-1", service);
  await handleAttachmentRoute(remove.value);
  assert.equal(remove.sent[0].payload.status, "deleted");
});

test("attachment download is a controlled no-store stream", async () => {
  const bytes = Buffer.from("evidence");
  const service = { download: async () => ({ bytes, fileName: "payment proof.txt", mimeType: "text/plain", sha256: "a".repeat(64) }) };
  const value = context("GET", "/api/attachments/attachment-1/download", service);
  await handleAttachmentRoute(value.value);
  assert.equal(value.response.status, 200);
  assert.equal(value.response.headers["cache-control"], "private, no-store");
  assert.equal(value.response.headers["x-content-sha256"], "a".repeat(64));
  assert.match(value.response.headers["content-disposition"], /payment%20proof\.txt/);
  assert.deepEqual(value.response.bytes, bytes);
});

test("attachment boundary ignores unrelated routes and fails closed for auth or capability", async () => {
  const unrelated = context("GET", "/api/finance/settlements", {});
  assert.equal(await handleAttachmentRoute(unrelated.value), false);
  const anonymous = context("POST", "/api/uploads/stage", {}, {}, { identity: { authenticated: false } });
  assert.equal(await handleAttachmentRoute(anonymous.value), true);
  assert.equal(anonymous.sent[0].status, 401);
  const disabled = context("POST", "/api/uploads/stage", {}, {}, { env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_SETTLEMENT_WORKFLOW: "false", FLOWCHAIN_ENABLE_DB_MOBILE_OPERATIONS: "false" } });
  await handleAttachmentRoute(disabled.value);
  assert.equal(disabled.sent[0].status, 409);
  assert.equal(disabled.sent[0].payload.code, "ATTACHMENT_CAPABILITY_NOT_AVAILABLE");
});
