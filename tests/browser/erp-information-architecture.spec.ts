import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "browser-ia-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-ia-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test.describe("ERP information architecture cleanup", () => {
  test("supplier and reconciliation keeps supplier risk without exposing supplier portal", async ({ page }) => {
    await openLoggedInApp(page);
    await page.getByRole("button", { name: "供应商与对账" }).first().click();
    const scope = page.getByTestId("module-export-scope");

    await expect(page.getByRole("button", { name: "供应商风险" })).toBeVisible();
    await expect(page.getByRole("button", { name: "供应商绩效", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "供应商门户" })).toHaveCount(0);
    await expect(scope).not.toContainText(/supplier portal/i);

    await expect(scope.getByRole("button", { name: /批准|拒绝|冻结|发送|下发/ })).toHaveCount(0);
  });

  test("supplier management subpages have distinct business surfaces", async ({ page }) => {
    await openLoggedInApp(page);
    await page.getByRole("button", { name: "供应商与对账" }).first().click();
    const scope = page.getByTestId("module-export-scope");

    await page.getByRole("button", { name: "供应商列表" }).click();
    await expect(scope).toContainText("供应商资料目录");
    await expect(scope).toContainText("供应商编码");
    await expect(scope).toContainText("默认币种");
    await expect(scope).not.toContainText("准时率");
    await expect(scope).not.toContainText("质量合格率");
    await expect(scope).not.toContainText("响应分");
    await expect(scope).not.toContainText("开放 PO");
    await expect(scope).not.toContainText("风险判断来源");

    await scope.getByRole("button", { name: "绩效评分与风险队列" }).click();
    await expect(scope).toContainText("绩效评分与风险队列");
    await expect(scope).toContainText("风险判断来源");
    await expect(scope).toContainText("准时率");
    await expect(scope).toContainText("质量合格率");
    await expect(scope).toContainText("响应分");
    await expect(scope).toContainText("发票差异");

    await scope.getByRole("button", { name: "认证资料与准入复核" }).click();
    await expect(scope).toContainText("认证资料与准入复核");
    await expect(scope).toContainText("缺失资料");
    await expect(scope).toContainText("整改事项");
    await expect(scope).not.toContainText("质量合格率");
    await expect(scope).not.toContainText("响应分");
    await expect(scope).not.toContainText("风险判断来源");

    await scope.getByRole("button", { name: "查看详情" }).first().click();
    await expect(page.getByText("复核动作")).toBeVisible();
    await page.getByRole("button", { name: "要求补充" }).click();
    await page.getByRole("button", { name: "生成复核预览" }).click();
    await expect(page.getByText("要求补充需要填写原因")).toBeVisible();
    await page.getByPlaceholder("填写复核原因、补充资料要求或暂缓说明").fill("补齐认证文件后再复核");
    await page.getByRole("button", { name: "生成复核预览" }).click();
    await expect(page.getByText("已生成要求补充复核记录预览")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/supplier portal/i);
  });

  test("default navigation presents SME business trunk and folds advanced internal entries", async ({ page }) => {
    await openLoggedInApp(page);
    const nav = page.locator("aside nav");

    for (const label of ["今日工作台", "销售", "采购", "库存", "供应商与对账", "报表", "基础设置"]) {
      await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    for (const label of ["预测与 MRP", "数据接入与质量", "行动草稿与人工复核", "业务审计与历史", "试点准备度", "系统设置"]) {
      await expect(nav.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    }

    const advancedToggle = nav.getByRole("button", { name: "高级与内部" });
    await expect(advancedToggle).toHaveAttribute("aria-expanded", "false");
    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute("aria-expanded", "true");
    for (const label of ["预测与 MRP", "数据接入与质量", "异常处理工单", "协同通知草稿", "行动草稿与人工复核", "业务审计与历史", "试点准备度", "系统设置"]) {
      await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "基础设置" }).first().click();
    const scope = page.getByTestId("module-export-scope");
    for (const label of ["物料资料", "供应商资料", "仓库资料", "数据导入", "编号规则"]) {
      await expect(nav.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(scope).toContainText("基础资料只维护业务对象基础记录，不做报表分析或业务审批。");
    await expect(scope).not.toContainText("主数据");

    await page.getByRole("button", { name: "报表" }).first().click();
    await expect(scope).toContainText("报表与分析只做汇总、趋势、分析和导出");
    await expect(scope.getByRole("button", { name: /批准|拒绝|过账|编辑业务数据/ })).toHaveCount(0);

    await page.getByRole("button", { name: "数据接入与质量" }).first().click();
    await expect(scope).toContainText("数据接入与质量用于集中处理导入任务、字段映射、校验结果和失败项");
    await expect(scope).toContainText("不承担业务审批");
  });
});
