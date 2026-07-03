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
  await expect(page.getByTestId("user-data-preview-result")).toContainText("是");
  await expect(page.getByTestId("user-data-preview-result")).toContainText("记录数");
  await expect(page.getByTestId("user-data-snapshot-hash")).toContainText(/[a-f0-9]{64}/);
  await expect(panel).toContainText("写文件：否");
  await expect(panel).toContainText("写数据库：否");
  await expect(panel).toContainText("覆盖演示数据：否");
  await expect(panel).toContainText("复核后提交");
  await expect(panel).toContainText("智能助手保持只读");
  await expect(page.getByTestId("user-data-active-status")).toContainText(/未找到当前用户数据集|暂无当前用户数据集/);
  await expect(page.getByTestId("user-data-ai-provenance")).toContainText("未找到当前用户数据集");

  await panel.getByLabel(/我已复核数据集 ID/).check();
  await page.getByTestId("user-data-commit-button").click();
  await expect(page.getByTestId("user-data-commit-status")).toContainText(/提交已关闭|FLOWCHAIN_ENABLE_USER_IMPORT_COMMIT/);
  await expect(page.getByTestId("user-data-commit-status")).toContainText("写数据库：否");

  await expect(page.getByTestId("user-data-deactivate-button")).toBeDisabled();
});
