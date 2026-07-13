import { expect, test, type Page } from "@playwright/test";

const user = { id: "sales-doc-user", company: "新辰智能制造", name: "张磊", email: "zhanglei@example.com", role: "供应链经理" };

async function openLoggedInApp(page: Page) {
  await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "sales-doc-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user);
  await page.goto("/"); await expect(page.getByTestId("app-main")).toBeVisible();
}

test("sales documents have separate list and detail surfaces", async ({ page }) => {
  await openLoggedInApp(page);
  await page.goto("/app/sales/deliveries");
  const delivery = page.getByTestId("module-export-scope");
  await expect(page.getByRole("heading", { name: "销售出库单 / 发货单" })).toBeVisible();
  await expect(delivery).toContainText("发货单号"); await expect(delivery).toContainText("物流状态"); await expect(delivery).toContainText("销售订单号");
  await delivery.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page.getByRole("heading", { name: "发货单详情" })).toBeVisible();
  await expect(page.getByText("客户和物流信息").or(page.getByText("物流公司", { exact: true })).first()).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).first().click();

  await page.goto("/app/sales/receipts");
  const receipts = page.getByTestId("receipt-page");
  await expect(receipts).toContainText("签收人"); await expect(receipts).toContainText("签收日期"); await expect(receipts).toContainText("异常数量");

  await page.goto("/app/sales/returns");
  const returns = page.getByTestId("sales-return-page");
  await expect(returns).toContainText("退货原因"); await expect(returns).toContainText("处理状态");
});

test("risk and evidence remain independent sales views", async ({ page }) => {
  await openLoggedInApp(page);
  await page.goto("/app/sales/risks"); await expect(page.getByRole("heading", { name: "交付风险", exact: true })).toBeVisible(); await expect(page.locator("body")).not.toContainText("SO-2026-0412-A");
  await page.goto("/app/sales/evidence"); await expect(page.getByRole("heading", { name: "订单证据链", exact: true })).toBeVisible(); await expect(page.locator("body")).not.toContainText("SO-2026-0412-A");
});
