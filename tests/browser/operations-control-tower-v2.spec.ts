import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-operations-tower-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|提交收货|过账库存|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|会计过账|付款|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|demo|UAT|entityType|documentType/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-operations-tower-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function returnToOverview(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("operations-control-tower-v2")).toBeVisible();
}

test("Operations Control Tower v2 renders action inbox detail filters and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  const tower = page.getByTestId("operations-control-tower-v2");
  const scope = page.getByTestId("module-export-scope");

  await expect(tower).toContainText("Operations Control Tower");
  await expect(tower).toContainText(/Action Inbox|行动收件箱|今日待处理/);
  for (const label of ["待处理事项", "高风险事项", "可生成草稿预览", "数据缺口", "今日最高优先级"]) {
    await expect(tower).toContainText(label);
  }

  const inbox = page.getByTestId("operations-action-inbox");
  for (const label of ["优先级", "事项标题", "类别", "业务对象", "负责人", "到期 / 年龄", "风险等级", "关键原因", "建议下一步"]) {
    await expect(inbox).toContainText(label);
  }
  const presentCategories = ["供应商风险", "PO 未收货", "已收未票", "发票差异", "三单匹配差异", "RFQ 待回复", "PR 待处理", "库存风险", "数据缺口"];
  const inboxText = await inbox.textContent();
  const visibleCategoryCount = presentCategories.filter((category) => inboxText?.includes(category)).length;
  expect(visibleCategoryCount).toBeGreaterThanOrEqual(5);
  for (const category of ["供应商风险", "PO 未收货", "已收未票", "RFQ 待回复", "库存风险", "数据缺口"]) {
    await expect(inbox).toContainText(category);
  }

  const filterCases = [
    ["risk", /P0|P1|风险/],
    ["procurement", /PO 未收货|RFQ 待回复|PR 待处理/],
    ["supplier", "供应商风险"],
    ["inventory", "库存风险"],
    ["finance", /已收未票|发票差异|三单匹配差异/],
    ["data", "数据缺口"],
    ["draft", "草稿"],
  ] as const;
  for (const [filter, expected] of filterCases) {
    await page.getByTestId(`operations-filter-${filter}`).click();
    await expect(inbox).toContainText(expected);
  }
  await page.getByTestId("operations-filter-all").click();

  await page.getByTestId("operations-action-detail-button").first().click();
  const detail = page.getByTestId("operations-action-detail");
  await expect(detail).toBeVisible();
  for (const section of ["结论", "为什么优先", "关键证据", "业务影响", "建议动作", "可点击跳转", "数据限制", "内部复核", "草稿预览", "允许动作", "禁止动作"]) {
    await expect(detail).toContainText(section);
  }
  await expect(detail).toContainText(/人工复核|内部复核|草稿预览/);
  await expect(detail).not.toContainText(forbiddenExecutionText);
  await expect(detail).not.toContainText(forbiddenTechnicalText);

  await page.keyboard.press("Escape");
  await expect(detail).not.toBeVisible();
  await page.getByTestId("operations-filter-procurement").click();
  await inbox.locator("tbody tr").filter({ hasText: "PO 未收货" }).first().getByTestId("operations-action-detail-button").click();
  await page.getByTestId("operations-action-detail").getByTestId("operations-nav-link").filter({ hasText: /打开 PO|查看 PO/ }).first().click();
  await expect(scope).toContainText(/采购订单|PO/);

  await returnToOverview(page);
  await page.getByTestId("operations-filter-supplier").click();
  await page.getByTestId("operations-action-detail-button").first().click();
  await page.getByTestId("operations-action-detail").getByTestId("operations-nav-link").filter({ hasText: /供应商运营档案|供应商/ }).first().click();
  await expect(scope).toContainText(/供应商|运营档案/);

  await returnToOverview(page);
  await page.getByTestId("operations-filter-data").click();
  await page.getByTestId("operations-action-detail-button").first().click();
  await page.getByTestId("operations-action-detail").getByTestId("operations-nav-link").filter({ hasText: "数据接入与质量" }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText(/导入任务|字段映射|质量/);

  await returnToOverview(page);
  await expect(tower).not.toContainText(forbiddenExecutionText);
  await expect(tower).not.toContainText(forbiddenTechnicalText);
});
