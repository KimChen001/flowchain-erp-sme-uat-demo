import { expect, test } from "@playwright/test";

const user = { id: "drilldown-user", company: "新辰智能制造", name: "张磊", email: "drill@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "drill-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); });

test("runtime PR number opens a refresh-safe URL", async ({ page, request }) => {
  const code = `DRILL-${Date.now()}`;
  const supplierResponse = await request.post("/api/master-data/suppliers", { headers: { "x-flowchain-role": "manager" }, data: { supplierCode: code, supplierName: code, status: "active" } });
  const supplier = (await supplierResponse.json()).supplier;
  const prResponse = await request.post("/api/procurement/requests", { headers: { "x-flowchain-role": "manager", "x-flowchain-user": "drilldown-user" }, data: { departmentId: "operations", defaultCurrency: "CNY", lines: [{ lineId: "L1", sourceType: "non_catalog_item", lineBasis: "amount", supplierId: supplier.id, itemNameSnapshot: "钻取测试服务", commodityId: "service", estimatedAmount: 30, currency: "CNY", targetWarehouseId: "WH-MAIN", needByDate: "2026-08-01" }] } });
  expect(prResponse.status()).toBe(201);
  const pr = await prResponse.json();
  await page.goto(`/app/procurement/requests/${pr.id}`);
  await expect(page).toHaveURL(new RegExp(`/app/procurement/requests/${pr.id}$`));
  await expect(page.getByText(pr.id, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("钻取测试服务", { exact: true })).toBeVisible();
});

test("three-way match drills into PO and returns through browser history", async ({ page }) => {
  await page.goto("/app/finance/three-way-match/MATCH-INV-SZ-260422");
  const detail = page.getByTestId("business-entity-detail");
  await expect(detail).toContainText("容差规则");
  await expect(detail).toContainText("行级明细");
  const poLink = detail.locator('a[href*="/app/procurement/orders/PO-2026-1283"]');
  await expect(poLink).toHaveCount(1);
  await poLink.click();
  await expect(page).toHaveURL(/\/app\/procurement\/orders\/PO-2026-1283/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/finance\/three-way-match\/MATCH-INV-SZ-260422/);
});

test("invoice, reconciliation, and settlement identifiers are semantic links", async ({ page }) => {
  await page.goto("/app/finance/invoices");
  await expect(page.locator('a[href*="/app/finance/invoices/INV-FO-260418"]')).toHaveCount(1);
  await page.goto("/app/finance/reconciliation");
  await expect(page.locator('a[href*="/app/finance/reconciliation/REC-2026-05-FO-001"]')).toHaveCount(1);
  await page.goto("/app/finance/settlement");
  await expect(page.locator('a[href*="/app/finance/settlement/SET-2026-0001"]')).toHaveCount(1);
});
