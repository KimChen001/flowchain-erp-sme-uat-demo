import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

async function login(request: any, email: string) {
  const response = await request.post("/api/auth/login", { data: { email, name: "Ignored", company: "Ignored" } });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function api(request: any, token: string, method: string, path: string, data?: any, extraHeaders: Record<string, string> = {}) {
  const response = await request[method](path, { headers: { Authorization: `Bearer ${token}`, ...extraHeaders }, ...(data === undefined ? {} : { data }) });
  const body = await response.json();
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

test("mobile sync browser acceptance enforces cursor/device, monotonic acknowledgement, and revocation controls", async ({ request }) => {
  const mobile = await login(request, "mobile@example.com");
  const deviceA = "browser-sync-controls-device-a";
  const registrationA = await api(request, mobile.token, "post", "/api/sync/clients/register", { deviceId: deviceA, platform: "pwa", appVersion: "0.5.2c1" }, { "X-Device-Id": deviceA });
  let initial = await api(request, mobile.token, "get", `/api/sync/initial?clientId=${encodeURIComponent(registrationA.clientId)}&deviceId=${encodeURIComponent(deviceA)}&pageSize=2`, undefined, { "X-Device-Id": deviceA });
  expect(initial.consistencyContract).toBe("convergent_keyset_initial_sync");
  expect(initial.pageSize).toBe(2);
  while (initial.hasMore) {
    expect(typeof initial.nextEntityType).toBe("string");
    initial = await api(request, mobile.token, "get", `/api/sync/initial?clientId=${encodeURIComponent(registrationA.clientId)}&deviceId=${encodeURIComponent(deviceA)}&snapshotSessionId=${encodeURIComponent(initial.snapshotSessionId)}&snapshotCursor=${encodeURIComponent(initial.snapshotCursor)}`, undefined, { "X-Device-Id": deviceA });
  }
  await api(request, mobile.token, "post", "/api/mobile/receiving/drafts", { poId: "mobile-browser-receiving-po", warehouseId: "finance-browser-warehouse", lines: [{ purchaseOrderLineId: "mobile-browser-receiving-po-line", acceptedQuantity: "0.1000", location: "SYNC-01" }], idempotencyKey: "mobile-browser-sync-control-change", clientMutationId: "mobile-browser-sync-control-change", sourceDeviceId: deviceA }, { "X-Device-Id": deviceA });
  const changes = await api(request, mobile.token, "get", `/api/sync/changes?clientId=${encodeURIComponent(registrationA.clientId)}&deviceId=${encodeURIComponent(deviceA)}&cursor=${encodeURIComponent(initial.cursor)}`, undefined, { "X-Device-Id": deviceA });
  expect(changes.changes.length).toBeGreaterThan(0);
  const acknowledged = await api(request, mobile.token, "post", "/api/sync/acknowledge", { clientId: registrationA.clientId, deviceId: deviceA, cursor: changes.cursor }, { "X-Device-Id": deviceA });
  const equal = await api(request, mobile.token, "post", "/api/sync/acknowledge", { clientId: registrationA.clientId, deviceId: deviceA, cursor: changes.cursor }, { "X-Device-Id": deviceA });
  expect(equal.acknowledgedSequence).toBe(acknowledged.acknowledgedSequence);
  const regression = await request.post("/api/sync/acknowledge", { headers: { Authorization: `Bearer ${mobile.token}`, "X-Device-Id": deviceA }, data: { clientId: registrationA.clientId, deviceId: deviceA, cursor: initial.cursor } });
  expect(regression.status()).toBe(409);
  expect((await regression.json()).code).toBe("SYNC_ACKNOWLEDGEMENT_REGRESSION");
  const deviceB = "browser-sync-controls-device-b";
  const registrationB = await api(request, mobile.token, "post", "/api/sync/clients/register", { deviceId: deviceB, platform: "pwa" }, { "X-Device-Id": deviceB });
  const crossDevice = await request.get(`/api/sync/changes?clientId=${encodeURIComponent(registrationB.clientId)}&deviceId=${encodeURIComponent(deviceB)}&cursor=${encodeURIComponent(changes.cursor)}`, { headers: { Authorization: `Bearer ${mobile.token}`, "X-Device-Id": deviceB } });
  expect(crossDevice.status()).toBe(403);
  expect((await crossDevice.json()).code).toBe("SYNC_CURSOR_DEVICE_MISMATCH");
  await api(request, mobile.token, "post", `/api/sync/clients/${encodeURIComponent(registrationA.clientId)}/revoke`, { deviceId: deviceA }, { "X-Device-Id": deviceA });
  const revoked = await request.get(`/api/sync/changes?clientId=${encodeURIComponent(registrationA.clientId)}&deviceId=${encodeURIComponent(deviceA)}&cursor=${encodeURIComponent(changes.cursor)}`, { headers: { Authorization: `Bearer ${mobile.token}`, "X-Device-Id": deviceA } });
  expect(revoked.status()).toBe(403);
  expect((await revoked.json()).code).toBe("SYNC_CLIENT_REVOKED");
});
