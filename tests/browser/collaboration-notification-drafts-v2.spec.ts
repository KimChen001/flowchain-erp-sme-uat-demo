import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-collaboration-drafts-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

const forbiddenExecutionText =
  /自动批准|自动下单|正式创建 PO|下发 PO|发送 PO|发布 RFQ|邀请供应商|发送邮件|发送|推送|已发送|提交收货|Receive Submit|Submit Receipt|库存过账|Post Invoice|Approve Invoice|Mark as Paid|Payment execution|Export to Accounting|付款|会计过账|修改供应商主数据|更新银行账户|发布风险评级|自动黑名单|自动暂停供应商|自动修复|自动提交导入|自动覆盖数据|自动写入数据库|批量删除|清空数据|sent|delivered|dispatched|webhook|portal invite/i;

const forbiddenTechnicalText =
  /JSON|dry-run|tenantId|userId|datasetId|writesDb|writesFiles|DB|database|tool_result|provider|fallback|deterministic|mock|fake|demo|UAT|sample data|demo data|response_card|entityType|documentType|raw enum|payload|webhook/i;

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-collaboration-drafts-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 15000 });
}

async function openCollaborationDrafts(page: Page) {
  await page.getByRole("button", { name: "协同通知草稿", exact: true }).click();
  const pageRoot = page.getByTestId("collaboration-notification-drafts");
  await expect(pageRoot).toBeVisible({ timeout: 15000 });
  await expect(pageRoot).toContainText("协同通知草稿");
  return pageRoot;
}

async function expectCleanText(target: Locator) {
  await expect(target).not.toContainText(forbiddenExecutionText);
  await expect(target).not.toContainText(forbiddenTechnicalText);
}

async function clickFilter(pageRoot: Locator, label: string) {
  await pageRoot.getByTestId("collaboration-draft-filter").filter({ hasText: label }).click();
  await expect(pageRoot.getByTestId("collaboration-draft-row").first()).toBeVisible();
}

test("Collaboration Notification Drafts v2 renders draft adapters policies filters detail and navigation", async ({ page }) => {
  await openLoggedInApp(page);
  let root = await openCollaborationDrafts(page);

  for (const label of ["当前工作区数据", "草稿预览", "人工复核", "不形成正式业务处理", "不外发"]) {
    await expect(root).toContainText(label);
  }
  for (const label of ["通知草稿边界", "协同对象与来源汇总", "通知草稿列表", "消息草稿预览", "需人工复核", "协同对象"]) {
    await expect(root).toContainText(label);
  }
  for (const label of ["Collaboration Notification Drafts", "Channel Policies", "Audience & Source Summary", "Draft Inbox", "Message Preview", "preview-only", "review required", "audience"]) {
    await expect(root).not.toContainText(label);
  }

  for (const label of ["草稿总数", "内部协同", "供应商沟通", "财务复核", "数据补齐", "收货异常", "库存复核", "报表复核", "高优先级", "数据限制"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["内部协同备注", "供应商沟通草稿", "财务复核说明", "数据质量说明", "收货异常说明", "库存复核说明", "报表洞察复核说明"]) {
    await expect(root).toContainText(label);
  }

  for (const label of ["优先级", "草稿编号", "草稿标题", "类型", "协同对象", "来源对象", "状态", "关键证据", "请求回复"]) {
    await expect(root.getByTestId("collaboration-draft-table")).toContainText(label);
  }

  for (const filter of ["内部协同", "供应商沟通", "财务复核", "数据补齐", "收货异常", "库存复核", "报表复核", "高优先级", "数据限制"]) {
    await clickFilter(root, filter);
  }

  await root.getByTestId("collaboration-draft-filter").filter({ hasText: "全部" }).click();
  await root.getByTestId("collaboration-draft-row").filter({ hasText: /PO|内部协同/ }).first().click();
  const detail = root.getByTestId("collaboration-draft-detail");
  for (const label of ["通知类型", "协同对象", "来源对象", "收件人预览", "主题", "消息草稿预览", "关键证据", "业务影响", "请求回复", "复核清单", "缺失信息", "可点击跳转", "数据限制", "边界说明", "审计预览"]) {
    await expect(detail).toContainText(label);
  }

  await detail.getByTestId("collaboration-draft-nav-link").filter({ hasText: /PO|来源对象/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/采购订单|PO/);

  await page.goto("/");
  root = await openCollaborationDrafts(page);
  await root.getByTestId("collaboration-draft-filter").filter({ hasText: "供应商沟通" }).click();
  await root.getByTestId("collaboration-draft-row").first().click();
  await root.getByTestId("collaboration-draft-detail").getByTestId("collaboration-draft-nav-link").filter({ hasText: /供应商|档案/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/供应商|运营档案/);

  await page.goto("/");
  root = await openCollaborationDrafts(page);
  await root.getByTestId("collaboration-draft-filter").filter({ hasText: "数据补齐" }).click();
  await root.getByTestId("collaboration-draft-row").first().click();
  await root.getByTestId("collaboration-draft-detail").getByTestId("collaboration-draft-nav-link").filter({ hasText: /数据|质量/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/数据接入与质量|质量/);

  await page.goto("/");
  root = await openCollaborationDrafts(page);
  await root.getByTestId("collaboration-draft-detail").getByTestId("collaboration-draft-nav-link").filter({ hasText: /行动草稿|人工复核/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/行动草稿与人工复核|等待人工复核/);

  await page.goto("/");
  root = await openCollaborationDrafts(page);
  await root.getByTestId("collaboration-draft-filter").filter({ hasText: "报表复核" }).click();
  await root.getByTestId("collaboration-draft-row").first().click();
  await root.getByTestId("collaboration-draft-detail").getByTestId("collaboration-draft-nav-link").filter({ hasText: /报表|Reports/ }).first().click();
  await expect(page.getByTestId("module-export-scope")).toContainText(/报表与分析|Reports|采购报表/);

  await page.goto("/");
  root = await openCollaborationDrafts(page);
  await expectCleanText(root);
});
