import { expect, test } from "@playwright/test";
const user = { id: "report-manager", company: "新辰智能制造", name: "张磊", email: "reports@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("flowchain:auth-token", "report-v2-token"); localStorage.setItem("flowchain:current-user", JSON.stringify(profile)); }, user); });
test("report center has one title, compact filters and first-screen KPIs", async ({ page }) => {
  await page.goto("/app/reports/overview");
  await expect(page.getByRole("heading", { level: 1, name: "经营总览" })).toHaveCount(1);
  await expect(page.getByTestId("bi-global-filters")).toBeVisible();
  await expect(page.getByLabel("供应商", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /更多筛选/ }).click();
  await expect(page.getByLabel("供应商", { exact: true })).toBeVisible();
  await expect(page.getByText("销售订单金额", { exact: true })).toBeVisible();
  await expect(page.getByText("数据口径已统一")).toHaveCount(0);
});
