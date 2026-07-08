import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-ai-availability-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const unavailableText = /AI 助手暂不可用|当前未能读取工作区证据|请稍后重试/i;
const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|model|endpoint|token|API key|API|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|Coupa|RBAC|production|deploy|go-live|system prompt|prompt package|OpenAI|DeepSeek|Doubao|豆包/i;
const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-ai-availability-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  const panel = page.getByTestId("ai-assistant-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("当前工作区数据");
  await expect(panel).toContainText("证据辅助回答");
  await expect(panel).toContainText("复核优先");
  return panel;
}

async function ask(page: Page, question: string): Promise<Locator> {
  const panel = page.getByTestId("ai-assistant-panel");
  const before = await panel.getByTestId("ai-response-v2").count();
  await panel.getByTestId("ai-assistant-input").fill(question);
  await panel.getByTestId("ai-assistant-send").click();
  await expect(panel.getByTestId("ai-response-v2")).toHaveCount(before + 1, { timeout: 25000 });
  const message = panel.getByTestId("ai-message-assistant").last();
  await expect(message).toBeVisible();
  return message;
}

async function expectAvailableBusinessAnswer(message: Locator, businessText: RegExp) {
  await expect(message).toContainText("结论");
  await expect(message).toContainText(/关键证据|依据/);
  await expect(message).toContainText(/建议动作|建议操作/);
  await expect(message).toContainText(/人工复核|草稿预览|不提交|不写库存|不外发/);
  await expect(message).toContainText(businessText);
  await expect(message).not.toContainText(unavailableText);
  await expect(message).not.toContainText(forbiddenTechnicalText);
  await expect(message).not.toContainText(forbiddenExecutionText);
}

test("AI Assistant stays available for core current-workspace business questions", async ({ page }) => {
  await openLoggedInApp(page);
  await openAssistant(page);

  let message = await ask(page, "今天有哪些收货异常？");
  await expectAvailableBusinessAnswer(message, /收货|GRN|采购订单|PO|库存|SKU|今日行动/);

  message = await ask(page, "今天最需要处理什么？");
  await expectAvailableBusinessAnswer(message, /今日行动|采购订单|库存|SKU|供应商|收货/);

  message = await ask(page, "哪些库存项目需要关注？");
  await expectAvailableBusinessAnswer(message, /库存|SKU|补货|可用量|可承诺量/);
});
