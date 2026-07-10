import { expect, test } from "@playwright/test";
test("authorized rollback reverses imported record and retains audit event", async ({ request }) => {
  const id = `PR-ROLLBACK-${Date.now()}`;
  const preview = await request.post("/api/imports/preview", { data: { businessObject: "purchase-request", schemaVersion: "1", fileMetadata: { name: "rollback.xlsx" }, sheetName: "导入数据", rows: [{ pr: id, sourceSku: "SKU-00412", quantity: 10, unit: "台", requiredDate: "2026-07-25", priority: "中", status: "草稿" }], validationErrors: [], validationWarnings: [] } });
  const snapshot = await preview.json();
  const commit = await request.post(`/api/imports/${snapshot.previewId}/commit`, { data: { businessObject: "purchase-request", snapshotHash: snapshot.snapshotHash, idempotencyKey: `RB-${id}`, userConfirmation: true, acceptedWarningCodes: [] } });
  const committed = await commit.json();
  const rollback = await request.post(`/api/import-batches/${committed.importBatchId}/rollback`, { headers: { "X-FlowChain-Role": "admin" }, data: { reason: "browser rollback test" } });
  expect(rollback.ok()).toBeTruthy(); expect((await rollback.json()).status).toBe("rolled_back");
  const list = await request.get("/api/purchase-requests"); expect((await list.json()).some((row: { pr: string }) => row.pr === id)).toBe(false);
  const audit = await request.get("/api/audit-log"); expect((await audit.json()).some((row: { action: string; entity?: { id: string } }) => row.action === "import_batch_rolled_back" && row.entity?.id === committed.importBatchId)).toBe(true);
});
