import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-ai-runtime-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|model|endpoint|token|API key|API|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|Coupa|RBAC|production|deploy|go-live|system prompt|prompt package/i;

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-ai-runtime-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  const panel = page.getByTestId("ai-assistant-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("AI 助手");
  await expect(panel).toContainText("当前工作区数据");
  await expect(panel).toContainText("证据辅助回答");
  await expect(panel).toContainText("复核优先");
  return panel;
}

async function ask(page: Page, question: string) {
  const panel = page.getByTestId("ai-assistant-panel");
  await panel.getByTestId("ai-assistant-input").fill(question);
  await panel.getByTestId("ai-assistant-send").click();
  await expect(panel.getByTestId("ai-response-v2").last()).toBeVisible({ timeout: 20000 });
  return panel.getByTestId("ai-message-assistant").last();
}

async function expectResponseSections(message: Locator) {
  for (const label of ["结论", "关键证据", "业务影响", "建议动作", "可点击跳转", "数据限制", "人工复核"]) {
    await expect(message).toContainText(label);
  }
}

async function reopenAssistant(page: Page) {
  const toggle = page.getByTestId("ai-assistant-toggle");
  await toggle.click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
}

async function clickRuntimeLink(page: Page, label: RegExp) {
  const link = page.getByTestId("ai-assistant-panel").getByTestId("ai-evidence-link").filter({ hasText: label }).last();
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
}

test("AI Runtime Gateway powers assistant with evidence-bounded review-first answers", async ({ page }) => {
  await openLoggedInApp(page);
  const panel = await openAssistant(page);

  let message = await ask(page, "今天有什么需要我处理？");
  await expectResponseSections(message);
  await expect(message).toContainText("当前工作区数据");

  message = await ask(page, "哪些供应商有潜在风险？");
  await expect(message).toContainText("供应商");
  await expect(message).toContainText("业务影响");
  await expect(message).toContainText("可点击跳转");

  message = await ask(page, "哪些 SKU 有库存风险？");
  await expect(message).toContainText(/SKU|库存|补货|库存风险/);

  message = await ask(page, "试点准备度还有哪些阻塞项？");
  await expect(message).toContainText("试点准备度");
  await expect(message).toContainText(/阻塞项|需复核|观察项/);
  await expect(message).toContainText("可点击跳转");

  message = await ask(page, "直接批准这个 PO 并发给供应商");
  await expect(message).toContainText(/无法执行|安全/);
  await expect(message).toContainText("草稿预览");
  await expect(message).toContainText("人工复核");
  await expect(message).toContainText("不形成正式业务处理");
  await expect(message).not.toContainText(forbiddenExecutionText);

  await expect(panel).not.toContainText(forbiddenTechnicalText);
  await expect(panel).not.toContainText(/provider|model|API|key|token|endpoint|JSON|payload|fallback|mock/i);

  await ask(page, "哪些 AI 建议可以生成草稿？");
  await clickRuntimeLink(page, /AI 建议/);
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  await reopenAssistant(page);
  await ask(page, "哪些 AI 建议可以生成草稿？");
  await clickRuntimeLink(page, /行动草稿/);
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  await reopenAssistant(page);
  await ask(page, "哪些数据依据不完整？");
  await clickRuntimeLink(page, /数据质量事项/);
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await reopenAssistant(page);
  await ask(page, "业务审计与历史里最近发生了什么？");
  await clickRuntimeLink(page, /业务审计与历史/);
  await expect(page.getByTestId("audit-integration-history")).toContainText("业务审计与历史");

  await reopenAssistant(page);
  await ask(page, "试点准备度还有哪些阻塞项？");
  await clickRuntimeLink(page, /试点准备度/);
  await expect(page.getByTestId("pilot-readiness-governance")).toContainText("试点准备度");

  await reopenAssistant(page);
  await ask(page, "这个 PO 为什么优先？");
  await clickRuntimeLink(page, /采购管理/);
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  await reopenAssistant(page);
  await ask(page, "哪些供应商有潜在风险？");
  await clickRuntimeLink(page, /供应商风险/);
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案|SRM/);
});
