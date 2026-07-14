import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-workspace-setup-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|立即生效|自动应用|写入配置|修改权限|创建租户|切换租户/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-workspace-setup-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openWorkspaceSetup(page: Page) {
  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  const root = page.getByTestId("workspace-setup-config");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root).toContainText("系统设置");
  await expect(root).toContainText("工作区配置");
  return root;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
}

test("Workspace Setup Config v2 renders configuration visibility and safe source navigation", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openWorkspaceSetup(page);

  for (const label of ["系统设置", "工作区配置", "当前工作区数据", "本页仅展示配置状态与配置复核草稿"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["启用模块", "复核优先模块", "草稿边界策略", "数据质量事项", "AI 边界", "协同草稿策略", "配置复核草稿", "当前状态"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["工作区名称", "业务范围", "运行模式", "数据范围", "设置状态"]) {
    await expect(root).toContainText(label);
  }

  const modules = root.getByTestId("workspace-module-settings");
  for (const label of ["今日工作台", "AI 建议", "采购管理", "库存管理", "供应商管理", "财务协同", "报表与分析", "数据接入与质量", "行动草稿与人工复核", "协同通知草稿"]) {
    await expect(modules).toContainText(label);
  }

  await expect(root.getByTestId("workspace-review-policies")).toContainText("复核策略");
  const numbering = root.getByTestId("workspace-numbering-rules");
  for (const label of ["PR", "RFQ", "PO", "GRN", "Invoice", "CND"]) {
    await expect(numbering).toContainText(label);
  }

  await expect(root.getByTestId("workspace-data-quality-settings")).toContainText("数据质量设置");
  await expect(root.getByTestId("workspace-ai-boundaries")).toContainText("AI 辅助边界");
  await expect(root.getByTestId("workspace-collaboration-policies")).toContainText("协同草稿策略");

  const drafts = root.getByTestId("workspace-setup-review-drafts");
  for (const label of ["配置复核草稿", "预览配置草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"]) {
    await expect(drafts).toContainText(label);
  }

  await root.getByTestId("workspace-data-quality-settings").getByRole("button", { name: /数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await root.getByTestId("workspace-ai-boundaries").getByRole("button", { name: /AI 建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await root.getByTestId("workspace-collaboration-policies").getByRole("button", { name: /协同通知草稿/ }).first().click();
  await expect(page.getByTestId("collaboration-notification-drafts")).toContainText("协同通知草稿");

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await root.getByTestId("workspace-setup-review-drafts").getByRole("button", { name: "进入人工复核" }).first().click();
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await root.getByTestId("workspace-module-settings").getByRole("button", { name: /报表与分析/ }).first().click();
  await expect(page.getByTestId("reports-analytics-v2")).toContainText(/报表与分析|Reports/);

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await root.getByTestId("workspace-module-settings").getByRole("button", { name: /采购管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  await page.goto("/");
  root = await openWorkspaceSetup(page);
  await expectCleanText(root);
});
