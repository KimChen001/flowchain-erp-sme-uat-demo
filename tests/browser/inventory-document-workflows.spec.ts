import { expect, test, type Page } from "@playwright/test";

const user = { id: "inventory-doc-user", company: "新辰智能制造", name: "张磊", email: "zhanglei@example.com", role: "供应链经理" };
async function openLoggedInApp(page: Page) { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "inventory-doc-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); await page.goto("/"); await expect(page.getByTestId("app-main")).toBeVisible(); }

test("inventory adjustment is a real document view", async ({ page }) => {
  await openLoggedInApp(page); const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "库存管理", exact: true }).click(); await nav.getByRole("button", { name: "库存调整单", exact: true }).click();
  const scope = page.getByTestId("inventory-adjustment-page"); await expect(scope.getByRole("heading", { name: "库存调整单" })).toBeVisible(); await expect(scope).toContainText("调整单号"); await expect(scope).toContainText("调整类型");
  await scope.getByRole("button", { name: "查看详情" }).first().click(); await expect(page.getByRole("columnheader", { name: "调整前数量" })).toBeVisible(); await expect(page.getByRole("columnheader", { name: "调整数量" }).last()).toBeVisible(); await expect(page.getByRole("columnheader", { name: "调整后数量" })).toBeVisible();
});

test("inventory warning exposes stock planning fields", async ({ page }) => {
  await openLoggedInApp(page); const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "库存管理", exact: true }).click(); await nav.getByRole("button", { name: "库存预警", exact: true }).click();
  const scope = page.getByTestId("inventory-warning-page"); for (const label of ["当前库存", "安全库存", "再订货点", "在途数量", "缺口", "覆盖天数", "建议动作"]) await expect(scope).toContainText(label);
  await expect(scope).toContainText("SKU-00623"); await expect(scope.getByRole("button", { name: "创建采购申请草稿" }).first()).toBeVisible();
});

test("lots and exceptions keep their original semantics", async ({ page }) => {
  await openLoggedInApp(page); const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "库存管理", exact: true }).click();
  await nav.getByRole("button", { name: "批次 / 序列号", exact: true }).click(); await expect(page.getByTestId("module-export-scope")).toContainText("批次号"); await expect(page.getByTestId("module-export-scope")).toContainText("序列号");
  await nav.getByRole("button", { name: "库存异常", exact: true }).click(); await expect(page.getByTestId("module-export-scope")).toContainText("库存异常单据"); await expect(page.getByRole("columnheader", { name: "类型", exact: true })).toBeVisible(); await expect(page.getByRole("columnheader", { name: "下一步" })).toBeVisible();
});
