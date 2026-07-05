import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-pr-detail-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-pr-detail-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test("procurement requisition list and detail are business object surfaces", async ({ page }) => {
  await openLoggedInApp(page);
  await page.getByRole("button", { name: "采购管理" }).first().click();
  await page.getByRole("button", { name: "采购申请", exact: true }).click();

  const scope = page.getByTestId("module-export-scope");
  await expect(scope).toContainText("采购申请列表");
  for (const label of ["PR 编号", "申请人", "申请部门", "状态", "需求日期", "预估金额", "下一步"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope.getByRole("button", { name: /自动提交|自动批准|自动下单|自动发送 RFQ|自动发送 PO|真实付款|真实收货|过账/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "查看详情" }).first().click();
  await expect(scope).toContainText("采购申请 / PR");
  for (const section of ["概览", "明细行", "复核状态 / 复核人", "评论与附件", "历史记录", "关联单据", "证据链摘要", "数据限制"]) {
    await expect(scope).toContainText(section);
  }
  for (const field of ["SKU / 物料", "数量", "单位", "需求日期", "推荐供应商", "关联缺口", "关联客户订单"]) {
    await expect(scope).toContainText(field);
  }
  await expect(scope).toContainText("返回采购工作台");
  await expect(scope).toContainText("返回采购申请列表");
  await expect(scope).toContainText("返回上一级");

  await scope.getByRole("button", { name: "拒绝", exact: true }).click();
  await scope.getByRole("button", { name: "生成复核预览" }).click();
  await expect(scope).toContainText("拒绝需要填写原因");

  await scope.getByRole("button", { name: "生成 RFQ 草稿预览" }).click();
  await expect(page.getByText(/已生成 RFQ 草稿预览/)).toBeVisible();
  await scope.getByRole("button", { name: "生成 PO 草稿预览" }).click();
  await expect(page.getByText(/已生成 PO 草稿预览/)).toBeVisible();

  await expect(scope).not.toContainText(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|mock|demo|UAT/i);

  await page.getByRole("button", { name: "数据接入与质量" }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("导入任务");
  await expect(page.getByTestId("data-access-business-page")).not.toContainText(/dry-run|tenantId|writesDb|writesFiles/i);
});
