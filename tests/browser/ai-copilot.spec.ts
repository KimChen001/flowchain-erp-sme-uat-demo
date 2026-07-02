import { expect, test, type Locator, type Page } from "@playwright/test";

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
  await expect(page.getByText("每日工作台").first()).toBeVisible();
}

async function openAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
}

async function askAssistant(page: Page, prompt: string) {
  await page.getByTestId("ai-assistant-input").fill(prompt);
  await page.getByTestId("ai-assistant-send").click();
  await expect(page.getByTestId("ai-message-user").filter({ hasText: prompt })).toBeVisible();
  const assistant = page.getByTestId("ai-message-assistant").last();
  await expect(assistant).toBeVisible();
  await expect(assistant).not.toContainText("正在回复");
  return assistant;
}

async function expectCleanAssistantOutput(assistant: Locator) {
  await expect(assistant).not.toContainText(/provider fallback|tool_result|debug|documentType|entityType|response_card/i);
  await expect(assistant).not.toContainText(/\{\s*"/);
  await expect(assistant).not.toContainText(/"\s*:/);
}

async function expectRuntimeHotfixGate(assistant: Locator) {
  await expectCleanAssistantOutput(assistant);
  await expect(assistant).not.toContainText(/外部 AI Provider|未启用外部|provider_disabled|api key/i);
  await expect(assistant).not.toContainText(/打开采购单据并确认责任人与截止日期|复核库存覆盖与再订货点|确认待回复供应商、最佳报价和授标依据/);
  await expect(assistant).not.toContainText(/逾期\s*PO\s*[=:：]?\s*0/);
}

async function askTodayPriority(page: Page) {
  await openAssistant(page);
  const assistant = await askAssistant(page, "今天最需要处理什么？");
  await expect(assistant).toContainText("PO-2026-1282");
  await expect(assistant).toContainText("SKU-00412");
  await expect(assistant).toContainText("RFQ-26-0046");
  await expect(assistant).toContainText("依据");
  await expect(assistant).toContainText("建议操作");
  return assistant;
}

async function restoreAssistant(page: Page) {
  await page.getByTestId("ai-assistant-toggle").click();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
}

async function clickEvidence(page: Page, businessId: string) {
  const evidence = page.getByTestId("ai-evidence-link").filter({ hasText: businessId }).first();
  await expect(evidence).toBeVisible();
  await evidence.click();
}

async function openDraftPreview(page: Page, draftType: string) {
  const action = page.locator(`[data-testid="ai-action-draft-preview"][data-draft-type="${draftType}"]`).last();
  await expect(action).toBeVisible();
  await action.click();
  const shell = page.getByTestId("action-draft-review-shell");
  await expect(shell).toBeVisible();
  await expect(shell).toContainText("不会创建");
  await expect(shell).toContainText("不会提交");
  await expect(shell).toContainText("不会发送");
  await expect(shell).toContainText("人工");
  return shell;
}

async function closeDraftPreview(page: Page) {
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByTestId("action-draft-review-shell")).toBeHidden();
  if (await page.getByTestId("ai-assistant-toggle").isVisible().catch(() => false)) {
    await restoreAssistant(page);
  }
}

test.describe("AI Copilot browser UAT", () => {
  test("R134 empty AI panel shows prompt chips and 今日重点 returns overview", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    const chips = page.getByTestId("ai-empty-prompt-chip");
    await expect(chips.filter({ hasText: "今日重点" })).toBeVisible();
    await expect(chips.filter({ hasText: "库存风险" })).toBeVisible();
    await expect(chips.filter({ hasText: "供应商跟进" })).toBeVisible();
    await expect(page.getByTestId("ai-context-chip")).toContainText("每日工作台");

    await chips.filter({ hasText: "今日重点" }).click();
    const assistant = page.getByTestId("ai-message-assistant").last();
    await expect(assistant).toContainText("PO-2026-1282");
    await expect(assistant).toContainText("SKU-00412");
    await expect(assistant).not.toContainText(/provider fallback|tool_result|debug|documentType|entityType/i);
  });

  test("R135 placeholder changes after focusing a PO context", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    await clickEvidence(page, "PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await restoreAssistant(page);

    await expect(page.getByTestId("ai-context-chip")).toContainText("PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-input")).toHaveAttribute("placeholder", /这个 PO 为什么优先|未到货风险/);
  });

  test("R136 follow-up chip resolves to prior PO through session grounding", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    const chip = page.getByTestId("ai-follow-up-chip").filter({ hasText: "为什么这个 PO 优先？" }).first();
    await expect(chip).toBeVisible();
    await chip.click();

    const assistant = page.getByTestId("ai-message-assistant").last();
    await expect(assistant).toContainText("PO-2026-1282");
    await expect(assistant).toContainText(/未到货明细|供应商剩余交期|部分到货/);
    await expect(assistant).not.toContainText(/provider fallback|tool_result|debug|documentType|entityType/i);
  });

  test("R122 answers Today priority with product-readable evidence and actions", async ({ page }) => {
    await openLoggedInApp(page);
    const assistant = await askTodayPriority(page);
    await expectRuntimeHotfixGate(assistant);
    await expect(assistant).toContainText(/打开 PO-2026-1282|打开 PO/);
    await expect(assistant).toContainText(/查看 SKU-00412|查看 SKU/);
    await expect(assistant).toContainText(/打开 RFQ-26-0046|打开 RFQ/);

    for (const forbidden of [
      "action-FOLLOWUP",
      "inventory_item",
      "documentType",
      "entityType",
      "tool_result",
      "response_card",
    ]) {
      await expect(assistant).not.toContainText(forbidden);
    }
    await expect(assistant).not.toContainText(/\{\s*"/);
    await expect(assistant).not.toContainText(/"\s*:/);
  });

  test("R139 mirrors runtime hotfix gates for Today priority in browser", async ({ page }) => {
    await openLoggedInApp(page);
    const assistant = await askTodayPriority(page);

    await expectRuntimeHotfixGate(assistant);
    await expect(assistant).toContainText("PO-2026-1282");
    await expect(assistant).toContainText("SKU-00412");
    await expect(assistant).toContainText("RFQ-26-0046");
    await expect(assistant).toContainText(/打开 PO-2026-1282|打开 PO/);
    await expect(assistant).toContainText(/查看 SKU-00412|查看 SKU/);
    await expect(assistant).toContainText(/打开 RFQ-26-0046|打开 RFQ/);
  });

  test("R139 supplier overview prompts stay overview-routed in browser", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    for (const prompt of ["有什么供应商我需要注意的么？", "供应商这边，你有什么推荐？"]) {
      const assistant = await askAssistant(page, prompt);
      await expectRuntimeHotfixGate(assistant);
      await expect(assistant).toContainText(/供应商|跟进|风险/);
      await expect(assistant).not.toContainText(/供应商主数据中没有匹配记录|请提供供应商名称|请提供供应商 ID|输入供应商/);
    }
  });

  test("R139 data limitation prompts stay deterministic in browser", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    for (const prompt of ["什么数据会比较有限，我需要重点关注？", "AI 现在有哪些地方不确定？"]) {
      const assistant = await askAssistant(page, prompt);
      await expectRuntimeHotfixGate(assistant);
      await expect(assistant).not.toContainText(/供应商主数据中没有匹配记录|请提供供应商名称|请提供供应商 ID/);
      await expect(assistant).toContainText(/RFQ|回复|报价/);
      await expect(assistant).toContainText(/ETA|交期|未到货/);
      await expect(assistant).toContainText(/GRN|质检|收货/);
      await expect(assistant).toContainText(/库存|预测|需求/);
      await expect(assistant).toContainText(/发票|三单/);
    }
  });

  test("R139 broad attention prompt returns object-specific overview in browser", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    const assistant = await askAssistant(page, "有什么需要我注意的？");
    await expectRuntimeHotfixGate(assistant);
    await expect(assistant).toContainText("PO-2026-1282");
    await expect(assistant).toContainText("SKU-00412");
    await expect(assistant).toContainText("RFQ-26-0046");
    await expect(assistant).toContainText(/打开 PO-2026-1282|打开 PO/);
    await expect(assistant).toContainText(/查看 SKU-00412|查看 SKU/);
    await expect(assistant).toContainText(/打开 RFQ-26-0046|打开 RFQ/);
  });

  test("R123 minimize and restore preserve the AI answer", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    await page.getByTestId("app-main").click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("ai-assistant-toggle")).toBeVisible();

    await page.getByTestId("ai-assistant-toggle").click();
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("SKU-00412");

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();

    await page.getByTestId("ai-assistant-toggle").click();
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("建议操作");
  });

  test("R124 evidence navigation minimizes AI and focuses PO SKU and RFQ objects", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    await clickEvidence(page, "PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("focus-banner")).toContainText("PO-2026-1282");

    await restoreAssistant(page);
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("PO-2026-1282");

    await clickEvidence(page, "SKU-00412");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("focus-banner")).toContainText("SKU-00412");

    await restoreAssistant(page);
    await clickEvidence(page, "RFQ-26-0046");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("focus-banner")).toContainText("RFQ-26-0046");
  });

  test("R125 follow-up question uses session grounding for the prior PO", async ({ page }) => {
    await openLoggedInApp(page);
    await askTodayPriority(page);

    const assistant = await askAssistant(page, "这个 PO 为什么优先？");
    await expect(assistant).toContainText("PO-2026-1282");
    await expect(assistant).toContainText("部分到货");
    await expect(assistant).toContainText("5月25日");
    await expect(assistant).toContainText(/未到货明细|供应商剩余交期/);
    await expect(assistant).not.toContainText(/provider fallback|tool_result|debug|documentType|entityType/i);
  });

  test("R126 ambiguous PO follow-up asks for clarification when multiple PO candidates are visible", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);
    await askAssistant(page, "哪些 PO 需要跟进？");

    const poEvidenceCount = await page.getByTestId("ai-evidence-link").filter({ hasText: /PO-2026-/ }).count();
    test.skip(poEvidenceCount < 2, "Current browser fixture did not expose multiple PO evidence candidates; domain grounding ambiguity remains covered.");

    const assistant = await askAssistant(page, "这个 PO 为什么优先？");
    await expect(assistant).toContainText(/需要确认|还是|请.*PO/);
    await expect(assistant).not.toContainText("PO-2026-1282 被列为优先事项");
  });

  test("R127 SKU risk draft preview opens review shell without creating business records", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);
    const assistant = await askAssistant(page, "SKU-00412 为什么风险高？");

    await expect(assistant).toContainText("SKU-00412");
    await expect(assistant).toContainText(/预览.*补货 PR 草稿|补货 PR 草稿/);

    const shell = await openDraftPreview(page, "purchase_request_draft");
    await expect(shell).toContainText("SKU-00412");
    await expect(shell).toContainText("ActionDraft");
    await expect(page.getByRole("button", { name: "确认提交" })).toBeDisabled();

    await closeDraftPreview(page);
    await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
    await expect(page.getByTestId("ai-assistant-messages")).toContainText("SKU-00412");
  });

  test("R128 PO and RFQ follow-up draft previews stay review-first", async ({ page }) => {
    await openLoggedInApp(page);
    await openAssistant(page);

    await askAssistant(page, "解释 PO-2026-1282 为什么优先");
    let shell = await openDraftPreview(page, "po_followup_draft");
    await expect(shell).toContainText("PO-2026-1282");
    await expect(page.getByRole("button", { name: "确认提交" })).toBeDisabled();
    await closeDraftPreview(page);

    await askAssistant(page, "RFQ-26-0046 需要怎么跟进？");
    shell = await openDraftPreview(page, "supplier_followup_draft");
    await expect(shell).toContainText("RFQ-26-0046");
    await expect(shell).toContainText(/不会创建|不会发送/);
    await expect(page.getByRole("button", { name: "确认提交" })).toBeDisabled();
  });

  test("R129 full AI Copilot demo scenario stays evidence-backed and review-first", async ({ page }) => {
    await openLoggedInApp(page);
    let assistant = await askTodayPriority(page);
    await expectCleanAssistantOutput(assistant);

    await clickEvidence(page, "PO-2026-1282");
    await expect(page.getByTestId("ai-assistant-panel")).toBeHidden();
    await expect(page.getByTestId("focus-banner")).toContainText("PO-2026-1282");

    await restoreAssistant(page);
    assistant = await askAssistant(page, "这个 PO 和 SKU-00412 有什么关系？");
    for (const expected of ["PO-2026-1282", "SKU-00412"]) {
      await expect(assistant).toContainText(expected);
    }
    await expect(assistant).toContainText(/GRN-202605-0418|GRN-202605-0419|收货单/);
    await expect(assistant).toContainText(/PR-2026-2401|当前采购链路|采购申请/);
    await expectCleanAssistantOutput(assistant);

    assistant = await askAssistant(page, "逾期 PO 一般怎么处理？");
    await expect(assistant).toContainText(/SOP-PO-OVERDUE|PO-OVERDUE/);
    await expect(assistant).toContainText("内部处理建议");
    await expect(assistant).toContainText("逾期 PO 跟进");
    await expect(assistant).toContainText("不得自动");
    await expectCleanAssistantOutput(assistant);

    const shell = await openDraftPreview(page, "po_followup_draft");
    await expect(shell).toContainText("PO-2026-1282");
    await expect(shell).toContainText("ActionDraft");
    await expect(page.getByRole("button", { name: "确认提交" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible();
  });
});
