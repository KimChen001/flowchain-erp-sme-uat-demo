import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-reports-analytics-v2-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动发送报表|创建报表订阅|外发邮件|导出正式财务报表|生成审计报告|自动批准|自动下单|发送 PO|发布 RFQ|提交收货|库存过账|发票过账|付款|会计过账|修改供应商主数据|自动修复数据|自动提交导入|自动覆盖数据/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|entityType|documentType|raw enum/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-reports-analytics-v2-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openReports(page: Page) {
  await page.getByRole("button", { name: "报表与分析" }).first().click();
  const reports = page.getByTestId("reports-analytics-v2");
  await expect(reports).toBeVisible();
  await expect(reports).toContainText("Reports & Analytics");
  return reports;
}

test("Reports Analytics v2 renders operational insights and safe navigation", async ({ page }) => {
  await openLoggedInApp(page);
  const reports = await openReports(page);

  for (const label of ["Reports & Analytics", "跨模块运营分析", "当前工作区数据", "数据限制"]) {
    await expect(reports).toContainText(label);
  }

  for (const label of ["PR", "RFQ", "PO", "GRN", "Invoice", "三单匹配差异", "风险供应商", "库存风险", "Control Tower", "数据质量问题"]) {
    await expect(reports).toContainText(label);
  }

  const pipeline = page.getByTestId("reports-p2p-pipeline");
  for (const label of ["PR", "RFQ", "PO", "GRN", "Invoice", "Three-way Match", "数量", "风险", "Top issue"]) {
    await expect(pipeline).toContainText(label);
  }

  const supplier = page.getByTestId("reports-supplier-risk");
  for (const label of ["供应商", "PO 数", "RFQ 数", "收货异常", "发票差异", "已收未票金额", "风险等级", "跳转供应商运营档案"]) {
    await expect(supplier).toContainText(label);
  }

  const inventory = page.getByTestId("reports-inventory-risk");
  for (const label of ["SKU", "可用库存", "安全库存", "缺口数量", "关联 PR", "关联 PO", "风险等级"]) {
    await expect(inventory).toContainText(label);
  }

  const finance = page.getByTestId("reports-finance-collaboration");
  for (const label of ["Invoice", "PO", "GRN", "差异类型", "差异金额", "匹配状态"]) {
    await expect(finance).toContainText(label);
  }

  const controlTower = page.getByTestId("reports-control-tower");
  for (const label of ["供应商风险", "PO 未收货", "数据缺口", "top priority item"]) {
    await expect(controlTower).toContainText(label);
  }

  const dataQuality = page.getByTestId("reports-data-quality-impact");
  for (const label of ["AI Response Contract v2", "Operations Control Tower", "Three-way Match", "Data Access"]) {
    await expect(dataQuality).toContainText(label);
  }

  const insights = page.getByTestId("reports-insight-cards");
  for (const label of ["结论", "关键证据", "业务影响", "建议动作", "数据限制", "内部复核", "草稿预览"]) {
    await expect(insights).toContainText(label);
  }

  await pipeline.getByTestId("reports-analytics-nav-link").filter({ hasText: /打开 PO/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);

  await page.goto("/");
  await openReports(page);
  await page.getByTestId("reports-supplier-risk").getByTestId("reports-analytics-nav-link").filter({ hasText: /供应商运营档案/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);

  await page.goto("/");
  await openReports(page);
  await page.getByTestId("reports-data-quality-impact").getByTestId("reports-analytics-nav-link").filter({ hasText: /Data Access|数据接入/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("数据接入与质量");

  await page.goto("/");
  await openReports(page);
  await page.getByTestId("reports-control-tower").getByTestId("reports-analytics-nav-link").filter({ hasText: /Operations Control Tower/ }).first().click();
  await expect(page.getByTestId("operations-control-tower-v2")).toContainText(/Action Inbox|行动收件箱/);

  await page.goto("/");
  const reopened = await openReports(page);
  await expect(reopened).not.toContainText(forbiddenExecutionText);
  await expect(reopened).not.toContainText(forbiddenTechnicalText);
});
