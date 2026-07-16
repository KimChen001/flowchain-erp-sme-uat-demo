import { expect, test } from "@playwright/test";

async function login(request: any, email: string) {
  const response = await request.post("/api/auth/login", {
    data: { email, name: "Ignored", company: "Ignored" },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function session(page: any, value: any) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("flowchain:auth-token", token);
    localStorage.setItem("flowchain:current-user", JSON.stringify(user));
  }, value);
}

test("inventory operations workbench closes transfer, count, and adjustment through PostgreSQL", async ({
  page,
  request,
  browser,
}) => {
  const kim = await login(request, "kim@example.com");
  await session(page, kim);
  await page.goto("/app/inventory/operations");
  await expect(page.getByTestId("inventory-operations-landing")).toBeVisible();

  await page.getByRole("link", { name: /库存调拨/ }).click();
  await page.getByRole("link", { name: "新建" }).click();
  await page.getByLabel("调拨物料 1").selectOption("inventory-browser-item");
  await page.getByLabel("调拨数量 1").fill("3.0000");
  await page.getByLabel("来源仓库 1").selectOption("inventory-browser-a");
  await page.getByLabel("来源库位 1").fill("A-01");
  await page.getByLabel("目标仓库 1").selectOption("inventory-browser-b");
  await page.getByLabel("目标库位 1").fill("B-01");
  await page.getByTestId("create-transfer").click();
  await expect(page.getByTestId("inventory-transfer-workbench")).toBeVisible();
  const transferUrl = page.url();
  await page.getByTestId("operation-ready").click();
  await page.getByTestId("operation-preview-post").click();
  await expect(page.getByTestId("inventory-operation-preview")).toContainText(
    "Preview 允许执行",
  );
  await page.getByTestId("confirm-inventory-operation").click();
  await expect(
    page.getByTestId("operation-movement-stock_transfer_out"),
  ).toContainText("出 3.0000");
  await expect(
    page.getByTestId("operation-movement-stock_transfer_in"),
  ).toContainText("入 3.0000");
  let balances = await request.get(
    "/api/inventory/balances?sku=INV-BROWSER-SKU",
    { headers: { Authorization: `Bearer ${kim.token}` } },
  );
  let balanceData = await balances.json();
  expect(
    balanceData.balances.find(
      (row: any) => row.id === "inventory-browser-balance-a",
    ).onHandQuantity,
  ).toBe("7.0000");
  expect(
    balanceData.balances.find(
      (row: any) => row.id === "inventory-browser-balance-b",
    ).onHandQuantity,
  ).toBe("8.0000");
  await page.getByTestId("operation-preview-reverse").click();
  await page.getByTestId("confirm-inventory-operation").click();
  await expect(
    page.getByTestId("operation-movement-stock_transfer_reversal_in"),
  ).toBeVisible();
  balances = await request.get("/api/inventory/balances?sku=INV-BROWSER-SKU", {
    headers: { Authorization: `Bearer ${kim.token}` },
  });
  balanceData = await balances.json();
  expect(
    balanceData.balances.find(
      (row: any) => row.id === "inventory-browser-balance-a",
    ).onHandQuantity,
  ).toBe("10.0000");

  await page.goto("/app/inventory/counts/new");
  await page.getByLabel("盘点仓库").selectOption("inventory-browser-a");
  await page.getByRole("checkbox").nth(1).check();
  await page.getByTestId("create-count").click();
  await expect(page.getByTestId("inventory-count-workbench")).toBeVisible();
  const countUrl = page.url();
  const specialist = await login(request, "specialist@example.com"),
    specialistContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    }),
    specialistPage = await specialistContext.newPage();
  await session(specialistPage, specialist);
  await specialistPage.goto(countUrl);
  await expect(specialistPage.getByTestId("count-recorded")).toContainText(
    "盲盘隐藏",
  );
  await specialistPage.getByLabel("实盘数量 INV-BROWSER-SKU").fill("11.0000");
  await specialistPage.getByTestId("save-counts").click();
  await specialistPage.getByTestId("count-submit").click();
  await specialistContext.close();
  await page.goto(countUrl);
  await page.getByTestId("count-review").click();
  await page.getByTestId("operation-preview-post").click();
  await page.getByTestId("confirm-inventory-operation").click();
  await expect(
    page.getByTestId("operation-movement-cycle_count_adjustment"),
  ).toContainText("入 1.0000");

  await page.goto("/app/inventory/adjustments/new");
  await page
    .getByLabel("调整余额 1")
    .selectOption("inventory-browser-balance-b");
  await page.getByLabel("调整数量 1").fill("-1.0000");
  await page.getByTestId("create-adjustment").click();
  await page.getByTestId("operation-ready").click();
  await page.getByTestId("operation-preview-post").click();
  await page.getByTestId("confirm-inventory-operation").click();
  await expect(
    page.getByTestId("operation-movement-inventory_adjustment"),
  ).toContainText("出 1.0000");
  await page.getByTestId("operation-preview-reverse").click();
  await page.getByTestId("confirm-inventory-operation").click();
  await expect(
    page.getByTestId("operation-movement-inventory_adjustment_reversal"),
  ).toBeVisible();

  const viewer = await login(request, "viewer@example.com");
  const denied = await request.post("/api/inventory/counts", {
    headers: { Authorization: `Bearer ${viewer.token}` },
    data: {
      countNumber: "VIEWER-DENIED",
      warehouseId: "inventory-browser-a",
      balanceIds: ["inventory-browser-balance-a"],
      idempotencyKey: "viewer-denied",
    },
  });
  expect(denied.status()).toBe(403);
  const noScope = await login(request, "readonly@example.com");
  const hidden = await request.get(
    new URL(transferUrl).pathname.replace("/app/", "/api/") + "/workbench",
    { headers: { Authorization: `Bearer ${noScope.token}` } },
  );
  expect(hidden.status()).toBe(404);
});
