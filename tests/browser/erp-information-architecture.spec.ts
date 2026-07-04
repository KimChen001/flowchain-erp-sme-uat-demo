import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-ia-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-ia-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test.describe("ERP information architecture cleanup", () => {
  test("supplier management merges performance and risk and hides supplier portal", async ({ page }) => {
    await openLoggedInApp(page);
    await page.getByRole("button", { name: "供应商管理" }).first().click();
    const scope = page.getByTestId("module-export-scope");

    await expect(page.getByRole("button", { name: "供应商绩效与风险" })).toBeVisible();
    await expect(page.getByRole("button", { name: "供应商绩效", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "供应商风险", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "供应商门户" })).toHaveCount(0);
    await expect(scope).not.toContainText(/supplier portal/i);

    await expect(scope.getByRole("button", { name: /批准|拒绝|冻结|发送|下发/ })).toHaveCount(0);
  });

  test("navigation clarifies foundation data, data quality, and reports boundaries", async ({ page }) => {
    await openLoggedInApp(page);

    await expect(page.getByRole("button", { name: "基础资料" })).toBeVisible();
    await expect(page.getByRole("button", { name: "主数据" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "数据接入与质量" })).toBeVisible();
    await expect(page.getByRole("button", { name: "报表与分析" })).toBeVisible();

    await page.getByRole("button", { name: "基础资料" }).first().click();
    const scope = page.getByTestId("module-export-scope");
    await expect(scope).toContainText("基础资料只维护业务对象基础记录，不做报表分析或业务审批。");
    await expect(scope).not.toContainText("主数据");

    await page.getByRole("button", { name: "报表与分析" }).first().click();
    await expect(scope).toContainText("报表与分析只做汇总、趋势、分析和导出");
    await expect(scope.getByRole("button", { name: /批准|拒绝|过账|编辑业务数据/ })).toHaveCount(0);

    await page.getByRole("button", { name: "数据接入与质量" }).first().click();
    await expect(scope).toContainText("数据接入与质量用于集中复核数据导入");
    await expect(scope).toContainText("不承担业务审批");
  });
});
