import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-evidence-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-evidence-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

async function expectCleanUi(scope: Locator) {
  await expect(scope).not.toContainText(/entityType|documentType|raw JSON|record_not_found|tool_result|response_card|providerStatus|deterministic|fallback/i);
  await expect(scope).not.toContainText(/Demo|UAT|演示数据|示例数据|样例数据|mock|fake|sample data|demo data/i);
}

test.describe("Evidence graph UI and return paths", () => {
  test("sales evidence graph renders API graph and returns from related records", async ({ page }) => {
    await openLoggedInApp(page);
    const scope = page.getByTestId("module-export-scope");

    await page.getByRole("button", { name: "销售需求" }).first().click();
    await page.getByRole("button", { name: "订单证据链" }).click();
    await expect(scope).toContainText("选择客户订单");
    await scope.getByRole("button", { name: /SO-2026-0412-A/ }).click();

    await expect(page.getByTestId("evidence-graph-panel")).toBeVisible();
    await expect(page.getByTestId("return-path-bar")).toContainText("客户订单");
    await expect(page.getByTestId("evidence-primary-path")).toContainText("SO-2026-0412-A");
    await expect(page.getByTestId("evidence-primary-path")).toContainText("SKU-00412");
    await expect(page.getByTestId("evidence-related-records")).toContainText("采购订单");
    await expect(page.getByTestId("evidence-risk-signals")).toContainText(/缺货风险|已阻塞|需关注|风险/);
    await expect(page.getByTestId("evidence-data-limitations")).toContainText("人工复核");
    await expectCleanUi(scope);

    await page.getByTestId("evidence-primary-path").getByRole("button", { name: /SKU-00412/ }).first().click();
    await expect(page.getByTestId("focus-banner")).toContainText("来源：证据链");
    await expect(page.getByTestId("focus-banner")).toContainText("返回");
    await expect(scope).toContainText("SKU-00412");
    await page.getByTestId("business-back-link").click();
    await expect(page.getByTestId("evidence-graph-panel")).toBeVisible();

    await page.getByTestId("evidence-related-records").getByRole("button", { name: /深圳新元电气|广州化工耗材|供应商/ }).first().click();
    await expect(page.getByTestId("focus-banner")).toContainText("来源：证据链");
    await expect(page.getByTestId("focus-banner")).toContainText(/返回客户订单|返回 供应商|返回/);
    await expectCleanUi(scope);
  });

  test("AI evidence link and global search keep business return path", async ({ page }) => {
    await openLoggedInApp(page);
    const scope = page.getByTestId("module-export-scope");

    await page.getByTestId("ai-assistant-toggle").click();
    await page.getByTestId("ai-assistant-input").fill("哪些客户订单有交付风险？");
    await page.getByTestId("ai-assistant-send").click();
    const assistant = page.getByTestId("ai-message-assistant").last();
    await expect(assistant).toContainText("SO-2026-0412-A");
    await page.getByTestId("ai-evidence-link").filter({ hasText: "SO-2026-0412-A" }).first().click();
    await expect(page.getByTestId("focus-banner")).toContainText("来源：AI 助手");
    await expect(page.getByTestId("focus-banner")).toContainText("返回 AI 结果");
    await expectCleanUi(scope);

    await page.getByPlaceholder("搜索业务记录").fill("PO-2026-1282");
    await page.getByRole("button", { name: "搜索业务记录" }).click();
    await page.locator("button").filter({ hasText: "PO-2026-1282" }).first().click();
    await expect(page.getByTestId("focus-banner")).toContainText("来源：全局搜索");
    await expect(page.getByTestId("focus-banner")).toContainText("返回全局搜索");
    await expectCleanUi(scope);
  });
});
