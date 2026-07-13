import { expect, test } from "@playwright/test";

test("sales demand uses explicit runtime order with recoverable SO and SKU links", async ({ page, request }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scm-demo-token", "sales-runtime-token");
    localStorage.setItem("scm-demo-user", JSON.stringify({ id: "sales-runtime-user", name: "张磊", role: "供应链经理" }));
  });
  const suffix = Date.now();
  const sku = `SALES-DEMAND-${suffix}`;
  const salesOrderId = `SO-DEMAND-${suffix}`;
  const itemResponse = await request.post("/api/master-data/items", { headers: { "x-flowchain-role": "manager" }, data: { sku, itemName: "销售运行时物料", baseUnit: "件", status: "active", purchasable: true } });
  expect(itemResponse.status()).toBe(201);
  const item = (await itemResponse.json()).item;
  expect((await request.post("/api/sales-demand/orders", { data: { salesOrderId, customerName: "普通客户名称", sku, itemId: item.itemId, itemName: item.itemName, orderedQty: 8, reservedQty: 5, promisedDate: "2026-08-01", statusLabel: "待交付" } })).status()).toBe(201);

  await page.goto("/app/sales/orders");
  const order = page.getByRole("link", { name: salesOrderId, exact: true });
  await expect(order).toHaveAttribute("href", `/app/sales/orders/${salesOrderId}`);
  await expect(page.getByRole("link", { name: sku, exact: true })).toHaveAttribute("href", new RegExp(`/app/master-data/items/(?:${item.itemId}|${sku})$`));
  await expect(page.getByText("普通客户名称", { exact: true }).locator("xpath=self::a")).toHaveCount(0);
  await order.click();
  await expect(page).toHaveURL(new RegExp(`/app/sales/orders/${salesOrderId}$`));
  await page.reload();
  await expect(page.getByText(salesOrderId, { exact: false }).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("SO-2026-0412-A");
});
