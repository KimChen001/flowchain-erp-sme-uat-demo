import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-audit-history-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|修改权限|修改历史|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-audit-history-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openAuditHistory(page: Page) {
  await page.getByRole("button", { name: "业务审计与历史", exact: true }).click();
  const root = page.getByTestId("audit-integration-history");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root).toContainText("业务审计与历史");
  return root;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
  await expect(target).not.toContainText(/Coupa|RBAC/i);
}

async function clickTimelineFilter(root: Locator, label: string, expected: RegExp) {
  const timeline = root.getByTestId("audit-history-timeline");
  await timeline.getByTestId("audit-history-filters").getByRole("button", { name: new RegExp(label) }).click();
  await expect(timeline).toContainText(expected);
}

async function reopenAudit(page: Page) {
  await page.goto("/");
  return openAuditHistory(page);
}

test("Audit Integration History v2 renders read-only history filters and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openAuditHistory(page);

  for (const label of ["业务审计与历史", "当前工作区数据", "当前仅展示只读历史", "不改变业务对象状态", "不形成正式业务处理"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["历史总数", "AI 建议历史", "行动草稿历史", "协同草稿历史", "数据质量历史", "设置治理历史", "角色权限历史", "工作区边界历史", "业务对象历史", "待人工复核", "数据限制", "当前状态"]) {
    await expect(root).toContainText(label);
  }

  await expect(root.getByTestId("audit-history-profile")).toContainText("工作区名称");
  await expect(root.getByTestId("audit-history-profile")).toContainText("历史原则");

  const timeline = root.getByTestId("audit-history-timeline");
  for (const label of ["历史时间线", "AI 建议历史", "行动草稿历史", "协同草稿历史", "数据质量历史", "工作区配置历史", "角色权限历史", "工作区边界历史"]) {
    await expect(timeline).toContainText(label);
  }

  for (const label of ["全部", "AI 建议", "草稿复核", "协同草稿", "数据质量", "设置治理", "角色权限", "工作区边界", "业务对象", "待人工复核", "数据限制"]) {
    await expect(timeline.getByTestId("audit-history-filters").getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }

  await clickTimelineFilter(root, "AI 建议", /AI 建议历史/);
  await clickTimelineFilter(root, "草稿复核", /行动草稿历史/);
  await clickTimelineFilter(root, "协同草稿", /协同草稿历史/);
  await clickTimelineFilter(root, "数据质量", /数据质量历史/);
  await clickTimelineFilter(root, "工作区边界", /工作区边界历史/);

  const ai = root.getByTestId("ai-suggestion-history");
  for (const label of ["AI 建议历史", "关键证据", "业务影响", "数据限制", "复核边界"]) {
    await expect(ai).toContainText(label);
  }

  const drafts = root.getByTestId("review-draft-history");
  for (const label of ["草稿复核历史", "行动草稿", "配置复核草稿", "权限复核草稿", "边界复核草稿"]) {
    await expect(drafts).toContainText(label);
  }

  const collaboration = root.getByTestId("collaboration-draft-history");
  for (const label of ["协同草稿历史", "内部协同备注", "供应商沟通草稿", "财务复核说明", "数据质量说明"]) {
    await expect(collaboration).toContainText(label);
  }

  const data = root.getByTestId("data-access-history");
  for (const label of ["数据接入历史", "字段映射", "数据质量事项", "数据补齐", "证据缺口"]) {
    await expect(data).toContainText(label);
  }

  const governance = root.getByTestId("settings-role-boundary-history");
  for (const label of ["设置与权限历史", "工作区配置历史", "角色权限历史", "工作区边界历史"]) {
    await expect(governance).toContainText(label);
  }

  const objects = root.getByTestId("business-object-history");
  for (const label of ["业务对象历史", "PR", "RFQ", "PO", "GRN", "Invoice", "Supplier Operational Profile", "SKU", "Action Draft", "Collaboration Draft"]) {
    await expect(objects).toContainText(label);
  }

  await root.getByRole("button", { name: /进入 AI 建议|打开 AI 建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入行动草稿与人工复核/ }).first().click();
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入协同通知草稿/ }).first().click();
  await expect(page.getByTestId("collaboration-notification-drafts")).toContainText("协同通知草稿");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入工作区配置/ }).first().click();
  await expect(page.getByTestId("workspace-setup-config")).toContainText("工作区配置");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入角色权限可见性/ }).first().click();
  await expect(page.getByTestId("user-role-permission-visibility")).toContainText("角色权限可见性");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入工作区边界/ }).first().click();
  await expect(page.getByTestId("workspace-boundary-visibility")).toContainText("工作区边界");

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入采购管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入供应商管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案|SRM/);

  root = await reopenAudit(page);
  await root.getByRole("button", { name: /进入报表与分析|打开报表与分析/ }).first().click();
  await expect(page.getByTestId("reports-analytics-v2")).toContainText(/报表与分析|Reports/);

  root = await reopenAudit(page);
  await expectCleanText(root);
});
