import { expect, test } from "@playwright/test";

test("inventory availability is created explicitly and links to Item Master", async ({ page, request }) => {
  await page.addInitScript(() => {
    localStorage.setItem("flowchain:auth-token", "inventory-runtime-token");
    localStorage.setItem("flowchain:current-user", JSON.stringify({ id: "inventory-runtime-user", name: "张磊", role: "供应链经理" }));
  });
  const suffix = Date.now();
  const sku = `ATP-RUNTIME-${suffix}`;
  const itemResponse = await request.post("/api/master-data/items", { headers: { "x-flowchain-role": "manager" }, data: { sku, itemName: "显式库存物料", baseUnit: "件", status: "active", purchasable: true } });
  expect(itemResponse.status()).toBe(201);
  const item = (await itemResponse.json()).item;
  const inventoryResponse = await request.post("/api/inventory/items", { data: { itemId: item.itemId, sku, itemName: item.itemName, onHandQuantity: 12, reservedQuantity: 3, availableQuantity: 9, safetyStock: 4, reorderPoint: 6, unit: "件" } });
  expect(inventoryResponse.status()).toBe(201);

  await page.goto("/app/inventory/stock");
  const row = page.getByTestId(`inventory-item-${sku}`);
  await expect(row).toContainText("9 件");
  await expect(row.getByRole("link", { name: sku, exact: true })).toHaveAttribute("href", `/app/master-data/items/${item.itemId}`);
  await expect(page.locator("body")).not.toContainText("SKU-00412");
});
