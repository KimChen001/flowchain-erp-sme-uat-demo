import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-po-evidence-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-po-evidence-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

test("PO detail shows receiving invoice and three-way match evidence without execution actions", async ({ page }) => {
  await openLoggedInApp(page);
  await page.getByRole("button", { name: "采购管理" }).first().click();
  await page.getByRole("button", { name: "采购订单", exact: true }).click();

  const scope = page.getByTestId("module-export-scope");
  await expect(scope).toContainText("采购订单列表");
  for (const label of ["PO 编号", "来源 PR", "来源 RFQ", "供应商", "收货状态", "发票状态", "三单匹配状态", "下一步"]) {
    await expect(scope).toContainText(label);
  }
  await expect(scope.getByRole("button", { name: /发送 PO|下发 PO|下发至供应商|确认 PO|自动收货|过账库存|创建正式发票|付款|会计过账|删除 PO|Submit Receipt|Receive Submit|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "查看详情" }).first().click();
  await expect(scope).toContainText("采购订单 / PO");
  for (const section of ["概览", "PO 明细行", "来源 PR / RFQ", "收货 / GRN Line", "发票 / Invoice Line", "三单匹配", "未开票 / 已收未票", "历史记录", "证据链", "数据限制"]) {
    await expect(scope).toContainText(section);
  }

  for (const field of ["PO Line 编号", "来源 PR Line", "来源 RFQ Line", "SKU", "数量", "单位", "已收数量", "未收数量", "已开票数量", "未开票数量"]) {
    await expect(scope).toContainText(field);
  }
  for (const grnField of ["GRN / Receipt 编号", "GRN Line 编号", "PO Line 编号", "收货数量", "收货日期", "Receiver", "是否影响发票匹配"]) {
    await expect(scope).toContainText(grnField);
  }
  for (const invoiceField of ["Invoice 编号", "Invoice Line 编号", "GRN / Receipt Line", "开票数量", "发票金额", "税额", "匹配状态", "差异类型"]) {
    await expect(scope).toContainText(invoiceField);
  }
  for (const matchField of ["PO 数量", "已收数量", "开票数量", "PO 单价", "发票单价", "PO 金额", "发票金额", "数量差异", "单价差异", "金额差异", "收货缺口", "发票缺口", "建议处理"]) {
    await expect(scope).toContainText(matchField);
  }
  for (const accrualField of ["Uninvoiced Qty", "Uninvoiced Total", "Received Qty", "Approved Invoiced Qty", "Accrual Exposure", "已收未票风险"]) {
    await expect(scope).toContainText(accrualField);
  }

  for (const returnPath of ["返回来源 PR", "返回来源 RFQ", "返回 PO 列表", "返回收货记录", "返回发票记录", "返回三单匹配", "返回采购工作台", "返回证据链", "返回上一级"]) {
    await expect(scope).toContainText(returnPath);
  }

  await scope.getByRole("button", { name: "生成收货异常说明草稿", exact: true }).click();
  await expect(page.getByText(/仅生成内部说明，不提交收货、不修改库存/)).toBeVisible();
  await scope.getByRole("button", { name: "生成差异说明草稿", exact: true }).click();
  await expect(page.getByText(/仅解释三单匹配差异，需人工复核/)).toBeVisible();
  await scope.getByRole("button", { name: "生成内部复核备注草稿", exact: true }).click();
  await expect(page.getByText(/不审批发票、不付款、不形成会计分录/)).toBeVisible();

  await expect(scope.getByRole("button", { name: /发送 PO|下发 PO|下发至供应商|确认 PO|自动收货|过账库存|创建正式发票|付款|会计过账|删除 PO|Submit Receipt|Receive Submit|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting/ })).toHaveCount(0);
  await expect(scope).not.toContainText(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|mock|demo|UAT/i);

  await page.getByRole("button", { name: "采购申请", exact: true }).click();
  await expect(scope).toContainText("采购申请列表");
  await page.getByRole("button", { name: "寻源 / RFx", exact: true }).click();
  await expect(scope).toContainText("RFQ 编号");

  await page.getByRole("button", { name: "数据接入与质量" }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("导入任务");
  await expect(page.getByTestId("data-access-business-page")).not.toContainText(/dry-run|tenantId|writesDb|writesFiles/i);
});
