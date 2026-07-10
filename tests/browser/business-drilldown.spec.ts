import { expect, test } from "@playwright/test";

const user = { id: "drilldown-user", company: "新辰智能制造", name: "张磊", email: "drill@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("scm-demo-token", "drill-token"); localStorage.setItem("scm-demo-user", JSON.stringify(profile)); }, user); });

test("PR number opens a refresh-safe URL and returns with list filters", async ({ page }) => {
  await page.goto("/app/procurement/requests");
  await page.getByLabel("状态").selectOption("待审批");
  await expect(page).toHaveURL(/status=/);
  const link = page.locator('a[href*="/app/procurement/requests/PR-2026-2401"]');
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(/\/app\/procurement\/requests\/PR-2026-2401/);
  await expect(page.getByTestId("business-entity-detail")).toContainText("PR-2026-2401");
  await page.reload();
  await expect(page.getByTestId("business-entity-detail")).toContainText("采购负责人");
  const backLinks = page.getByRole("link", { name: "所有采购申请" });
  await expect(backLinks).toHaveCount(2);
  await backLinks.first().click();
  await expect(page).toHaveURL(/\/app\/procurement\/requests\?status=/);
  await expect(page.getByLabel("状态")).toHaveValue("待审批");
});

test("three-way match drills into PO and returns through browser history", async ({ page }) => {
  await page.goto("/app/finance/three-way-match/MATCH-INV-SZ-260422");
  const detail = page.getByTestId("business-entity-detail");
  await expect(detail).toContainText("容差规则");
  await expect(detail).toContainText("行级明细");
  const poLink = detail.locator('a[href*="/app/procurement/orders/PO-2026-1283"]');
  await expect(poLink).toHaveCount(1);
  await poLink.click();
  await expect(page).toHaveURL(/\/app\/procurement\/orders\/PO-2026-1283/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/finance\/three-way-match\/MATCH-INV-SZ-260422/);
});

test("invoice, reconciliation, and settlement identifiers are semantic links", async ({ page }) => {
  await page.goto("/app/finance/invoices");
  await expect(page.locator('a[href*="/app/finance/invoices/INV-FO-260418"]')).toHaveCount(1);
  await page.goto("/app/finance/reconciliation");
  await expect(page.locator('a[href*="/app/finance/reconciliation/REC-2026-05-FO-001"]')).toHaveCount(1);
  await page.goto("/app/finance/settlement");
  await expect(page.locator('a[href*="/app/finance/settlement/SET-2026-0001"]')).toHaveCount(1);
});
