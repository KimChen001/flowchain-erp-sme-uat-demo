import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-supplier-profile-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-supplier-profile-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

test("supplier operational profile connects RFQ PO GRN invoice evidence without execution actions", async ({ page }) => {
  await openLoggedInApp(page);
  await page.getByRole("button", { name: "供应商管理" }).first().click();
  await page.getByRole("button", { name: "供应商资料目录", exact: true }).click();

  const scope = page.getByTestId("module-export-scope");
  for (const label of ["供应商编号", "供应商名称", "供应商类型 / 品类", "状态", "主要联系人", "采购负责人", "相关 RFQ 数", "相关 PO 数", "未完成 PO 数", "收货异常数", "发票差异数", "已收未票金额", "最近交易日期", "风险等级", "下一步"]) {
    await expect(scope).toContainText(label);
  }

  await expect(scope.getByRole("button", { name: /新增供应商|编辑供应商|删除供应商|邀请供应商|发送邮件|更新银行账户|修改付款条款|发布风险评级|自动黑名单|自动暂停供应商|付款|会计过账/ })).toHaveCount(0);

  await scope.getByRole("button", { name: "查看运营档案" }).first().click();
  await expect(scope).toContainText("Supplier Operational Profile / 供应商运营档案");

  for (const section of ["概览", "P2P Summary", "相关 RFQ / Quote", "相关 PO", "收货 / GRN 表现", "发票 / 三单匹配", "已收未票 / 未开票风险", "风险信号", "绩效指标", "联系人与地址", "证书 / 合规占位", "评论与附件", "历史记录", "证据链", "数据限制"]) {
    await expect(scope).toContainText(section);
  }

  for (const overviewField of ["Supplier ID", "Supplier Name", "主要物料 / SKU", "付款条款，只读", "最近 RFQ", "最近 PO", "最近收货", "最近发票", "当前风险等级", "当前下一步"]) {
    await expect(scope).toContainText(overviewField);
  }

  for (const p2pField of ["RFQ 数量", "已响应报价数", "报价响应率", "PO 数量", "Open PO 数量", "PO 总金额", "未收数量", "已收数量", "收货异常数", "Invoice 数量", "发票差异数", "未开票金额", "已收未票金额", "三单匹配异常数", "最近交易日期"]) {
    await expect(scope).toContainText(p2pField);
  }

  for (const rfqField of ["RFQ 编号", "来源 PR", "品类 / SKU", "报价状态", "报价总额", "交期", "MOQ", "推荐结果", "是否入选授标建议草稿", "风险提示", "查看 RFQ", "查看报价比较", "查看授标建议草稿"]) {
    await expect(scope).toContainText(rfqField);
  }

  for (const poField of ["PO 编号", "来源 PR", "来源 RFQ", "PO 状态", "PO 金额", "ETA / 预计到货", "收货状态", "发票状态", "三单匹配状态", "当前下一步", "查看 PO", "查看 PO Line", "查看收货记录", "查看发票记录", "查看三单匹配"]) {
    await expect(scope).toContainText(poField);
  }

  for (const grnField of ["GRN / Receipt 编号", "GRN Line", "PO Line", "收货数量", "拒收数量", "收货日期", "Receiver", "质检 / 异常状态", "是否影响发票匹配", "行级备注"]) {
    await expect(scope).toContainText(grnField);
  }

  for (const invoiceField of ["Invoice 编号", "Invoice Line", "GRN Line", "发票金额", "税额", "总额", "匹配状态", "差异类型", "差异金额", "到期日", "当前风险", "建议处理"]) {
    await expect(scope).toContainText(invoiceField);
  }

  for (const riskField of ["风险名称", "风险等级", "证据来源", "业务影响", "建议动作", "数据限制"]) {
    await expect(scope).toContainText(riskField);
  }

  for (const performanceField of ["RFQ 响应率", "平均报价交期", "平均付款条款", "PO 完成率", "准时到货率", "收货异常率", "发票匹配率", "差异金额", "最近交易活跃度", "供应商运营评分"]) {
    await expect(scope).toContainText(performanceField);
  }

  for (const readonlyField of ["联系人姓名", "职务", "邮箱", "电话", "地址", "供应地点", "主要品类", "证书名称", "到期日期", "数据是否完整", "需要补充的信息"]) {
    await expect(scope).toContainText(readonlyField);
  }

  for (const returnPath of ["返回供应商列表", "返回 SRM 工作台", "返回采购工作台", "返回相关 RFQ", "返回相关 PO", "返回相关收货记录", "返回相关发票记录", "返回证据链", "返回上一级"]) {
    await expect(scope).toContainText(returnPath);
  }

  await scope.getByRole("button", { name: "生成内部复核备注草稿", exact: true }).click();
  await expect(scope).toContainText("内部复核备注草稿已生成");
  await scope.getByRole("button", { name: "生成供应商风险说明草稿", exact: true }).click();
  await expect(scope).toContainText("不发布风险评级");
  await scope.getByRole("button", { name: "生成供应商沟通草稿", exact: true }).click();
  await expect(scope).toContainText("不会外发");
  await scope.getByRole("button", { name: "标记需人工复核预览", exact: true }).click();
  await expect(scope).toContainText("不改变当前状态");

  await expect(scope.getByRole("button", { name: /新增供应商|编辑供应商|删除供应商|邀请供应商|发送邮件|更新银行账户|修改付款条款|发布风险评级|自动黑名单|自动暂停供应商|付款|会计过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting/ })).toHaveCount(0);
  await expect(scope).not.toContainText(/JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|mock|demo|UAT/i);

  await scope.getByRole("button", { name: "返回供应商列表" }).click();
  await page.getByRole("button", { name: "采购管理" }).first().click();
  await page.getByRole("button", { name: "采购申请", exact: true }).click();
  await expect(scope).toContainText("采购申请列表");
  await page.getByRole("button", { name: "寻源 / RFx", exact: true }).click();
  await expect(scope).toContainText("RFQ 编号");
  await page.getByRole("button", { name: "采购订单", exact: true }).click();
  await expect(scope).toContainText("采购订单列表");
  await page.getByRole("button", { name: "数据接入与质量" }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toContainText("导入任务");
  await expect(page.getByTestId("data-access-business-page")).not.toContainText(/dry-run|tenantId|writesDb|writesFiles/i);
});
