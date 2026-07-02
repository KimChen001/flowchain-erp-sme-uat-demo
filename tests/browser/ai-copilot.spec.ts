import { expect, test, type Page } from "@playwright/test";

const demoUser = {
  id: "browser-uat-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem("scm-demo-token", "browser-uat-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(user));
  }, demoUser);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
  await expect(page.getByText("每日工作台").first()).toBeVisible();
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

async function askTodayPriority(page: Page) {
  await openAssistant(page);
  const assistant = await askAssistant(page, "今天最需要处理什么？");
  await expect(assistant).toContainText("PO-2026-1282");
  await expect(assistant).toContainText("SKU-00412");
  await expect(assistant).toContainText("RFQ-26-0046");
  await expect(assistant).toContainText("依据");
  await expect(assistant).toContainText("建议操作");
  return assistant;
}

test.describe("AI Copilot browser UAT", () => {
  test("R122 answers Today priority with product-readable evidence and actions", async ({ page }) => {
    await openLoggedInApp(page);
    const assistant = await askTodayPriority(page);

    for (const forbidden of [
      "action-FOLLOWUP",
      "inventory_item",
      "documentType",
      "entityType",
      "tool_result",
      "response_card",
    ]) {
      await expect(assistant).not.toContainText(forbidden);
    }
    await expect(assistant).not.toContainText(/\{\s*"/);
    await expect(assistant).not.toContainText(/"\s*:/);
  });

  test("R123 minimize and restore preserve the AI answer", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    await page.getByTestId("app-main").click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("ai-assistant-toggle")).toBeVisible();

    await page.getByTestId("ai-assistant-toggle").click();
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("SKU-00412");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();

    await page.getByTestId("ai-assistant-toggle").click();
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("建议操作");
  });
});
