import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-ai-suggestions-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-ai-suggestions-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

test("daily workbench separates today actions risks and AI suggestions", async ({ page }) => {
  await openLoggedInApp(page);
  const scope = page.getByTestId("module-export-scope");

  await expect(scope).toContainText("今日行动");
  for (const label of ["PO 看板", "库存管理", "供应商状态", "财务协同", "今日优先处理队列", "进入工作台", "最近单据"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope).not.toContainText("AI 建议列表");
  await expect(scope).not.toContainText("建议详情");
  await expect(scope).not.toContainText("待人工复核草稿");
  await expect(scope).not.toContainText("AI 审计记录");
  await expect(scope).not.toContainText("Operations Control Tower");

  await page.getByRole("button", { name: "AI 建议", exact: true }).click();
  await expect(scope).toContainText("AI 仅生成解释、证据整理与行动草稿");
  for (const label of ["PO 建议", "库存建议", "供应商建议", "财务建议", "AI 建议列表", "建议详情", "待人工复核草稿", "AI 审计记录"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope.getByTestId("ai-suggestion-row").first()).toBeVisible();
  await expect(scope).toContainText("当前工作区数据");
  await expect(scope).toContainText("可点击跳转");
  await expect(scope).toContainText("内部复核");
  await expect(scope).not.toContainText("Operations Control Tower");

  await scope.getByTestId("ai-suggestion-row").filter({ hasText: /库存建议/ }).first().click();
  await expect(scope).toContainText(/库存|SKU|可承诺|安全库存/);

  await page.getByRole("button", { name: "风险与异常", exact: true }).click();
  for (const label of ["采购风险", "库存风险", "供应商风险", "财务异常", "风险分类", "异常清单", "证据入口"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope).not.toContainText("AI 建议列表");
  await expect(scope).not.toContainText("待人工复核草稿");
  await expect(scope).not.toContainText("AI 审计记录");
});
