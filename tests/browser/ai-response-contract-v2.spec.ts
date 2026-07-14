import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-ai-response-v2-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|提交收货|过账库存|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|demo|UAT|entityType|documentType/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-ai-response-v2-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
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
  await expect(assistant.getByTestId("ai-response-v2")).toBeVisible();
  return assistant;
}

async function closeBlockingOverlay(page: Page) {
  await page.keyboard.press("Escape");
  await page.locator(".fixed.inset-0.z-50").waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
}

async function expectV2Sections(assistant: Locator) {
  for (const section of ["结论", "关键证据", "业务影响", "建议操作", "可点击跳转", "数据限制", "内部复核", "草稿预览"]) {
    await expect(assistant).toContainText(section);
  }
  await expect(assistant).not.toContainText(forbiddenExecutionText);
  await expect(assistant).not.toContainText(forbiddenTechnicalText);
}

test.describe("AI response contract v2", () => {
  test("renders Today cockpit style response with review-first cards", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    const assistant = await askAssistant(page, "今天有什么需要我处理？");
    await expectV2Sections(assistant);
    for (const text of ["供应商风险", "PO", "已收未票", "库存风险", "数据"]) await expect(assistant).toContainText(text);
    await expect(assistant).toContainText(/发票差异|Invoice 差异/);
    await expect(assistant).toContainText(/需人工复核|人工复核/);
    await expect(assistant).toContainText(/不会外发|不提交|不写入财务凭证|不改供应商资料/);
  });

  test("maps supplier risk and unreceived PO queries to evidence-backed cards", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    const supplier = await askAssistant(page, "哪些供应商有潜在风险？");
    await expectV2Sections(supplier);
    await expect(supplier).toContainText(/Supplier|供应商/);
    await expect(supplier).toContainText("风险信号");
    await expect(supplier).toContainText(/PO|RFQ|Invoice/);
    await expect(supplier).toContainText("供应商运营档案");

    const po = await askAssistant(page, "哪些 PO 还没有收货？");
    await expectV2Sections(po);
    await expect(po).toContainText("PO");
    await expect(po).toContainText("PO Line");
    await expect(po).toContainText("未收数量");
    await expect(po).toContainText(/ETA|预计到货/);
    await expect(po).toContainText(/查看 PO|查看收货记录/);
  });

  test("maps uninvoiced receiving and match failure queries to line evidence", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    const uninvoiced = await askAssistant(page, "哪些已经收货但还没开票？");
    await expectV2Sections(uninvoiced);
    await expect(uninvoiced).toContainText("已收未票");
    await expect(uninvoiced).toContainText("PO Line");
    await expect(uninvoiced).toContainText("GRN Line");
    await expect(uninvoiced).toContainText("未开票数量");
    await expect(uninvoiced).toContainText("已收未票金额");
    await expect(uninvoiced).toContainText("不形成会计分录");

    const match = await askAssistant(page, "为什么三单匹配失败？");
    await expectV2Sections(match);
    await expect(match).toContainText("PO Line");
    await expect(match).toContainText(/GRN|Receipt Line/);
    await expect(match).toContainText("Invoice Line");
    await expect(match).toContainText(/数量差异|单价差异|金额差异/);
    await expect(match).toContainText("生成差异说明草稿");
    await expect(match).toContainText("人工复核");
  });

  test("clicks PO supplier and data access navigation links", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    await askAssistant(page, "哪些 PO 还没有收货？");
    await page.getByTestId("ai-evidence-link").filter({ hasText: /PO|查看/ }).first().click();
    await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);
    await closeBlockingOverlay(page);

    await openAssistant(page);
    await askAssistant(page, "哪些供应商有潜在风险？");
    await page.getByTestId("ai-evidence-link").filter({ hasText: /供应商|运营档案/ }).first().click();
    await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);
    await closeBlockingOverlay(page);

    await openAssistant(page);
    await askAssistant(page, "哪些数据依据不完整？");
    await page.getByTestId("ai-evidence-link").filter({ hasText: "数据接入与质量" }).first().click();
    await expect(page.getByTestId("data-access-business-page")).toContainText(/导入任务|字段映射|质量/);
  });
});
