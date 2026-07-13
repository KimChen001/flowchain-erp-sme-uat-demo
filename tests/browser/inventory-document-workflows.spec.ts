import { expect, test, type Page } from "@playwright/test";

const ghostSku = /SKU-00412|SKU-00623|PO-2026-1287|GRN-202605-0418/;

async function open(page: Page, path: string) {
  await page.addInitScript(() => {
    localStorage.setItem("scm-demo-token", "inventory-doc-token");
    localStorage.setItem("scm-demo-user", JSON.stringify({ id: "inventory-doc-user", name: "张磊", role: "供应链经理" }));
  });
  await page.goto(path);
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test("unmigrated inventory document routes render authoritative empty state", async ({ page }) => {
  for (const [path, title] of [["/app/inventory/adjustments", "库存调整单"], ["/app/inventory/warnings", "库存预警"]] as const) {
    await open(page, path);
    await expect(page.getByTestId("page-title")).toHaveText(title);
    await expect(page.getByText("当前工作区暂无库存记录", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ghostSku);
  }
});

test("lots and exceptions use runtime endpoints without fixture fallback", async ({ page }) => {
  for (const [path, title] of [["/app/inventory/lots", "批次 / 序列号"], ["/app/inventory/exceptions", "库存异常"]] as const) {
    await open(page, path);
    await expect(page.getByTestId("page-title")).toHaveText(title);
    await expect(page.getByText("当前工作区暂无库存记录", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(ghostSku);
  }
});
