import { expect, test } from "@playwright/test";

test("disabled bank reconciliation is hidden and fails closed", async ({ page, request }) => {
  const response = await request.post("/api/auth/login", { data: { email: "manager@example.com", name: "Ignored", company: "Ignored" } });
  const authenticated = await response.json();
  expect(response.ok(), JSON.stringify(authenticated)).toBeTruthy();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("flowchain:auth-token", token);
    localStorage.setItem("flowchain:current-user", JSON.stringify(user));
  }, authenticated);
  await page.goto("/app/finance/bank-reconciliation");
  await expect(page.getByTestId("capability-route-blocked")).toBeVisible();
  const denied = await request.get("/api/finance/bank-statements/lines", { headers: { Authorization: `Bearer ${authenticated.token}` } });
  expect(denied.status()).toBe(409);
  expect((await denied.json()).code).toBe("BANK_RECONCILIATION_CAPABILITY_NOT_AVAILABLE");
});
