import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-rfq-sourcing-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-rfq-sourcing-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

test("RFQ sourcing detail shows quotes comparison and draft-only award recommendation", async ({ page }) => {
  await openLoggedInApp(page);
  await page.getByRole("button", { name: "采购管理" }).first().click();
  await page.getByRole("button", { name: "寻源 / RFx", exact: true }).click();

  const scope = page.getByTestId("module-export-scope");
  await expect(scope).toContainText("寻源 / RFx");
  for (const label of ["RFQ 编号", "标题", "来源 PR", "状态", "采购负责人", "供应商数量", "报价响应数量", "行数", "预计金额", "截止日期", "推荐结果", "下一步"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope.getByRole("button", { name: /发送 RFQ|发布 RFQ|邀请供应商|自动授标|确认 award|正式创建 PO|下发 PO|删除 RFQ|付款|合同签署/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "查看详情" }).first().click();
  await expect(scope).toContainText("RFQ / 寻源对象");
  for (const section of ["概览", "RFQ 明细行", "供应商报价", "报价比较", "授标建议草稿", "关联 PR / PO 草稿", "评论与附件", "历史记录", "证据链", "数据限制"]) {
    await expect(scope).toContainText(section);
  }

  for (const field of ["RFQ Line 编号", "来源 PR Line", "SKU", "数量", "单位", "需求日期", "目标仓库"]) {
    await expect(scope).toContainText(field);
  }
  for (const quoteField of ["响应状态", "响应时间", "报价总额", "付款条款", "交期", "MOQ", "报价行编号", "报价单价", "行级风险"]) {
    await expect(scope).toContainText(quoteField);
  }
  for (const comparisonField of ["总报价", "单价优势", "风险评分", "供应商评级", "供应能力", "推荐理由", "节省金额"]) {
    await expect(scope).toContainText(comparisonField);
  }
  for (const awardField of ["推荐供应商", "推荐分配比例", "推荐金额", "风险提示", "需要人工复核的问题", "是否建议拆分分配", "是否可生成 PO 草稿预览"]) {
    await expect(scope).toContainText(awardField);
  }

  await scope.getByRole("button", { name: "生成授标建议草稿" }).click();
  await expect(page.getByText(/已生成授标建议草稿/)).toBeVisible();
  await scope.getByRole("button", { name: "生成 PO 草稿预览" }).click();
  await expect(page.getByText(/已生成 PO 草稿预览/)).toBeVisible();

  for (const returnPath of ["返回来源 PR", "返回 RFQ 列表", "返回采购工作台", "返回上一级"]) {
    await expect(scope).toContainText(returnPath);
  }
  await expect(scope).not.toContainText(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|mock|demo|UAT/i);
  await expect(scope.getByRole("button", { name: /发送 RFQ|发布 RFQ|邀请供应商|自动授标|确认 award|正式创建 PO|下发 PO|付款|合同签署/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "返回来源 PR" }).first().click();
  await expect(scope).toContainText("采购申请列表");

  await page.getByRole("button", { name: "数据接入与质量" }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("导入任务");
  await expect(page.getByTestId("data-access-business-page")).not.toContainText(/dry-run|tenantId|writesDb|writesFiles/i);
});
