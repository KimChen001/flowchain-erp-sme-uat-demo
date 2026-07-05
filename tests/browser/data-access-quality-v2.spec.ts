import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-data-quality-v2-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动修复|自动提交导入|自动覆盖数据|自动写入数据库|自动创建正式单据|自动补收货|自动过账库存|自动批准发票|自动付款|自动会计过账|自动修改供应商|自动发送邮件|自动同步外部系统|批量删除|清空数据/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|entityType|documentType|raw enum/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-data-quality-v2-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openDataAccess(page: Page) {
  await page.getByRole("button", { name: /数据接入与质量/ }).first().click();
  const pageScope = page.getByTestId("data-access-business-page");
  await expect(pageScope).toBeVisible();
  const quality = page.getByTestId("data-access-quality-v2");
  await expect(quality).toBeVisible();
  await expect(quality).toContainText("Data Quality");
  return { pageScope, quality };
}

test("Data Access Quality v2 shows data coverage impacts review boundaries and navigation", async ({ page }) => {
  await openLoggedInApp(page);
  const { quality } = await openDataAccess(page);

  for (const label of ["数据接入与质量", "Data Quality", "字段映射", "质量问题", "证据缺口", "关系断链", "下游影响"]) {
    await expect(quality).toContainText(label);
  }

  for (const label of ["数据源数量", "已接入数据源", "已映射字段", "未映射字段", "高风险质量问题", "关系断链", "证据缺口", "受影响 AI 判断", "风险与异常"]) {
    await expect(quality).toContainText(label);
  }

  const sourceCoverage = page.getByTestId("data-source-coverage");
  const sourceText = await sourceCoverage.textContent();
  const sourceCount = ["Procurement / PR", "RFQ / Sourcing", "PO", "Receiving / GRN", "Invoice / Three-way Match", "Supplier", "Inventory"].filter((label) => sourceText?.includes(label)).length;
  expect(sourceCount).toBeGreaterThanOrEqual(5);

  const mappings = page.getByTestId("field-mapping-coverage");
  for (const label of ["来源字段", "标准业务字段", "状态", "置信度", "建议映射", "是否人工复核"]) {
    await expect(mappings).toContainText(label);
  }

  const issues = page.getByTestId("quality-issues");
  for (const label of ["缺失 supplier response", "缺失 GRN Line", "缺失 Invoice Line", "缺失 supplier contact / certificate", "未映射字段", "关系断链"]) {
    await expect(issues).toContainText(label);
  }

  const relationships = page.getByTestId("relationship-gaps");
  for (const label of ["PR → RFQ / PO", "PO → GRN", "GRN → Invoice", "Supplier → Transaction Evidence", "SKU → Inventory / Procurement Evidence"]) {
    await expect(relationships).toContainText(label);
  }

  const evidence = page.getByTestId("evidence-gaps");
  await expect(evidence).toContainText(/缺失证据|影响|建议/);

  const downstream = page.getByTestId("downstream-impact");
  for (const label of ["AI Response Contract v2", "风险与异常", "Supplier Operational Profile", "Three-way Match"]) {
    await expect(downstream).toContainText(label);
  }

  const fixes = page.getByTestId("review-first-fixes");
  await expect(fixes).toContainText(/草稿预览|人工复核|不自动写入/);

  await issues.getByTestId("data-quality-nav-link").filter({ hasText: /打开 PO/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);

  await page.goto("/");
  await openDataAccess(page);
  await page.getByTestId("quality-issues").getByTestId("data-quality-nav-link").filter({ hasText: /Supplier Operational Profile/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);

  await page.goto("/");
  await openDataAccess(page);
  await page.getByTestId("quality-issues").getByTestId("data-quality-nav-link").filter({ hasText: /Inventory/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/库存|SKU/);

  await page.goto("/");
  await openDataAccess(page);
  await page.getByTestId("quality-issues").getByTestId("data-quality-nav-link").filter({ hasText: /风险与异常/ }).first().click();
  const riskScope = page.getByTestId("module-export-scope");
  await expect(riskScope).toContainText("风险与异常");
  await expect(riskScope).toContainText(/风险分类|异常清单/);
  await expect(riskScope).not.toContainText("AI 建议列表");

  await page.goto("/");
  const reopened = await openDataAccess(page);
  await expect(reopened.quality).not.toContainText(forbiddenExecutionText);
  await expect(reopened.quality).not.toContainText(forbiddenTechnicalText);
  await expect(reopened.pageScope).toContainText("预览模式");
  await expect(reopened.pageScope).toContainText("导入预览");
  await expect(reopened.pageScope).toContainText("不保存业务数据");
  await expect(reopened.pageScope).toContainText("当前工作区数据");
  await expect(reopened.pageScope).toContainText("人工确认");
  await expect(reopened.pageScope).not.toContainText(forbiddenTechnicalText);
});
