import { expect, test } from "@playwright/test";

const user = { id: "bi-user", company: "新辰智能制造", name: "张磊", email: "bi@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "bi-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); });

test("BI filters persist in URL and across refresh", async ({ page }) => {
  await page.goto("/app/reports/overview");
  await expect(page.getByTestId("bi-dashboard")).toHaveAttribute("data-view", "overview");
  await page.getByLabel("供应商", { exact: true }).selectOption("佛山标准件");
  await page.getByLabel("仓库", { exact: true }).selectOption("上海总仓");
  await expect(page).toHaveURL(/supplier=/);
  await expect(page).toHaveURL(/warehouse=/);
  await page.reload();
  await expect(page.getByLabel("供应商", { exact: true })).toHaveValue("佛山标准件");
  await expect(page.getByLabel("仓库", { exact: true })).toHaveValue("上海总仓");
});

test("each BI route renders a dedicated dashboard and report library stays separate", async ({ page }) => {
  for (const view of ["overview", "procurement", "sales", "inventory", "finance", "suppliers"] as const) {
    await page.goto(`/app/reports/${view}`);
    await expect(page.getByTestId("bi-dashboard")).toHaveAttribute("data-view", view);
    await expect(page.getByTestId("bi-global-filters")).toBeVisible();
  }
  await page.goto("/app/reports/library");
  await expect(page.getByTestId("bi-dashboard")).toHaveCount(0);
  await expect(page.getByText("标准报表目录")).toBeVisible();
  await expect(page.getByRole("button", { name: "导出当前结果" }).first()).toBeVisible();
});

test("finance chart drills into the invoice list", async ({ page }) => {
  await page.goto("/app/reports/finance?from=2026-05-01&supplier=%E4%BD%9B%E5%B1%B1%E6%A0%87%E5%87%86%E4%BB%B6");
  const chart = page.locator('[data-chart-title="发票金额趋势"] .h-64');
  await chart.click({ position: { x: 40, y: 40 } });
  await expect(page).toHaveURL(/\/app\/finance\/invoices/);
  await expect(page).toHaveURL(/supplier=/);
});
