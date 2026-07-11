import { expect, test, type Page } from "@playwright/test";

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("scm-demo-token", "procurement-regression-token");
    localStorage.setItem("scm-demo-user", JSON.stringify({ id: "procurement-regression", company: "新辰智能制造", name: "张磊", email: "procurement@example.com", role: "供应链经理" }));
  });
}

test.beforeEach(async ({ page }) => authenticate(page));

test("procurement workbench and order routes render distinct content", async ({ page }) => {
  for (const path of ["/app/procurement", "/app/procurement/workbench"]) {
    await page.goto(path);
    await expect(page.getByTestId("page-title")).toHaveText("采购工作台");
    await expect(page.getByText("采购执行概况", { exact: false })).toBeVisible();
    await expect(page.getByText("采购订单列表", { exact: true })).toHaveCount(0);
  }
  await page.goto("/app/procurement/orders");
  await expect(page.getByTestId("page-title")).toHaveText("采购订单");
  await expect(page.getByText("采购订单列表", { exact: true })).toBeVisible();
});

test("purchase request unified query uses OR semantics and restores from URL", async ({ page }) => {
  await page.goto("/app/procurement/requests");
  const row = page.locator("tbody tr").first();
  const text = await row.innerText();
  const pr = text.match(/PR-[A-Z0-9-]+/)?.[0];
  const sku = text.match(/SKU-[A-Z0-9-]+/)?.[0];
  expect(pr).toBeTruthy();
  const search = page.getByPlaceholder("PR、SKU 或品名");
  await search.fill(pr!);
  await expect(row).toContainText(pr!);
  await expect(page).toHaveURL(new RegExp(`query=${encodeURIComponent(pr!)}`));
  if (sku) { await search.fill(sku); await expect(row).toContainText(sku); }
  await page.reload();
  await expect(search).toHaveValue(sku || pr!);
});

test("RFQ unified query, empty span and detail copy stay aligned", async ({ page }) => {
  await page.goto("/app/procurement/rfq");
  const row = page.locator("tbody tr").first();
  const text = await row.innerText();
  const rfq = text.match(/RFQ-[A-Z0-9-]+/)?.[0];
  expect(rfq).toBeTruthy();
  const search = page.getByPlaceholder("RFQ、SKU 或标题");
  await search.fill(rfq!);
  await expect(row).toContainText(rfq!);
  await expect(page).toHaveURL(new RegExp(`query=${encodeURIComponent(rfq!)}`));
  await search.fill("__NO_MATCH__");
  await expect(page.getByText("当前条件下暂无 RFQ")).toBeVisible();
  await expect(page.locator("tbody td[colspan='8']")).toHaveCount(1);
});

test("AI focus evidence and impact are collapsed by default", async ({ page }) => {
  await page.goto("/app/overview/ai");
  await expect(page.getByText("结论", { exact: true })).toBeVisible();
  await expect(page.getByText("为什么建议优先处理", { exact: true })).toBeVisible();
  await expect(page.getByText("建议动作", { exact: true })).toBeVisible();
  for (const label of ["查看关键证据", "查看业务影响"]) {
    const details = page.locator("details", { hasText: label });
    await expect(details).not.toHaveAttribute("open", "");
  }
  await expect(page.getByText("边界说明", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("ai-draft-preview-card")).toHaveCount(0);
});
