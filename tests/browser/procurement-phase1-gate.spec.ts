import { test, expect, type Page } from "@playwright/test";
async function auth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("scm-demo-token", "phase1");
    localStorage.setItem(
      "scm-demo-user",
      JSON.stringify({
        id: "procurement-manager",
        name: "采购经理",
        role: "采购经理",
      }),
    );
  });
}
test.beforeEach(async ({ page }) => auth(page));
test("canonical PR direct PO workflow persists through refresh", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/procurement/requests", {
    headers: {
      "x-flowchain-role": "manager",
      "x-flowchain-user": "procurement-manager",
    },
    data: {
      requesterId: "u",
      supplierId: "SUP-001",
      currency: "CNY",
      paymentTermsId: "NET30",
      expectedDeliveryDate: "2026-08-01",
      totalAmount: 20,
      lines: [
        {
          lineType: "non_catalog_item",
          itemNameSnapshot: "测试服务",
          unitSnapshot: "项",
          quantity: 1,
          unitPrice: 20,
        },
      ],
    },
  });
  const draft = await created.json();
  const submitted = await request.post(
    `/api/procurement/requests/${draft.id}/submit`,
    {
      headers: { "x-flowchain-role": "manager" },
      data: { expectedVersion: draft.version },
    },
  );
  const createdId = (await submitted.json()).id;
  await page.goto("/app/procurement/requests");
  let row = page
    .locator("div.rounded-lg.border")
    .filter({ hasText: createdId });
  await expect(row).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -240);
  await row.getByRole("button", { name: "批准" }).click();
  row = page.locator("div.rounded-lg.border").filter({ hasText: createdId });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "路径建议" }).click();
  await expect(page.getByText(/推荐：direct_po/)).toBeVisible();
  await row.getByRole("button", { name: "创建采购订单" }).click();
  await expect(page).toHaveURL(/procurement\/orders/);
  await expect(page.getByText("真实采购订单")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/draft · v1/).last()).toBeVisible();
});
test("canonical RFQ page has no synthetic quotes", async ({ page }) => {
  await page.goto("/app/procurement/rfq");
  await expect(page.getByText("真实询价单")).toBeVisible();
  await expect(page.getByText("尚未录入供应商报价")).toBeVisible();
  await expect(page.getByText(/预计节省|当前最优|供应商排名/)).toHaveCount(0);
});
test("canonical procurement pages have no page-level overflow at supported widths", async ({
  page,
}) => {
  for (const width of [768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/app/procurement/requests",
      "/app/procurement/orders",
      "/app/procurement/rfq",
    ]) {
      await page.goto(path);
      const sizes = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
    }
  }
});
test("canonical API enforces permissions and expectedVersion", async ({
  request,
}) => {
  const body = {
    requesterId: "u",
    currency: "CNY",
    totalAmount: 10,
    lines: [
      {
        lineType: "non_catalog_item",
        itemNameSnapshot: "测试服务",
        unitSnapshot: "项",
        quantity: 1,
        unitPrice: 10,
      },
    ],
  };
  const denied = await request.post("/api/procurement/requests", {
    data: body,
    headers: { "x-flowchain-role": "viewer" },
  });
  expect(denied.status()).toBe(403);
  const created = await request.post("/api/procurement/requests", {
    data: body,
    headers: {
      "x-flowchain-role": "business-specialist",
      "x-flowchain-user": "u",
    },
  });
  expect(created.status()).toBe(201);
  const pr = await created.json();
  const submit = await request.post(
    `/api/procurement/requests/${pr.id}/submit`,
    {
      data: { expectedVersion: pr.version },
      headers: {
        "x-flowchain-role": "business-specialist",
        "x-flowchain-user": "u",
      },
    },
  );
  expect(submit.status()).toBe(200);
  const conflict = await request.post(
    `/api/procurement/requests/${pr.id}/cancel`,
    {
      data: { expectedVersion: 1 },
      headers: {
        "x-flowchain-role": "business-specialist",
        "x-flowchain-user": "u",
      },
    },
  );
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe("VERSION_CONFLICT");
  const forbidden = await request.post(
    `/api/procurement/requests/${pr.id}/approve`,
    {
      data: { expectedVersion: 2 },
      headers: {
        "x-flowchain-role": "procurement-specialist",
        "x-flowchain-user": "buyer",
      },
    },
  );
  expect(forbidden.status()).toBe(403);
});
