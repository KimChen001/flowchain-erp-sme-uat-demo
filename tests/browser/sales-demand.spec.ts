import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-sales-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

function installPageDiagnostics(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack || error.message);
  });
  return async (label: string) => {
    const title = await page.title().catch((error) => `title unavailable: ${String(error)}`);
    const body = await page.locator("body").innerText({ timeout: 1000 }).catch((error) => `body unavailable: ${String(error)}`);
    return [
      `${label} did not reach app-main`,
      `url=${page.url()}`,
      `title=${title}`,
      `body=${body.slice(0, 1000)}`,
      `consoleErrors=${consoleErrors.slice(-10).join("\n") || "none"}`,
      `pageErrors=${pageErrors.slice(-10).join("\n") || "none"}`,
    ].join("\n");
  };
}

async function openLoggedInApp(page: Page) {
  const describeFailure = installPageDiagnostics(page);
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-sales-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  try {
    await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
  } catch (error) {
    throw new Error(`${await describeFailure("Sales Demand app startup")}\n\n${error instanceof Error ? error.message : String(error)}`);
  }
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

async function clickReviewPreview(page: Page) {
  const button = page.getByRole("button", { name: "生成复核预览", exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible({ timeout: 15000 });
  await expect(button).toBeEnabled();
  await button.click();
}

test.describe("Sales Demand Lite browser flow", () => {
  test("opens sales demand, focuses customer order from search, and answers delivery risk with evidence", async ({ page }) => {
    await openLoggedInApp(page);

    await page.getByRole("button", { name: "销售需求" }).first().click();
    await expect(page.getByRole("heading", { name: "销售需求" })).toBeVisible();
    const moduleScope = page.getByTestId("module-export-scope");
    await expect(page.getByRole("button", { name: "客户订单", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "交付风险" })).toBeVisible();
    await expect(page.getByRole("button", { name: "订单证据链" })).toBeVisible();
    await expect(moduleScope).not.toContainText("客户订单与交付风险");
    await expect(moduleScope).not.toContainText("交付风险订单");
    await expect(moduleScope.getByText("客户订单列表")).toBeVisible();
    await expect(moduleScope.getByText("交付风险协同")).toBeVisible();
    await expect(moduleScope.getByRole("button", { name: "询问 AI" })).toHaveCount(0);
    await expect(moduleScope).toContainText("SO-2026-0412-A");
    await expect(moduleScope).toContainText("SKU-00412");
    await expect(moduleScope).toContainText("列表保持完整宽度");
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
    await expect(page.getByRole("heading", { name: "库存影响" })).toBeVisible();
    await expect(page.getByText("可承诺量", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "复核动作" })).toBeVisible();
    await expect(page.getByRole("button", { name: "拒绝" })).toBeVisible();
    await page.getByRole("button", { name: "拒绝" }).click();
    await clickReviewPreview(page);
    await expect(page.getByText("拒绝需要填写原因")).toBeVisible();
    await page.getByPlaceholder("填写复核原因、补充资料要求或暂缓说明").fill("库存缺口需销售确认");
    await clickReviewPreview(page);
    await expect(page.getByText("已生成拒绝复核记录预览")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "交付风险", exact: true }).click();
    await expect(moduleScope).toContainText("交付风险队列");
    await expect(moduleScope).toContainText("优先复核库存分配、在途采购和供应商交付承诺");
    const firstRiskRow = moduleScope.locator(".p-4").filter({ hasText: "SO-2026-0412-A" }).first();
    await expect(firstRiskRow.getByRole("button", { name: "查看详情" })).toHaveCount(1);
    await expect(firstRiskRow.getByRole("button", { name: /让 AI 解释|查看采购订单|查看库存|查看订单/ })).toHaveCount(0);
    await expect(moduleScope).not.toContainText("主证据链");

    await page.getByRole("button", { name: "订单证据链" }).click();
    await expect(moduleScope).toContainText("主证据链");
    await moduleScope.getByRole("button", { name: /SO-2026-0412-A/ }).click();
    await expect(page.getByTestId("evidence-graph-panel")).toBeVisible();
    await expect(moduleScope).toContainText("相关记录");
    await expect(moduleScope).toContainText("风险信号");
    await expect(moduleScope).toContainText("数据限制");
    await expect(moduleScope).toContainText("返回列表");
    await expect(moduleScope).toContainText("SKU / 库存");
    await expect(moduleScope).toContainText("采购订单");
    await expect(moduleScope).toContainText("客户订单 → SKU → 库存可用量 → 采购订单 → 供应商 → 收货单");
    await expect(moduleScope).not.toContainText(/entityType|documentType|raw JSON|record_not_found|tool_result/i);

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
