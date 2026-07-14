import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-workspace-boundary-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-workspace-boundary-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openBoundary(page: Page) {
  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  await page.getByRole("button", { name: "工作区边界", exact: true }).click();
  const root = page.getByTestId("workspace-boundary-visibility");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root).toContainText("工作区边界");
  return root;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
  await expect(target).not.toContainText(/Coupa|RBAC/i);
}

test("Workspace Boundary Visibility v2 renders boundary status drafts and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openBoundary(page);

  for (const label of ["系统设置", "工作区边界", "当前工作区数据", "当前仅展示工作区边界状态", "边界变更只生成复核草稿"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["边界范围", "数据归属", "模块边界", "业务对象边界", "AI 边界信号", "协同边界", "角色边界", "数据质量边界", "边界复核草稿", "当前状态"]) {
    await expect(root).toContainText(label);
  }

  await expect(root.getByTestId("workspace-boundary-profile")).toContainText("工作区名称");
  await expect(root.getByTestId("workspace-boundary-profile")).toContainText("边界原则");

  const scopes = root.getByTestId("boundary-scopes");
  for (const label of ["采购业务边界", "库存业务边界", "供应商业务边界", "财务协同边界", "数据接入质量边界", "AI 建议边界", "协同通知草稿边界", "角色权限边界", "工作区配置边界"]) {
    await expect(scopes).toContainText(label);
  }

  const ownership = root.getByTestId("data-ownership-groups");
  for (const label of ["采购数据归属", "收货与库存数据归属", "供应商数据归属", "财务复核数据归属", "数据质量归属", "配置与权限边界归属", "管理层观察范围"]) {
    await expect(ownership).toContainText(label);
  }

  const modules = root.getByTestId("module-boundary-matrix");
  for (const label of ["今日工作台", "AI 建议", "采购管理", "库存管理", "供应商管理", "财务协同", "报表与分析", "数据接入与质量", "行动草稿与人工复核", "协同通知草稿", "系统设置", "角色权限可见性"]) {
    await expect(modules).toContainText(label);
  }

  const documents = root.getByTestId("document-boundary-matrix");
  for (const label of ["PR", "RFQ", "PO", "GRN", "Invoice", "Supplier Operational Profile", "SKU", "AI Suggestion", "Action Draft", "Collaboration Draft", "Workspace Config Draft", "Permission Review Draft", "Boundary Review Draft"]) {
    await expect(documents).toContainText(label);
  }

  const ai = root.getByTestId("ai-boundary-awareness");
  for (const label of ["AI 建议只基于当前工作区数据", "AI 解释必须显示关键证据", "AI 建议必须显示数据限制", "AI 草稿只进入人工复核"]) {
    await expect(ai).toContainText(label);
  }

  const collaboration = root.getByTestId("collaboration-boundary-policies");
  for (const label of ["内部协同备注", "供应商沟通草稿", "财务复核说明", "数据质量说明"]) {
    await expect(collaboration).toContainText(label);
  }

  const roles = root.getByTestId("role-boundary-visibility");
  for (const label of ["需求提交人", "采购专员", "采购负责人", "供应商管理负责人", "财务复核负责人", "数据负责人", "系统配置复核人"]) {
    await expect(roles).toContainText(label);
  }

  await expect(root.getByTestId("data-quality-boundary-signals")).toContainText("数据质量边界信号");

  const drafts = root.getByTestId("boundary-review-drafts");
  for (const label of ["预览边界草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"]) {
    await expect(drafts).toContainText(label);
  }

  await root.getByRole("button", { name: /工作区配置/ }).first().click();
  await expect(page.getByTestId("workspace-setup-config")).toContainText("工作区配置");

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /角色权限可见性/ }).first().click();
  await expect(page.getByTestId("user-role-permission-visibility")).toContainText("角色权限可见性");

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /AI 建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /行动草稿与人工复核/ }).first().click();
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /协同通知草稿/ }).first().click();
  await expect(page.getByTestId("collaboration-notification-drafts")).toContainText("协同通知草稿");

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /采购管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /供应商管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案|SRM/);

  await page.goto("/");
  root = await openBoundary(page);
  await root.getByRole("button", { name: /报表与分析/ }).first().click();
  await expect(page.getByTestId("reports-analytics-v2")).toContainText(/报表与分析|Reports/);

  await page.goto("/");
  root = await openBoundary(page);
  await expectCleanText(root);
});
