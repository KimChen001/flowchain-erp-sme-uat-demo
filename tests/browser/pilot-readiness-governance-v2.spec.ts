import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-pilot-readiness-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite|保存配置|保存权限|保存边界|保存历史|保存准备度|修改权限|修改历史|修改准备度|删除历史|立即生效|自动应用|分配角色|创建用户|删除用户|禁用用户|创建租户|切换租户|合并租户|迁移数据|同步数据|跨租户查询|写入配置|写入日志|推送日志|导出审计报告|生成正式审计报告|发送审计报告|启用试点|开启试点|上线|部署|生成正式报告|导出正式报告|发送报告/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|schema|environment|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook|API key|Coupa|RBAC|production|deploy|go-live/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-pilot-readiness-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openPilotReadiness(page: Page) {
  await page.getByRole("button", { name: "试点准备度", exact: true }).click();
  const root = page.getByTestId("pilot-readiness-governance");
  await expect(root).toBeVisible({ timeout: 15000 });
  await expect(root).toContainText("试点准备度");
  return root;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
  await expect(target).not.toContainText(/Coupa|RBAC|production|deploy|go-live/i);
}

async function clickFilter(root: Locator, label: string, expected: RegExp) {
  await root.getByTestId("pilot-readiness-filters").getByRole("button", { name: new RegExp(label) }).click();
  await expect(root.getByTestId("pilot-module-readiness")).toContainText(expected);
}

async function reopenPilot(page: Page) {
  return openPilotReadiness(page);
}

test("Pilot Readiness Governance v2 renders read-only readiness center", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openPilotReadiness(page);

  for (const label of ["试点准备度", "当前工作区数据", "当前仅展示试点准备度", "试点事项只生成复核草稿", "不改变业务对象状态", "不形成正式业务处理"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["综合准备度", "可观察模块", "需复核模块", "阻塞项", "观察项", "数据准备度", "AI 准备度", "治理准备度", "复核链路准备度", "协同准备度", "审计历史准备度", "试点复核草稿", "数据限制", "当前状态"]) {
    await expect(root).toContainText(label);
  }

  await expect(root.getByTestId("pilot-readiness-profile")).toContainText("工作区名称");
  await expect(root.getByTestId("pilot-readiness-profile")).toContainText("准备度原则");

  const scope = root.getByTestId("pilot-scope");
  for (const label of ["今日工作台", "AI 建议", "采购管理", "库存管理", "供应商管理", "财务协同", "报表与分析", "数据接入与质量", "行动草稿与人工复核", "协同通知草稿", "系统设置", "角色权限可见性", "工作区边界", "业务审计与历史"]) {
    await expect(scope).toContainText(label);
  }

  const matrix = root.getByTestId("pilot-module-readiness");
  for (const label of ["Module Readiness Matrix", "今日工作台", "AI 建议", "采购管理", "库存管理", "供应商管理", "财务协同", "报表与分析", "数据接入与质量", "行动草稿与人工复核", "协同通知草稿", "系统设置", "角色权限可见性", "工作区边界", "业务审计与历史"]) {
    await expect(matrix).toContainText(label);
  }

  const data = root.getByTestId("pilot-data-readiness");
  for (const label of ["字段映射准备度", "数据质量事项准备度", "采购证据准备度", "收货 / 发票关联准备度", "供应商资料准备度"]) {
    await expect(data).toContainText(label);
  }

  const ai = root.getByTestId("pilot-ai-readiness");
  for (const label of ["今日事项解释", "供应商风险解释", "库存风险解释", "数据限制解释", "草稿预览生成", "人工复核跳转"]) {
    await expect(ai).toContainText(label);
  }

  const review = root.getByTestId("pilot-review-workflow");
  for (const label of ["行动草稿复核", "配置复核草稿", "权限复核草稿", "边界复核草稿", "协同通知草稿复核"]) {
    await expect(review).toContainText(label);
  }

  const collaboration = root.getByTestId("pilot-collaboration-readiness");
  for (const label of ["内部协同备注", "供应商沟通草稿", "财务复核说明", "数据质量说明"]) {
    await expect(collaboration).toContainText(label);
  }

  const governance = root.getByTestId("pilot-governance-readiness");
  for (const label of ["工作区配置准备度", "角色权限可见性准备度", "工作区边界准备度", "AI 边界准备度", "协同草稿策略准备度"]) {
    await expect(governance).toContainText(label);
  }

  const audit = root.getByTestId("pilot-audit-history-readiness");
  for (const label of ["AI 建议历史", "草稿复核历史", "协同草稿历史", "数据接入历史", "设置与权限历史", "工作区边界历史", "业务对象历史"]) {
    await expect(audit).toContainText(label);
  }

  const risk = root.getByTestId("pilot-risk-items");
  for (const label of ["阻塞项", "需复核", "观察项", "数据质量阻塞项", "AI 数据限制复核项", "协同草稿边界复核项"]) {
    await expect(risk).toContainText(label);
  }

  const checklist = root.getByTestId("pilot-review-checklist");
  for (const label of ["今日工作台范围确认", "AI 建议边界确认", "数据质量确认", "行动草稿复核链路确认", "协同通知草稿边界确认", "角色权限可见性确认", "工作区边界确认", "业务审计与历史确认"]) {
    await expect(checklist).toContainText(label);
  }

  const drafts = root.getByTestId("pilot-review-drafts");
  for (const label of ["预览试点草稿", "进入人工复核", "标记仅内部留存", "打开来源模块"]) {
    await expect(drafts).toContainText(label);
  }

  for (const label of ["全部", "可进入试点观察", "需人工复核", "需补充数据", "需治理确认", "阻塞项", "观察项", "数据限制"]) {
    await expect(root.getByTestId("pilot-readiness-filters").getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }

  await clickFilter(root, "需人工复核", /需人工复核|需复核/);
  await clickFilter(root, "阻塞项", /数据质量阻塞项/);
  await clickFilter(root, "观察项", /审计历史覆盖观察项|供应商风险观察项|财务差异观察项/);
  await clickFilter(root, "数据限制", /数据限制|当前分类暂无准备度事项/);

  await root.getByRole("button", { name: /进入 AI 建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestions-workbench")).toContainText("AI 建议");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入行动草稿与人工复核/ }).first().click();
  await expect(page.getByTestId("review-first-action-workflow-v2")).toContainText(/行动草稿与人工复核|Review-first Action Workflow/);

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入协同通知草稿/ }).first().click();
  await expect(page.getByTestId("collaboration-notification-drafts")).toContainText("协同通知草稿");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入工作区配置/ }).first().click();
  await expect(page.getByTestId("workspace-setup-config")).toContainText("工作区配置");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入角色权限可见性/ }).first().click();
  await expect(page.getByTestId("user-role-permission-visibility")).toContainText("角色权限可见性");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入工作区边界/ }).first().click();
  await expect(page.getByTestId("workspace-boundary-visibility")).toContainText("工作区边界");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入业务审计与历史/ }).first().click();
  await expect(page.getByTestId("audit-integration-history")).toContainText("业务审计与历史");

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入采购管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购管理|采购工作台|采购订单/);

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入供应商管理/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案|SRM/);

  root = await reopenPilot(page);
  await root.getByRole("button", { name: /进入报表与分析/ }).first().click();
  await expect(page.getByTestId("reports-analytics-v2")).toContainText(/报表与分析|Reports/);

  root = await reopenPilot(page);
  await expectCleanText(root);
});
