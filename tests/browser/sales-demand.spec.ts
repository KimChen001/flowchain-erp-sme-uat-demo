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
  await expect(target).not.toContainText(/Not found/i);
}

test.describe("Sales Demand Lite browser flow", () => {
  test("opens sales demand, focuses customer order from search, and answers delivery risk with evidence", async ({ page }) => {
    await openLoggedInApp(page);

    await page.getByRole("button", { name: "销售需求" }).first().click();
    await expect(page.getByRole("heading", { name: "销售需求" })).toBeVisible();
    const moduleScope = page.getByTestId("module-export-scope");
    await expect(page.getByRole("button", { name: "客户订单" })).toBeVisible();
    await expect(page.getByRole("button", { name: "交付风险" })).toBeVisible();
    await expect(page.getByRole("button", { name: "订单证据链" })).toBeVisible();
    await expect(moduleScope).not.toContainText("客户订单与交付风险");
    await expect(moduleScope).not.toContainText("交付风险订单");
    await expect(moduleScope.getByText("客户订单列表")).toBeVisible();
    await expect(moduleScope.getByText("销售需求使用边界")).toBeVisible();
    await expect(moduleScope.getByRole("button", { name: "询问 AI" })).toHaveCount(0);
    await expect(moduleScope).toContainText("SO-2026-0412-A");
    await expect(moduleScope).toContainText("SKU-00412");
    await expect(moduleScope).toContainText("请选择一个客户订单查看库存分配和证据链详情。");
    await expect(moduleScope).not.toContainText("采购订单：");

    const searchBox = page.getByPlaceholder("搜索业务记录");
    await searchBox.fill("SO-2026-0412-A");
    await page.getByRole("button", { name: "搜索业务记录" }).click();
    const searchResult = page.locator("button").filter({ hasText: "SO-2026-0412-A" }).first();
    await expect(searchResult).toBeVisible();
    await searchResult.click();

    await expect(page.getByTestId("focus-banner")).toContainText("客户订单");
    await expect(page.getByTestId("sales-order-SO-2026-0412-A")).toBeVisible();
    await expect(page.getByTestId("sales-order-SO-2026-0412-A")).toContainText(/已阻塞|缺货风险/);
    await page.getByTestId("sales-order-SO-2026-0412-A").getByRole("button", { name: "查看详情" }).click();
    await expect(moduleScope).toContainText("库存分配摘要");
    await expect(moduleScope).toContainText("可承诺量");

    await page.getByRole("button", { name: "交付风险", exact: true }).click();
    await expect(moduleScope).toContainText("交付风险队列");
    await expect(moduleScope).toContainText("建议动作");
    await expect(moduleScope).not.toContainText("主证据链");

    await page.getByRole("button", { name: "订单证据链" }).click();
    await expect(moduleScope).toContainText("主证据链");
    await expect(moduleScope).toContainText("相关记录与返回路径");
    await expect(moduleScope).toContainText("客户订单 → SKU → 库存可用量 → 采购订单 → 供应商 → 收货单");
    await expect(moduleScope).toContainText("生成内部通知草稿预览");
    await expect(moduleScope).toContainText("生成异常工单草稿预览");

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
