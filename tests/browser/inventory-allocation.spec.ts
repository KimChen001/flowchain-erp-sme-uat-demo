import { expect, test, type Locator, type Page } from "@playwright/test";

const user = {
  id: "browser-inventory-allocation-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => {
    window.localStorage.setItem("scm-demo-token", "browser-inventory-allocation-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
}

async function askAssistant(page: Page, prompt: string) {
  await page.getByTestId("ai-assistant-input").fill(prompt);
  await page.getByTestId("ai-assistant-send").click();
  await expect(page.getByTestId("ai-message-user").filter({ hasText: prompt })).toBeVisible();
  const assistant = page.getByTestId("ai-message-assistant").last();
  await expect(assistant).toBeVisible();
  await expect(assistant).not.toContainText("正在回复");
  return assistant;
}

async function expectNoForbiddenVisibleText(target: Locator) {
  await expect(target).not.toContainText(/provider fallback|tool_result|debug|entityType|documentType|raw JSON|ActionDraft|purchase_request_draft/i);
  await expect(target).not.toContainText(/Demo|UAT|演示数据|示例数据|样例数据|mock|sample|fake|fallback/i);
}

test.describe("Inventory Allocation and ATP", () => {
  test("shows SKU availability, sales allocation, AI answers, and cockpit Chinese titles", async ({ page }) => {
    await openLoggedInApp(page);

    const overview = page.getByTestId("module-export-scope");
    await expect(overview).not.toContainText(/Open PRs|Active RFQs|Open POs|Pending Receiving|Match Exceptions|Inventory Risks|Urgent Followups|Total Open Amount/);
    await expect(overview).toContainText("库存分配风险");
    await expect(overview).toContainText("可承诺量风险");
    await expect(overview).toContainText("供需缺口");

    await page.getByRole("button", { name: "库存管理" }).first().click();
    const inventory = page.getByTestId("module-export-scope");
    await expect(inventory).toContainText("库存可用量使用边界");
    await expect(inventory).toContainText("库存预留建议");
    await expect(inventory.getByTestId("inventory-allocation-SKU-00412")).toBeVisible();
    await expect(inventory.getByTestId("inventory-allocation-SKU-00412")).toContainText("SKU-00412");
    await expect(inventory).toContainText("实物库存");
    await expect(inventory).toContainText("已预留");
    await expect(inventory).toContainText("销售需求");
    await expect(inventory).toContainText("可用量");
    await expect(inventory).toContainText("可承诺量");
    await expect(inventory).toContainText("在途采购");
    await expect(inventory).toContainText("缺口");
    await expect(inventory).toContainText("证据链预览");
    await expect(inventory).toContainText("SKU → 库存可用量 → 客户订单 → 采购订单 → 供应商 → 收货单");
    await expect(inventory).toContainText("系统仅生成内部通知草稿，不会自动发送到外部协同工具。");

    await page.getByRole("button", { name: "调拨影响预览" }).first().click();
    await expect(inventory).toContainText("调拨与库存影响使用边界");
    await expect(inventory).toContainText("调拨影响预览");
    await expect(inventory).toContainText("库存影响预览");
    await expect(inventory).toContainText("不会自动下发 WMS");
    await expect(inventory).toContainText("不会自动更新库存余额");
    await expect(inventory).not.toContainText(/已批准并下发|调入库存已更新|调拨单已创建|新建调拨单|提交审批|生成出库建议|差异已审批入账/);

    await page.getByRole("button", { name: /库存总览/ }).first().click();
    await page.getByRole("button", { name: "查看销售需求" }).first().click();
    await expect(page.getByText("SKU-00412 已聚焦，销售需求页面可查看受影响客户订单。")).toBeVisible();

    await page.getByRole("button", { name: "销售需求" }).first().click();
    const sales = page.getByTestId("module-export-scope");
    await expect(sales).toContainText("库存分配信息");
    await expect(sales).toContainText("当前订单分配量");
    await expect(sales).toContainText("库存预留建议");
    await expect(sales).toContainText("供需缺口");
    await expect(sales).toContainText("证据链预览");
    await expect(sales).toContainText("客户订单 → SKU → 库存可用量 → 采购订单 → 供应商 → 收货单");

    await openAssistant(page);
    const shortage = await askAssistant(page, "SKU-00412 为什么缺货？");
    await expect(shortage).toContainText("SKU-00412");
    await expect(shortage).toContainText("SO-2026-0412-A");
    await expect(shortage).toContainText(/PO-2026-1282|在途采购/);
    await expect(shortage).toContainText("建议操作");
    await expect(shortage).toContainText("依据");
    await expectNoForbiddenVisibleText(shortage);

    const atp = await askAssistant(page, "SKU-00412 当前可承诺量是多少？");
    await expect(atp).toContainText(/可承诺量|ATP/);
    await expect(atp).toContainText("SKU-00412");
    await expectNoForbiddenVisibleText(atp);

    const negative = await askAssistant(page, "哪些 SKU 预计可用量为负？");
    await expect(negative).toContainText("库存分配");
    await expect(negative).toContainText("SKU-00412");
    await expectNoForbiddenVisibleText(negative);

    await expectNoForbiddenVisibleText(inventory);
    await expectNoForbiddenVisibleText(sales);
  });
});
