import { expect, test } from "@playwright/test";
const user = { id: "saved-view-manager", company: "新辰智能制造", name: "张磊", email: "saved@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("flowchain:auth-token", "saved-token"); localStorage.setItem("flowchain:current-user", JSON.stringify(profile)); }, user); });
test("saved view persists, opens, clones, shares and deletes", async ({ page }) => {
  await page.goto("/app/reports/procurement?from=2026-05-01");
  page.once("dialog", (dialog) => dialog.accept("华东逾期采购订单"));
  await page.getByRole("button", { name: /保存视图/ }).click();
  await expect(page.getByText("视图已保存")).toBeVisible();
  await page.goto("/app/reports/library");
  await page.getByText("我的报表", { exact: true }).click();
  await expect(page.getByText("华东逾期采购订单", { exact: true })).toBeVisible();
  await page.getByLabel("复制 华东逾期采购订单").click();
  await expect(page.getByText("华东逾期采购订单（副本）", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "共享 华东逾期采购订单", exact: true }).click();
  await page.getByText("团队共享", { exact: true }).click();
  await expect(page.getByText("华东逾期采购订单", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("删除 华东逾期采购订单").click();
});
