import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-ai-suggestions-workbench-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-ai-suggestions-workbench-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openAiSuggestions(page: Page) {
  await page.getByRole("button", { name: "AI 建议", exact: true }).click();
  const workbench = page.getByTestId("ai-suggestions-workbench");
  await expect(workbench).toBeVisible({ timeout: 15000 });
  await expect(workbench).toContainText("AI 建议");
  return workbench;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
}

async function clickFilter(page: Page, label: string) {
  await page.getByTestId("ai-suggestion-filter").filter({ hasText: label }).click();
  await expect(page.getByTestId("ai-suggestion-filter").filter({ hasText: label })).toBeVisible();
}

async function expectRowsContain(page: Page, pattern: RegExp) {
  const rows = page.getByTestId("ai-suggestion-row");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  const texts = await rows.allTextContents();
  expect(texts.every((row) => pattern.test(row))).toBeTruthy();
}

test("AI Suggestions Workbench v2 renders dynamic evidence suggestions drafts filters and navigation", async ({ page }) => {
  await openLoggedInApp(page);
  const workbench = await openAiSuggestions(page);

  for (const label of ["当前工作区数据", "AI 仅生成解释、证据整理与行动草稿", "PO 建议", "库存建议", "供应商建议", "财务建议", "高优先级", "数据限制"]) {
    await expect(workbench).toContainText(label);
  }

  const rows = page.getByTestId("ai-suggestion-row");
  await expect(rows.first()).toBeVisible();
  await expect(workbench).toContainText("AI 建议列表");
  await expect(workbench).toContainText("建议详情");
  await expect(workbench).not.toContainText("AI 审计记录");
  await expect(workbench).not.toContainText("人工复核要求");

  for (const label of ["全部", "采购", "库存", "供应商", "财务", "数据质量", "高优先级", "可生成草稿", "数据限制"]) {
    await expect(workbench.getByTestId("ai-suggestion-filter").filter({ hasText: label })).toBeVisible();
  }

  await clickFilter(page, "采购");
  await expectRowsContain(page, /PO 建议|采购|PO/);
  await clickFilter(page, "库存");
  await expectRowsContain(page, /库存建议|库存|SKU/);
  await clickFilter(page, "供应商");
  await expectRowsContain(page, /供应商建议|供应商/);
  await clickFilter(page, "数据限制");
  await expectRowsContain(page, /数据限制/);

  await clickFilter(page, "全部");
  await rows.filter({ hasText: /库存建议/ }).first().click();
  const detail = page.getByTestId("ai-suggestion-detail");
  for (const label of ["结论", "为什么建议优先处理", "关键证据", "业务影响", "建议动作", "可点击跳转", "数据限制", "内部复核", "草稿预览", "边界说明"]) {
    await expect(detail).toContainText(label);
  }

  await detail.getByTestId("ai-suggestion-nav-link").filter({ hasText: /库存|SKU/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/库存|SKU/);

  await page.goto("/");
  await openAiSuggestions(page);
  await page.getByTestId("ai-suggestion-row").filter({ hasText: /PO 建议/ }).first().click();
  await page.getByTestId("ai-suggestion-detail").getByTestId("ai-suggestion-nav-link").filter({ hasText: /PO/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);

  await page.goto("/");
  await openAiSuggestions(page);
  await page.getByTestId("ai-suggestion-row").filter({ hasText: /供应商建议/ }).first().click();
  await page.getByTestId("ai-suggestion-detail").getByTestId("ai-suggestion-nav-link").filter({ hasText: /供应商|档案/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);

  await page.goto("/");
  await openAiSuggestions(page);
  await page.getByTestId("ai-suggestion-row").filter({ hasText: /数据质量建议/ }).first().click();
  await expect(page.getByTestId("ai-suggestion-detail")).toContainText(/数据限制|边界说明/);
  await page.getByTestId("ai-suggestion-detail").getByTestId("ai-suggestion-nav-link").filter({ hasText: /行动草稿与人工复核/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/行动草稿与人工复核|等待人工复核/);

  await page.goto("/");
  const reopened = await openAiSuggestions(page);
  await expect(reopened.getByTestId("ai-draft-preview-card").first()).toBeVisible();
  await expect(reopened).toContainText("预览草稿");
  await expect(reopened).toContainText("进入人工复核");
  await expect(reopened).not.toContainText("打开行动草稿");
  await expect(reopened).not.toContainText("标记仅内部留存");
  await expect(reopened).toContainText("不形成正式业务处理");
  await reopened.getByRole("button", { name: "进入人工复核" }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/行动草稿与人工复核|等待人工复核/);
  await page.goto("/");
  await openAiSuggestions(page);
  await expect(page.getByTestId("ai-suggestions-workbench")).not.toContainText("AI 审计记录");
  await expectCleanText(reopened);
});
