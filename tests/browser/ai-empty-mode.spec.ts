import { expect, test, type Page } from "@playwright/test";

const demoIds = /PO-2026-1282|SKU-00412|RFQ-26-0046|GRN-202605-0418|INV-SZ-260601|SUP-SZXY/;

const demoUser = {
  id: "browser-empty-user",
  company: "用户数据模式",
  name: "Empty User",
  email: "empty@example.com",
  role: "供应链经理",
};

test.skip(process.env.FLOWCHAIN_DATA_MODE !== "empty", "empty-mode browser UAT runs only through npm run test:browser:ai:empty");

async function openLoggedInApp(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem("scm-demo-token", "browser-empty-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(user));
  }, demoUser);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

async function askAssistant(page, prompt: string) {
  await page.getByTestId("ai-assistant-toggle").click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
  await page.getByTestId("ai-assistant-input").fill(prompt);
  await page.getByTestId("ai-assistant-send").click();
  await expect(page.getByTestId("ai-message-user").filter({ hasText: prompt })).toBeVisible();
  const assistant = page.getByTestId("ai-message-assistant").last();
  await expect(assistant).toBeVisible();
  await expect(assistant).not.toContainText("正在回复");
  return assistant;
}

test("R159 empty mode browser AI answers without demo records or fake actions", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const payload = await health.json();
  expect(payload.diagnostics.dataMode).toBe("empty");
  expect(payload.purchaseOrders).toBe(0);
  expect(payload.receivingDocs).toBe(0);

  await openLoggedInApp(page);
  const assistant = await askAssistant(page, "有什么需要我注意的？");
  await expect(assistant).not.toContainText(demoIds);
  await expect(assistant).not.toContainText(/AI Provider|外部 AI Provider|外部模型|provider disabled|provider_disabled|deterministic|fallback|api key/i);
  await expect(assistant).toContainText(/没有|暂无|当前|有限/);
  await expect(page.getByTestId("ai-evidence-link")).toHaveCount(0);
  await expect(page.getByTestId("ai-action-draft-preview")).toHaveCount(0);
});
