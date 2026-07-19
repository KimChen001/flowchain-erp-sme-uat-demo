import { expect, test } from "@playwright/test";

test("disabled outbound capability makes list and direct entry read-only", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "kim@example.com", name: "Ignored", company: "Ignored" },
  });
  expect(login.ok()).toBeTruthy();
  const session = await login.json();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("flowchain:auth-token", token);
    localStorage.setItem("flowchain:current-user", JSON.stringify(user));
  }, session);

  await page.goto("/app/sales/orders");
  await expect(page.getByTestId("outbound-order-list")).toBeVisible();
  await expect(page.getByRole("link", { name: "新建销售订单" })).toHaveCount(0);
  await expect(page.getByTestId("capability-route-blocked")).toContainText("能力暂不可用");
  await expect(page.getByTestId("capability-route-blocked")).toContainText("权限已具备，但该业务能力当前未启用。");

  await page.goto("/app/sales/orders/new");
  await expect(page.getByTestId("capability-route-blocked")).toContainText("能力暂不可用");
  await expect(page.getByTestId("capability-route-blocked")).toContainText("权限已具备，但该业务能力当前未启用。");
  await expect(page.getByTestId("create-sales-order")).toHaveCount(0);

  const create = await request.post("/api/sales/orders", {
    headers: { Authorization: `Bearer ${session.token}` },
    data: {
      orderNumber: "SO-DISABLED-BROWSER",
      customerName: "Disabled",
      currency: "CNY",
      idempotencyKey: "disabled-browser-create",
      lines: [{ itemId: "outbound-browser-item", quantity: "1" }],
    },
  });
  expect(create.status()).toBe(409);
  expect((await create.json()).code).toBe("OUTBOUND_CAPABILITY_NOT_AVAILABLE");
});
