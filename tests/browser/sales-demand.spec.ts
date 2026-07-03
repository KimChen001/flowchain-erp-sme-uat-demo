import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-sales-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-sales-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
}

async function askAssistant(page: Page, prompt: string) {
  await page.getByTestId("ai-assistant-input").fill(prompt);
  await page.getByTestId("ai-assistant-send").click();
  await expect(page.getByTestId("ai-message-user").filter({ hasText: prompt })).toBeVisible();
  const assistant = page.getByTestId("ai-message-assistant").last();
  await expect(assistant).toBeVisible();
  await expect(assistant).not.toContainText("正在回复");
  return assistant;
}

async function expectNoVisibleInternalTerms(target: Locator) {
  await expect(target).not.toContainText(/Demo|UAT|演示数据|示例数据|样例数据|mock|fake|sample data|demo data|UAT data/i);
  await expect(target).not.toContainText(/provider fallback|tool_result|response_card|entityType|documentType|raw JSON/i);
}

test.describe("Sales Demand Lite browser flow", () => {
  test("opens sales demand, focuses customer order from search, and answers delivery risk with evidence", async ({ page }) => {
    await openLoggedInApp(page);

    await page.getByRole("button", { name: "销售需求" }).first().click();
    await expect(page.getByRole("heading", { name: "销售需求" })).toBeVisible();
    const moduleScope = page.getByTestId("module-export-scope");
    await expect(moduleScope.getByText("客户订单与交付风险")).toBeVisible();
    await expect(moduleScope.getByText("销售需求使用边界")).toBeVisible();
    await expect(moduleScope).toContainText("交付风险订单");
    await expect(moduleScope).toContainText("SO-2026-0412-A");
    await expect(moduleScope).toContainText("SKU-00412");

    const searchBox = page.getByPlaceholder("搜索业务记录");
    await searchBox.fill("SO-2026-0412-A");
    await page.getByRole("button", { name: "搜索业务记录" }).click();
    const searchResult = page.locator("button").filter({ hasText: "SO-2026-0412-A" }).first();
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    await expect(page.getByTestId("focus-banner")).toContainText("客户订单");
    await expect(page.getByTestId("sales-order-SO-2026-0412-A")).toBeVisible();
    await expect(page.getByTestId("sales-order-SO-2026-0412-A")).toContainText(/交付缺口|承诺交付需优先复核/);

    await openAssistant(page);
    const assistant = await askAssistant(page, "哪些客户订单有交付风险？");
    await expect(assistant).toContainText("SO-2026-0412-A");
    await expect(assistant).toContainText("SKU-00412");
    await expect(assistant).toContainText("建议操作");
    await expect(assistant).toContainText("依据");
    await expect(page.getByTestId("ai-evidence-link").filter({ hasText: "SO-2026-0412-A" })).toBeVisible();
    await expectNoVisibleInternalTerms(assistant);
    await expectNoVisibleInternalTerms(moduleScope);
  });
});
