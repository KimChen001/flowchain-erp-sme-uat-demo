import { expect, test, type Page } from "@playwright/test";

const businessUser = {
  id: "browser-data-access-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem("flowchain:auth-token", "browser-data-access-token");
    window.localStorage.setItem("flowchain:current-user", JSON.stringify(user));
  }, businessUser);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

async function openDataAccess(page: Page) {
  await page.getByRole("button", { name: /数据接入与质量/ }).first().click();
  await expect(page.getByTestId("data-access-business-page")).toBeVisible();
  return page.getByTestId("data-access-business-page");
}

test.describe("Data access business UI", () => {
  test("default page hides technical import details and shows business views", async ({ page }) => {
    await openLoggedInApp(page);
    const scope = await openDataAccess(page);

    await expect(scope).toContainText("数据接入与质量用于集中处理导入任务、字段映射、校验结果和失败项");
    await expect(scope).toContainText("业务页面可发起 CSV 导入");
    await expect(scope).toContainText("当前页面仅展示导入前校验与质量复核结果");
    await expect(scope).toContainText("不会直接覆盖当前工作区数据");

    await expect(scope).toContainText("导入任务");
    await expect(scope).toContainText("字段映射");
    await expect(scope).toContainText("质量检查");
    await expect(scope).toContainText("失败项处理");

    await expect(scope).not.toContainText(/raw JSON|JSON|dry-run|snapshot|normalizedSnapshotHash|tenantId|userId|datasetId|writesDb|writesFiles|overwrite|overwritesDemoData|fallback|mock|fake|sample data|demo data|UAT|演示数据|示例数据|样例数据|测试数据|record payload|technical payload|provider|tool_result/i);
    await expect(scope.getByRole("button", { name: /批准|过账|付款|发送|自动同步|自动覆盖|立即写入|覆盖数据|提交审批|发布集成|执行导入|强制通过/ })).toHaveCount(0);
  });

  test("import tasks, mapping, quality, and failed rows expose business fields", async ({ page }) => {
    await openLoggedInApp(page);
    const scope = await openDataAccess(page);

    for (const label of ["来源模块", "导入类型", "文件名", "记录数", "通过记录", "警告记录", "错误记录", "当前状态"]) {
      await expect(scope).toContainText(label);
    }
    await expect(scope).toContainText("客户订单 CSV 导入");
    await expect(scope).toContainText("查看校验结果");
    await expect(scope).toContainText("查看字段映射");
    await expect(scope).toContainText("查看失败项");

    await scope.getByRole("button", { name: "字段映射", exact: true }).click();
    await expect(scope).toContainText("来源字段");
    await expect(scope).toContainText("系统字段");
    await expect(scope).toContainText("映射状态");
    await expect(scope).toContainText("supplier_name");
    await expect(scope).toContainText("供应商名称");

    await scope.getByRole("button", { name: "质量检查", exact: true }).click();
    await expect(scope).toContainText("问题类型");
    await expect(scope).toContainText("业务影响");
    await expect(scope).toContainText("建议处理");
    await expect(scope).toContainText("缺少必填字段");

    await scope.getByRole("button", { name: "失败项处理", exact: true }).click();
    await expect(scope).toContainText("行号");
    await expect(scope).toContainText("错误字段");
    await expect(scope).toContainText("错误原因");
    await expect(scope).toContainText("建议修正");
    await expect(scope).toContainText("SKU 未在物料资料中找到");
  });

  test("business modules expose CSV entry points and data access keeps return paths", async ({ page }) => {
    await openLoggedInApp(page);
    const app = page.getByTestId("app-main");

    await page.getByRole("button", { name: "销售需求" }).first().click();
    await expect(app).toContainText("导入客户订单 CSV");

    await page.getByRole("button", { name: "采购管理" }).first().click();
    await expect(app).toContainText("导入采购申请 CSV");
    await expect(app).toContainText("导入采购订单 CSV");

    await page.getByRole("button", { name: "库存管理" }).first().click();
    await expect(app).toContainText("导入库存余额 CSV");
    await expect(app).toContainText("导入库存流水 CSV");

    await page.getByRole("button", { name: "供应商管理" }).first().click();
    await expect(app).toContainText("导入供应商资料 CSV");

    await page.getByRole("button", { name: "财务协同" }).first().click();
    await expect(app).toContainText("导入供应商发票 CSV");
    await expect(app).toContainText("导入对账单 CSV");

    const scope = await openDataAccess(page);
    await expect(scope).toContainText("返回数据接入与质量");
    await expect(scope).toContainText("返回来源业务模块");
    await expect(scope).toContainText("返回上一级");
  });
});
