import { expect, test } from "@playwright/test";
const user = { id: "import-manager", company: "新辰智能制造", name: "张磊", email: "import@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => { await page.addInitScript((profile) => { localStorage.setItem("flowchain:auth-token", "import-token"); localStorage.setItem("flowchain:current-user", JSON.stringify(profile)); }, user); });
test("purchase request workbook commits and survives page refresh", async ({ page }) => {
  await page.goto("/app/procurement/requests");
  const id = `PR-BROWSER-${Date.now()}`;
  const csv = `pr,sourceSku,quantity,unit,requiredDate,supplierCode,priority,status\n${id},SKU-00412,24,台,2026-07-25,SUP-FS-STD,中,草稿`;
  await page.getByTestId("excel-import-file-input").first().setInputFiles({ name: "purchase-request.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("excel-import-preview")).toBeVisible();
  await page.getByRole("button", { name: /生成后端预览/ }).click();
  await expect(page.getByTestId("server-import-preview")).toBeVisible();
  await page.getByRole("button", { name: /确认正式导入/ }).click();
  await expect(page.getByTestId("import-task-result")).toContainText("导入批次");
  await page.reload();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
});
