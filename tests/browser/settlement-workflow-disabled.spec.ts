import { expect, test } from "@playwright/test";

test("settlement workflow fails closed when its capability is disabled", async ({ request }) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "settlement@example.com", name: "Ignored", company: "Ignored" },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const session = await login.json();
  const response = await request.post("/api/finance/settlements/disabled/submit", { headers: { Authorization: `Bearer ${session.token}` }, data: { expectedVersion: 0, idempotencyKey: "disabled-submit" } });
  expect(response.status()).toBe(409);
  expect((await response.json()).code).toBe("SETTLEMENT_WORKFLOW_CAPABILITY_NOT_AVAILABLE");
});
