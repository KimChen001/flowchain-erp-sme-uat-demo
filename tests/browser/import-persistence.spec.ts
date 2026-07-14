import { expect, test } from "@playwright/test";
const user = { id: "import-manager", company: "新辰智能制造", name: "张磊", email: "import@example.com", role: "供应链经理" };
test.beforeEach(async ({ page, request }) => {
  const login = await request.post("/api/auth/login", { data: user });
  expect(login.status()).toBe(200);
  const session = await login.json();
  await page.addInitScript(({ token, profile }) => {
    localStorage.setItem("flowchain:auth-token", token);
    localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, { token: session.token, profile: session.user });
});
test("customer workbook commits and survives page refresh", async ({ page }) => {
  await page.goto("/app/master-data/customers");
  const id = `CUS-BROWSER-${Date.now()}`;
  const csv = `客户编号,客户名称,联系人,邮箱,币种,状态\n${id},浏览器导入客户,测试联系人,browser-import@example.com,CNY,启用`;
  await page.getByTestId("excel-import-file-input").setInputFiles({ name: "customer-master.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByTestId("excel-import-preview")).toBeVisible();
  await page.getByRole("button", { name: /生成后端预览/ }).click();
  await expect(page.getByTestId("server-import-preview")).toBeVisible();
  await page.getByRole("button", { name: /确认正式导入/ }).click();
  await expect(page.getByTestId("import-task-result")).toContainText("导入批次");
  await page.reload();
  await expect(page.getByText(id, { exact: true })).toBeVisible();
});
