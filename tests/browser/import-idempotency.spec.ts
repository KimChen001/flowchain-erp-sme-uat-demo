import { expect, test } from "@playwright/test";
test("same idempotency key returns original result without duplicate write", async ({ request }) => {
  const id = `PR-IDEM-${Date.now()}`;
  const preview = await request.post("/api/imports/preview", { data: { businessObject: "purchase-request", schemaVersion: "1", fileMetadata: { name: "idempotency.xlsx" }, sheetName: "导入数据", rows: [{ pr: id, sourceSku: "SKU-00412", quantity: 10, unit: "台", requiredDate: "2026-07-25", priority: "中", status: "草稿" }], validationErrors: [], validationWarnings: [] } });
  expect(preview.ok()).toBeTruthy(); const snapshot = await preview.json();
  const data = { businessObject: "purchase-request", snapshotHash: snapshot.snapshotHash, idempotencyKey: `IDEM-${id}`, userConfirmation: true, acceptedWarningCodes: [] };
  const first = await request.post(`/api/imports/${snapshot.previewId}/commit`, { data }); const second = await request.post(`/api/imports/${snapshot.previewId}/commit`, { data });
  const firstBody = await first.json(); const secondBody = await second.json();
  expect(secondBody.importBatchId).toBe(firstBody.importBatchId); expect(secondBody.replayed).toBe(true);
  const list = await request.get("/api/purchase-requests"); const rows = await list.json();
  expect(rows.filter((row: { pr: string }) => row.pr === id)).toHaveLength(1);
});
