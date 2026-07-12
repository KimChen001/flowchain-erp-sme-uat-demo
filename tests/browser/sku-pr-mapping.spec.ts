import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("scm-demo-token", "sku-gate");
    localStorage.setItem(
      "scm-demo-user",
      JSON.stringify({
        id: "procurement-manager",
        name: "采购经理",
        role: "采购经理",
      }),
    );
  });
});

test("SKU list navigates to detail, edits and persists after refresh", async ({
  page,
}) => {
  await page.goto("/app/master-data/items");
  await page.getByRole("button", { name: "新建 SKU" }).click();
  await page.getByLabel("物料 ID").fill(`ITEM-E2E-${Date.now()}`);
  const sku = `SKU-E2E-${Date.now()}`;
  await page.getByLabel("SKU 编码").fill(sku);
  await page.getByLabel("物料名称").fill("浏览器测试物料");
  await page.getByLabel("规格型号").fill("V1");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(sku) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑 SKU" }).click();
  await page.getByLabel("规格型号").fill("V2");
  await page.getByRole("button", { name: "保存" }).click();
  await page.reload();
  await page.getByLabel("搜索 SKU").fill(sku);
  await page.getByRole("button", { name: sku }).click();
  await expect(page.getByText("V2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /返回 SKU 列表/ }).click();
  await expect(page.getByRole("button", { name: sku })).toBeVisible();
});

test("PR selector maps catalog item and allows Other with comments", async ({
  page,
  request,
}) => {
  const sku = `SKU-PR-${Date.now()}`;
  const created = await request.post("/api/master-data/items", {
    headers: { "x-flowchain-role": "manager" },
    data: {
      itemId: `ITEM-PR-${Date.now()}`,
      sku,
      itemName: "映射测试电机",
      baseUnit: "台",
      purchaseUnit: "台",
      specification: "3kW",
    },
  });
  expect(created.ok()).toBeTruthy();
  await page.goto("/app/procurement/requests");
  const selector = page.getByLabel("物料选择 1");
  await selector.selectOption({ label: `${sku} · 映射测试电机` });
  await expect(page.locator('input[value="映射测试电机"]')).toBeVisible();
  await expect(page.locator('input[value="台"]')).toBeVisible();
  await page.getByRole("button", { name: /新增物料行/ }).click();
  await page.getByLabel("物料选择 2").selectOption("other");
  const second = page
    .locator(".rounded-lg.border")
    .filter({ has: page.getByLabel("物料选择 2") });
  await second.getByLabel("物料名称").fill("临时校准服务");
  await second.getByLabel("单位").fill("项");
  await second.getByLabel("行级备注").fill("现场完成");
  await page.getByLabel("申请单 Comments").fill("昆山工厂维护");
  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.getByText("Comments：昆山工厂维护")).toBeVisible();
  await expect(page.getByText(/Other · 临时校准服务 · 项/)).toBeVisible();
});
