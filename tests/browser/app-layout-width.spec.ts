import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-layout-width-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-layout-width-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function expectWorkbenchWidth(page: Page) {
  const scope = page.getByTestId("module-export-scope");
  await expect(scope).toBeVisible();
  const box = await scope.boundingBox();
  expect(box?.width || 0).toBeGreaterThan(1180);
  expect(box?.width || 0).toBeLessThanOrEqual(1602);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
}

test("wide workbench layout is available across operational pages without page overflow", async ({ page }) => {
  await openLoggedInApp(page);

  await expectWorkbenchWidth(page);

  for (const label of ["基础资料", "采购管理", "销售管理", "库存管理", "结算管理", "报表中心", "系统管理"]) {
    await page.getByRole("button", { name: label }).first().click();
    await expectWorkbenchWidth(page);
  }

  await page.getByRole("button", { name: "高级与内部" }).click();
  for (const label of ["数据接入与质量", "行动草稿与人工复核"]) {
    await page.getByRole("button", { name: label }).first().click();
    await expectWorkbenchWidth(page);
  }

  await page.getByRole("button", { name: "首页" }).first().click();
  await page.getByRole("button", { name: "AI 摘要", exact: true }).click();
  await expectWorkbenchWidth(page);
});
