import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";

const user = { id: "excel-user", company: "新辰智能制造", name: "张磊", email: "excel@example.com", role: "供应链经理" };
test.beforeEach(async ({ page }) => {
  await page.addInitScript((profile) => { localStorage.setItem("flowchain:auth-token", "excel-token"); localStorage.setItem("flowchain:current-user", JSON.stringify(profile)); }, user);
  await page.goto("/app/finance/invoices");
  await expect(page.getByTestId("excel-import-actions")).toBeVisible();
});

test("downloads a real three-sheet supplier invoice template", async ({ page }) => {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载模板", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("supplier-invoice-import-template.xlsx");
  const path = await download.path();
  expect(path).toBeTruthy();
  const workbook = XLSX.read(await readFile(path!), { type: "buffer" });
  expect(workbook.SheetNames).toEqual(["导入数据", "字段说明", "导入说明"]);
  const definitions = XLSX.utils.sheet_to_json(workbook.Sheets["字段说明"]);
  expect(definitions.length).toBeGreaterThan(5);
});

test("parses, maps, validates, and confirms a real Excel import task", async ({ page }) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([{ 发票编号: "INV-FO-260501", 供应商编号: "SUP-FS-STD", PO编号: "PO-2026-1284", GRN编号: "GRN-202605-0418", 发票日期: "2026-05-31", 到期日期: "2026-06-30", 币种: "CNY", 税前金额: 380000, 税额: 49400, 含税金额: 429400 }]);
  XLSX.utils.book_append_sheet(workbook, sheet, "导入数据");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const input = page.locator('input[type="file"][accept*=".xlsx"]');
  await expect(input).toHaveCount(1);
  await input.setInputFiles({ name: "supplier-invoice-valid.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
  const preview = page.getByTestId("excel-import-preview");
  await expect(preview).toContainText("supplier-invoice-valid.xlsx");
  await expect(preview).toContainText("有效 1");
  await expect(preview).toContainText("错误 0");
  await preview.getByRole("button", { name: "确认导入" }).click();
  await expect(page.getByTestId("import-task-result")).toContainText(/IMP-2026-\d{3}/);
  await expect(page.getByTestId("import-task-result")).toContainText("有效 1 行");
});

test("exports filtered supplier invoices as a real xlsx workbook", async ({ page }) => {
  await page.getByPlaceholder("搜索发票/供应商/PO/GRN").fill("佛山标准件");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出当前结果" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^supplier-invoices-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const path = await download.path();
  const workbook = XLSX.read(await readFile(path!), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as Record<string, unknown>[];
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.供应商 === "佛山标准件")).toBe(true);
});
