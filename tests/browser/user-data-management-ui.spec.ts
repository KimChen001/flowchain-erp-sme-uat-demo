import { expect, test, type Page } from "@playwright/test";

const demoUser = {
  id: "browser-uat-user",
  company: "新辰智能制造",
  name: "张磊",
  email: "zhanglei@example.com",
  role: "供应链经理",
};

async function openLoggedInApp(page: Page) {
  await page.addInitScript((user) => {
    window.localStorage.setItem("scm-demo-token", "browser-uat-token");
    window.localStorage.setItem("scm-demo-user", JSON.stringify(user));
  }, demoUser);
  await page.goto("/");
  await expect(page.getByTestId("app-main")).toBeVisible();
}

test("R181-R190 Data Management user data import UI previews safely and handles disabled commit", async ({ page }) => {
  await openLoggedInApp(page);
  await page.getByRole("button", { name: /数据管理/ }).first().click();

  const panel = page.getByTestId("user-data-import-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("用户数据导入预览");
  await expect(panel).toContainText("dry-run 默认不写文件");

  await page.getByTestId("user-data-preview-button").click();
  await expect(page.getByTestId("user-data-preview-result")).toContainText("true");
  await expect(page.getByTestId("user-data-preview-result")).toContainText("Records");
  await expect(page.getByTestId("user-data-snapshot-hash")).toContainText(/[a-f0-9]{64}/);
  await expect(panel).toContainText("writesFiles: false");
  await expect(panel).toContainText("writesDb: false");
  await expect(panel).toContainText("overwritesDemoData: false");
  await expect(panel).toContainText("Review-first commit");
  await expect(panel).toContainText("AI remains read-only");
  await expect(page.getByTestId("user-data-active-status")).toContainText(/No active user dataset|no active/i);
  await expect(page.getByTestId("user-data-ai-provenance")).toContainText("No active user dataset found");

  await panel.getByLabel(/I reviewed dataset id/).check();
  await page.getByTestId("user-data-commit-button").click();
  await expect(page.getByTestId("user-data-commit-status")).toContainText(/Commit disabled|FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT/);
  await expect(page.getByTestId("user-data-commit-status")).toContainText("writesDb: false");

  await expect(page.getByTestId("user-data-deactivate-button")).toBeDisabled();
});
