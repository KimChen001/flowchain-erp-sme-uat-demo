import assert from "node:assert/strict";
import test from "node:test";
import { handleMobileSyncRoute } from "./mobile-sync.routes.mjs";

function context({ method = "GET", path, body = {}, service }) {
  const sent = [];
  return { sent, ctx: { req: { method }, res: {}, url: new URL(`http://local${path}`), identity: { authenticated: true, tenantId: "tenant", userId: "user", role: "admin" }, env: { FLOWCHAIN_PERSISTENCE_MODE: "database", FLOWCHAIN_ENABLE_DB_MOBILE_SYNC: "true", NODE_ENV: "test" }, mobileSyncPrisma: {}, mobileSyncService: service, readBody: async () => body, send: (_res, status, payload) => sent.push({ status, payload }) } };
}

test("mobile sync routes expose register, signed-change reset, acknowledge, and revoke contracts", async () => {
  const calls = [];
  const service = { register: async (body) => (calls.push(["register", body]), { clientId: "client", deviceIdHash: "hash" }), initial: async () => ({ changes: [], cursor: "signed" }), changes: async () => ({ code: "SYNC_AUTHORIZATION_CHANGED", resetRequired: true, changes: [] }), acknowledge: async () => ({ acknowledgedSequence: "4" }), revoke: async (id, body) => (calls.push(["revoke", id, body]), { clientId: id, status: "revoked" }) };
  const register = context({ method: "POST", path: "/api/sync/clients/register", body: { deviceId: "raw", platform: "pwa" }, service }); await handleMobileSyncRoute(register.ctx); assert.equal(register.sent[0].status, 201); assert.equal(register.sent[0].payload.deviceIdHash, "hash");
  const changes = context({ path: "/api/sync/changes?clientId=client&cursor=signed", service }); await handleMobileSyncRoute(changes.ctx); assert.equal(changes.sent[0].status, 409); assert.equal(changes.sent[0].payload.resetRequired, true);
  const revoke = context({ method: "POST", path: "/api/sync/clients/client/revoke", body: { deviceId: "raw" }, service }); await handleMobileSyncRoute(revoke.ctx); assert.equal(revoke.sent[0].payload.status, "revoked"); assert.deepEqual(calls.at(-1), ["revoke", "client", { deviceId: "raw" }]);
  assert.deepEqual(calls.map((call) => call[0]), ["register", "revoke"]);
});
