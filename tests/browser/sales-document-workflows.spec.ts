import { expect, test, type Page } from "@playwright/test";

const user = { id: "sales-doc-user", company: "新辰智能制造", name: "张磊", email: "zhanglei@example.com", role: "供应链经理" };

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "sales-doc-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user);
  await page.goto("/"); await expect(page.getByTestId("app-main")).toBeVisible();
}

test("sales documents have separate list and detail surfaces", async ({ page }) => {
  await openLoggedInApp(page);
  const nav = page.locator("aside nav");
  await nav.getByRole("button", { name: "销售管理", exact: true }).click();

  await nav.getByRole("button", { name: "销售出库单 / 发货单", exact: true }).click();
  const delivery = page.getByTestId("delivery-page");
  await expect(delivery.getByRole("heading", { name: "销售出库单 / 发货单" })).toBeVisible();
  await expect(delivery).toContainText("发货单号"); await expect(delivery).toContainText("物流状态"); await expect(delivery).toContainText("销售订单号");
  await delivery.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page.getByRole("heading", { name: "发货单详情" })).toBeVisible();
  await expect(page.getByText("客户和物流信息").or(page.getByText("物流公司", { exact: true })).first()).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).first().click();

  await nav.getByRole("button", { name: "签收单", exact: true }).click();
  const receipts = page.getByTestId("receipt-page");
  await expect(receipts).toContainText("签收人"); await expect(receipts).toContainText("签收日期"); await expect(receipts).toContainText("异常数量");
  await receipts.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page.getByRole("heading", { name: "签收单详情" })).toBeVisible(); await expect(page.getByText("收货差异与明细")).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).first().click();

  await nav.getByRole("button", { name: "销售退货单", exact: true }).click();
  const returns = page.getByTestId("sales-return-page");
  await expect(returns).toContainText("退货原因"); await expect(returns).toContainText("处理状态");
  await returns.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page.getByRole("heading", { name: "销售退货单详情" })).toBeVisible();
});

test("risk and evidence remain independent sales views", async ({ page }) => {
  await openLoggedInApp(page); const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "销售管理", exact: true }).click();
  await nav.getByRole("button", { name: "交付风险", exact: true }).click(); await expect(page.getByRole("heading", { name: "交付风险", exact: true })).toBeVisible(); await expect(page.getByText("交付风险队列")).toBeVisible();
  await nav.getByRole("button", { name: "订单证据链", exact: true }).click(); await expect(page.getByRole("heading", { name: "订单证据链", exact: true })).toBeVisible(); await expect(page.getByText(/客户订单 → SKU → 库存可用量/)).toBeVisible();
});
