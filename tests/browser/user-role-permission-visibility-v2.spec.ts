import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-role-permission-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|修改权限|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|写入配置/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-role-permission-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openRolePermissions(page: Page) {
  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  await page.getByRole("button", { name: "角色权限可见性", exact: true }).click();
  const root = page.getByTestId("user-role-permission-visibility");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root).toContainText("角色权限可见性");
  return root;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
  await expect(target).not.toContainText(/Coupa|RBAC/i);
}

test("User Role Permission Visibility v2 renders business roles permissions drafts and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openRolePermissions(page);

  for (const label of ["系统设置", "角色权限可见性", "当前工作区数据", "当前仅展示角色权限状态", "权限变更只生成复核草稿"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["业务角色", "职责包", "单据权限", "复核链路", "数据范围", "模块可见性", "受限动作", "权限复核草稿", "当前状态"]) {
    await expect(root).toContainText(label);
  }

  const roles = root.getByTestId("role-profiles");
  for (const label of ["需求提交人", "采购专员", "寻源负责人", "采购负责人", "收货协同负责人", "库存与计划负责人", "供应商管理负责人", "财务复核负责人", "数据负责人", "系统配置复核人", "管理层只读观察者"]) {
    await expect(roles).toContainText(label);
  }

  for (const testId of ["permission-bundles", "document-permission-matrix", "review-chain-visibility", "data-scope-groups", "module-visibility-matrix", "review-permission-policies", "restricted-action-policies", "permission-review-drafts"]) {
    await expect(root.getByTestId(testId)).toBeVisible();
  }

  const documents = root.getByTestId("document-permission-matrix");
  for (const label of ["PR", "RFQ", "PO", "GRN", "Invoice", "Supplier Operational Profile", "SKU", "AI Suggestion", "Action Draft", "Collaboration Draft", "Workspace Config Draft"]) {
    await expect(documents).toContainText(label);
  }

  const chains = root.getByTestId("review-chain-visibility");
  for (const label of ["RFQ 授标建议复核", "PO 到货异常复核", "Invoice 差异复核", "Supplier 风险复核", "Data Quality 补齐复核", "Workspace Config 变更复核"]) {
    await expect(chains).toContainText(label);
  }

  const scopes = root.getByTestId("data-scope-groups");
  for (const label of ["采购数据范围", "库存数据范围", "供应商数据范围", "财务协同数据范围", "数据接入质量范围", "管理层汇总范围"]) {
    await expect(scopes).toContainText(label);
  }

  const drafts = root.getByTestId("permission-review-drafts");
  for (const label of ["预览权限草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"]) {
    await expect(drafts).toContainText(label);
  }

  await root.getByRole("button", { name: /工作区配置/ }).first().click();
  await expect(page.getByTestId("workspace-setup-config")).toContainText("工作区配置");

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /AI 建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /行动草稿与人工复核/ }).first().click();
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /协同通知草稿/ }).first().click();
  await expect(page.getByTestId("collaboration-notification-drafts")).toContainText("协同通知草稿");

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /采购管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  await page.goto("/");
  root = await openRolePermissions(page);
  await root.getByRole("button", { name: /供应商管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案|SRM/);

  await page.goto("/");
  root = await openRolePermissions(page);
  await expectCleanText(root);
});
