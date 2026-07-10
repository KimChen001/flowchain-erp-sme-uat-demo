import { expect, test } from "@playwright/test";
const user = { id: "drill-user", company: "新辰智能制造", name: "张磊", email: "drill@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "drill-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); });
test("metric drilldown keeps filters and return context", async ({ page }) => {
  await page.goto("/app/reports/finance?from=2026-05-01&overdue=true");
  await page.getByText("逾期应付", { exact: true }).click();
  await expect(page).toHaveURL(/\/app\/finance\/invoices/);
  await expect(page).toHaveURL(/from=2026-05-01/);
  await expect(page).toHaveURL(/returnTo=/);
});
