import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

async function login(request: any) {
  const response = await request.post("/api/auth/login", { data: { email: "admin@example.com", name: "Ignored", company: "Ignored" } });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

async function api(request: any, token: string, method: "get" | "post", path: string, data?: any) {
  const response = await request[method](path, { headers: { Authorization: `Bearer ${token}` }, ...(data === undefined ? {} : { data }) });
  const body = await response.json();
  expect(response.ok(), `${method.toUpperCase()} ${path}: ${response.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

test("bank statement workbench imports immutable evidence and exposes reconciliation controls", async ({ page, request }) => {
  const authenticated = await login(request);
  await api(request, authenticated.token, "post", "/api/finance/cashbook/accounts", {
    accountCode: "BANK-BROWSER-CNY", name: "Browser Fictitious Bank", accountType: "bank", currency: "CNY", openingBalance: "1000.0000", idempotencyKey: "browser-bank-account",
  });
  const accounts = await api(request, authenticated.token, "get", "/api/finance/cashbook/accounts");
  const account = accounts.items.find((item: any) => item.accountCode === "BANK-BROWSER-CNY");
  expect(account).toBeTruthy();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem("flowchain:auth-token", token);
    localStorage.setItem("flowchain:current-user", JSON.stringify(user));
  }, authenticated);
  await page.goto("/app/finance/bank-statements");
  await expect(page.getByTestId("bank-reconciliation-workbench")).toBeVisible();
  await page.getByTestId("bank-account").selectOption(account.id);
  await page.getByTestId("create-bank-mapping").click();
  await expect(page.getByRole("status")).toContainText(/Mapping/);
  await expect(page.getByTestId("bank-mapping").locator("option")).toHaveCount(2);
  await page.getByTestId("bank-file").setInputFiles({
    name: "browser-bank-statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("transaction_id,transaction_date,posting_date,value_date,signed_amount,currency,counterparty_name,counterparty_account,description,bank_reference,customer_reference,running_balance,bank_account_identifier\nTX-BROWSER-001,2026-07-21,2026-07-21,2026-07-21,125.5000,CNY,Fictitious Customer,6222000012345678,Receipt,REF-BROWSER-001,CUST-BROWSER-001,1125.5000,BANK-BROWSER-CNY\n"),
  });
  await page.getByTestId("upload-bank-statement").click();
  await expect(page.getByRole("status")).toContainText(/校验|Validated/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("commit-bank-statement").click();
  await expect(page.getByRole("status")).toContainText(/已导入|imported/);

  const batchList = await api(request, authenticated.token, "get", "/api/finance/bank-statements/batches");
  expect(batchList.items[0].workflowStatus).toBe("committed");
  expect(batchList.items[0].importedLineCount).toBe(1);
  const lineList = await api(request, authenticated.token, "get", "/api/finance/bank-statements/lines");
  expect(lineList.items[0].remainingAmount).toBe("125.5000");
  expect(lineList.items[0].counterpartyAccountHash).toBeUndefined();

  await page.goto("/app/finance/bank-reconciliation");
  await expect(page.getByText(/未匹配银行流水|Unmatched bank lines/)).toBeVisible();
  await page.getByTestId("generate-bank-candidates").click();
  await expect(page.getByText(/Imported statement evidence only|导入的银行流水/)).toBeVisible();
  await expect(page.getByTestId("bank-reconciliation-workbench")).not.toHaveCSS("overflow-x", "visible");
});
