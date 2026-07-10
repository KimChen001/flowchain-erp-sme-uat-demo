import { expect, test, type Page } from "@playwright/test";

const user = { id: "print-editor-user", company: "新辰智能制造", name: "张磊", email: "zhanglei@example.com", role: "供应链经理" };
async function openLoggedInApp(page: Page) { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "print-editor-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); await page.goto("/"); await expect(page.getByTestId("app-main")).toBeVisible(); }
async function openDeliveryEditor(page: Page) { const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "销售管理", exact: true }).click(); await nav.getByRole("button", { name: "销售出库单 / 发货单", exact: true }).click(); await page.getByTestId("delivery-page").getByRole("button", { name: /打印发货单 DN-/ }).first().click(); await expect(page.getByTestId("print-layout-editor")).toBeVisible(); }

test("delivery print editor binds data and edits layout", async ({ page }) => {
  await openLoggedInApp(page); await openDeliveryEditor(page); const editor = page.getByTestId("print-layout-editor");
  await expect(editor.getByTestId("print-canvas")).toContainText("DN-2026-0710-001"); await expect(editor.getByTestId("print-canvas")).toContainText("华南自动化设备有限公司");
  await editor.getByTestId("print-title-input").fill("客户专用发货单"); await expect(editor.getByTestId("print-canvas")).toContainText("客户专用发货单");
  const title = editor.getByTestId("print-element-title"); const before = await title.getAttribute("style"); await editor.getByTestId("print-x-input").fill("88"); await editor.getByTestId("print-y-input").fill("96"); await editor.getByTestId("print-width-input").fill("520"); await editor.getByTestId("print-height-input").fill("50"); await expect(title).not.toHaveAttribute("style", before || "");
  await editor.getByRole("button", { name: /商品明细/ }).click(); await editor.getByLabel("sku列标题").fill("商品编码"); await expect(editor.getByTestId("print-data-table")).toContainText("商品编码"); await editor.getByLabel("cartonCount列显示").uncheck(); await expect(editor.getByTestId("print-data-table")).not.toContainText("箱数");
  await editor.getByRole("button", { name: "单据标题" }).click(); await editor.getByTestId("print-visible-toggle").uncheck(); await expect(editor.getByTestId("print-canvas")).not.toContainText("客户专用发货单"); await editor.getByTestId("print-visible-toggle").check();
  await editor.getByRole("button", { name: /保存模板/ }).click(); await editor.getByRole("button", { name: /返回单据/ }).click(); await page.getByTestId("delivery-page").getByRole("button", { name: /打印发货单 DN-/ }).first().click(); await expect(page.getByTestId("print-canvas")).toContainText("客户专用发货单");
  await page.getByRole("button", { name: /恢复默认/ }).click(); await expect(page.getByTestId("print-canvas")).toContainText("标准发货单");
  await page.evaluate(() => { (window as any).__printCalled = false; window.print = () => { (window as any).__printCalled = true; }; }); await page.getByTestId("print-document-button").click(); await expect.poll(() => page.evaluate(() => (window as any).__printCalled)).toBe(true);
});

test("receipt and receive-sheet open editors with current document data", async ({ page }) => {
  await openLoggedInApp(page); const nav = page.locator("aside nav"); await nav.getByRole("button", { name: "销售管理", exact: true }).click(); await nav.getByRole("button", { name: "签收单", exact: true }).click(); await page.getByTestId("receipt-page").getByRole("button", { name: /打印签收单 SR-/ }).first().click(); await expect(page.getByTestId("print-canvas")).toContainText("SR-2026-0710-001"); await expect(page.getByTestId("print-canvas")).toContainText("张海峰"); await page.getByRole("button", { name: /返回单据/ }).click();
  await nav.getByRole("button", { name: "采购管理", exact: true }).click(); await nav.getByRole("button", { name: "采购收货单 / 入库单", exact: true }).click(); await page.getByRole("button", { name: /打印入库单 GRN-/ }).first().click(); await expect(page.getByTestId("print-layout-editor")).toBeVisible(); await expect(page.getByTestId("print-canvas")).toContainText(/GRN-2026/); await expect(page.getByTestId("print-canvas")).toContainText(/佛山标准件|广州化工耗材|江苏铝合金集团/);
});
