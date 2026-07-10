import { expect, test, type Page } from "@playwright/test";

const user = { id: "list-state-user", company: "新辰智能制造", name: "张磊", email: "list@example.com", role: "供应链经理" };
async function open(page: Page, path = "/app/sales/deliveries") {
  await page.addInitScript((profile) => {
    localStorage.setItem("scm-demo-token", "list-state-token");
    localStorage.setItem("scm-demo-user", JSON.stringify(profile));
  }, user);
  await page.goto(path);
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test("delivery list keeps shareable filters, sorting and page across detail and history", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 320 });
  await open(page);
  await page.getByLabel("搜索发货单").fill("华南");
  await page.getByLabel("发货状态").selectOption({ label: "运输中" });
  await page.getByLabel("发货排序").selectOption("customer-asc");
  await expect(page).toHaveURL(/q=%E5%8D%8E%E5%8D%97/);
  await expect(page).toHaveURL(/status=%E8%BF%90%E8%BE%93%E4%B8%AD/);
  await page.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page.getByText("发货单详情")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).last().click();
  await expect(page.getByLabel("搜索发货单")).toHaveValue("华南");
  await expect(page.getByLabel("发货状态")).toHaveValue("运输中");
  await page.getByLabel("搜索发货单").fill("");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(null);
  await page.getByLabel("发货状态").selectOption({ label: "全部" });
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe(null);
  await expect(page.getByTestId("delivery-result-count")).toHaveText("5 张发货单");
  await expect(page.getByRole("button", { name: "下一页" })).toBeEnabled();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  const scrolled = await page.evaluate(() => { const main = document.querySelector<HTMLElement>("[data-testid='app-main']"); if (main) main.scrollTop = 120; return main?.scrollTop || 0; });
  expect(scrolled).toBeGreaterThan(0);
  await page.locator("aside nav").getByRole("button", { name: "库存管理", exact: true }).click();
  await expect(page.getByTestId("module-title")).toHaveText("库存管理");
  await page.evaluate(() => { const main = document.querySelector<HTMLElement>("[data-testid='app-main']"); if (main) main.scrollTop = 0; });
  await page.goBack();
  await expect(page).toHaveURL(/page=2/);
  const savedScroll = await page.evaluate(() => JSON.parse(sessionStorage.getItem("flowchain:list:sales:sales:delivery") || "{}").scrollTop || 0);
  expect(savedScroll).toBeGreaterThan(0);
  await expect(page.getByLabel("搜索发货单")).toHaveValue("");
  await expect(page.getByLabel("发货排序")).toHaveValue("customer-asc");
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLElement>("[data-testid='app-main']")?.scrollTop || 0)).toBeGreaterThan(0);
  const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("flowchain:list:")));
  expect(keys).toContain("flowchain:list:sales:sales:delivery");
});

test("recent pages are bounded, closable, persistent and exclude print workspaces", async ({ page }) => {
  await open(page, "/app/overview");
  for (const path of ["/app/master-data/items", "/app/procurement/orders", "/app/sales/deliveries", "/app/sales/receipts", "/app/inventory/warnings", "/app/inventory/adjustments", "/app/finance/invoices", "/app/reports", "/app/settings"]) {
    await page.goto(path);
  }
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("flowchain:recent-pages:v1") || "[]"));
  expect(stored.length).toBeLessThanOrEqual(8);
  await page.reload();
  await expect(page.getByTestId("recent-pages")).toBeVisible();
  await expect(page.getByTestId("recent-pages").locator("[aria-current='page']")).toBeVisible();
  const beforeClose = await page.getByTestId("recent-pages").locator(".fc-recent-page").count();
  await page.getByTestId("recent-pages").getByLabel(/关闭 /).first().click();
  await expect(page.getByTestId("recent-pages").locator(".fc-recent-page")).toHaveCount(beforeClose - 1);
  await page.goto("/app/sales/deliveries");
  const beforePrint = await page.evaluate(() => localStorage.getItem("flowchain:recent-pages:v1"));
  await page.getByRole("button", { name: /打印发货单 DN-/ }).first().click();
  await expect(page.getByTestId("print-layout-editor")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("flowchain:recent-pages:v1"))).toBe(beforePrint);
});
