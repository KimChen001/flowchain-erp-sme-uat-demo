import { expect, test, type Page } from "@playwright/test";

const user = { id: "type-user", company: "新辰智能制造", name: "张磊", email: "type@example.com", role: "供应链经理" };
test("primary module and page typography uses one computed semantic scale", async ({ page }) => {
  await page.addInitScript((profile) => {
    localStorage.setItem("flowchain:auth-token", "type-token");
    localStorage.setItem("flowchain:current-user", JSON.stringify(profile));
  }, user);
  for (const path of ["overview", "master-data", "procurement", "sales", "inventory", "finance", "reports", "settings"]) {
    await page.goto(`/app/${path}`);
    await expect(page.getByTestId("module-title")).toHaveCSS("font-size", "20px");
    await expect(page.getByTestId("module-title")).toHaveCSS("line-height", "28px");
  }
  await page.goto("/app/sales/deliveries");
  await expect(page.getByTestId("page-title")).toHaveCSS("font-size", "20px");
  await expect(page.getByTestId("page-header").locator(".fc-page-subtitle")).toHaveCSS("font-size", "12px");
  await expect(page.getByTestId("module-subnav").getByRole("link").first()).toHaveCSS("font-size", "13px");
  await expect(page.getByLabel("搜索发货单")).toHaveCSS("font-size", "13px");
  await expect(page.getByTestId("delivery-page").locator("tbody td").first()).toHaveCSS("font-size", "13px");
  await expect(page.getByRole("button", { name: "新建发货单" })).toHaveCSS("font-size", "13px");
});
