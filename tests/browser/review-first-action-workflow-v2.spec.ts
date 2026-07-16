import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-review-first-workflow-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-review-first-workflow-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openWorkflow(page: Page) {
  await page.getByRole("button", { name: "行动草稿与人工复核" }).first().click();
  const workflow = page.getByTestId("review-first-action-workflow-v2");
  await expect(workflow).toBeVisible({ timeout: 15000 });
  await expect(workflow).toContainText("Review-first Action Workflow");
  return workflow;
}

async function openFirstFilteredDraft(page: Page, filter: string, rowText?: RegExp | string) {
  await page.getByTestId("review-workflow-filters").getByRole("button", { name: filter }).click();
  const inbox = page.getByTestId("review-workflow-inbox");
  const row = rowText ? inbox.getByRole("row").filter({ hasText: rowText }).first() : inbox.getByRole("row").nth(1);
  await row.getByRole("button", { name: "查看" }).click();
  await expect(page.getByTestId("review-workflow-detail")).toBeVisible();
}

test("Review-first Action Workflow renders lifecycle workspace and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  const workflow = await openWorkflow(page);

  for (const label of ["Review-first Action Workflow", "行动草稿与人工复核", "当前工作区数据", "草稿预览", "人工复核", "不形成正式业务处理"]) {
    await expect(workflow).toContainText(label);
  }

  const summary = page.getByTestId("review-workflow-summary");
  for (const label of ["草稿总数", "等待人工复核", "需要补充信息", "高优先级", "数据限制事项", "来源数量"]) {
    await expect(summary).toContainText(label);
  }

  const sourceSummary = page.getByTestId("review-workflow-source-summary");
  for (const label of ["AI Response", "风险与异常", "Reports & Analytics", "Data Access & Quality", "PR / RFQ / PO / GRN / Invoice", "Supplier Operational Profile", "Inventory Risk"]) {
    await expect(sourceSummary).toContainText(label);
  }

  const inbox = page.getByTestId("review-workflow-inbox");
  for (const label of ["优先级", "草稿编号", "草稿标题", "草稿类型", "来源", "目标业务对象", "当前状态", "负责人", "关键证据", "建议下一步"]) {
    await expect(inbox).toContainText(label);
  }

  for (const label of ["内部复核备注", "RFQ 草稿预览", "PO 草稿预览", "差异说明", "收货异常说明", "供应商风险说明", "字段映射建议", "数据补齐清单", "报表复核备注", "库存风险复核"]) {
    await expect(inbox).toContainText(label);
  }

  for (const filter of ["等待人工复核", "高优先级", "AI", "风险与异常", "Reports", "Data Access", "P2P", "Supplier", "Inventory", "数据限制"]) {
    await page.getByTestId("review-workflow-filters").getByRole("button", { name: filter }).click();
    await expect(inbox.getByRole("row").nth(1)).toBeVisible();
  }

  await openFirstFilteredDraft(page, "全部");
  const detail = page.getByTestId("review-workflow-detail");
  for (const label of ["结论", "来源", "目标业务对象", "关键证据", "业务影响", "草稿内容预览", "复核清单", "缺失信息", "建议下一步", "可点击跳转", "数据限制", "生命周期状态", "允许流转", "需要原因的流转", "边界说明", "审计预览"]) {
    await expect(detail).toContainText(label);
  }

  await openFirstFilteredDraft(page, "等待人工复核");
  await page.getByRole("button", { name: "要求补充信息" }).first().click();
  await expect(detail).toContainText("请填写原因后再更新草稿复核状态");
  await page.getByPlaceholder("需要原因的流转请填写原因").fill("补充供应商回复证据后再复核");
  await page.getByRole("button", { name: "要求补充信息" }).first().click();
  await expect(detail).toContainText("需要补充信息");

  await openFirstFilteredDraft(page, "等待人工复核");
  await page.getByRole("button", { name: "退回复核" }).first().click();
  await expect(detail).toContainText("请填写原因后再更新草稿复核状态");

  await openFirstFilteredDraft(page, "全部", /草稿预览/);
  await page.getByRole("button", { name: "取消草稿" }).first().click();
  await expect(detail).toContainText("请填写原因后再更新草稿复核状态");
  await page.getByPlaceholder("需要原因的流转请填写原因").fill("该草稿暂不进入本轮复核");
  await page.getByRole("button", { name: "取消草稿" }).first().click();
  await expect(detail).toContainText("已取消");

  await page.goto("/");
  await openWorkflow(page);
  await page.getByTestId("review-workflow-nav-link").filter({ hasText: /PO/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);

  await page.goto("/");
  await openWorkflow(page);
  await page.getByTestId("review-workflow-nav-link").filter({ hasText: /Supplier Operational Profile/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);

  await page.goto("/");
  await openWorkflow(page);
  await page.getByTestId("review-workflow-nav-link").filter({ hasText: /Data Access|数据接入/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await page.goto("/");
  await openWorkflow(page);
  await page.getByTestId("review-workflow-nav-link").filter({ hasText: /Reports & Analytics/ }).first().click();
  await expect(page.getByTestId("reports-analytics-v2")).toContainText("Reports & Analytics");

  await page.goto("/");
  await openWorkflow(page);
  await page.getByTestId("review-workflow-nav-link").filter({ hasText: /风险与异常/ }).first().click();
  const riskScope = page.getByTestId("module-export-scope");
  await expect(riskScope).toContainText("风险与异常");
  await expect(riskScope).toContainText(/风险分类|异常清单/);
  await expect(riskScope).not.toContainText("AI 建议列表");

  await page.goto("/");
  const reopened = await openWorkflow(page);
  await expect(reopened).not.toContainText(forbiddenExecutionText);
  await expect(reopened).not.toContainText(forbiddenTechnicalText);
});
