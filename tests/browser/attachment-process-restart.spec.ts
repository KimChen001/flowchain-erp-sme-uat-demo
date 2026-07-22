import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const statePath = process.env.ATTACHMENT_RESTART_STATE_PATH!;
const bytes = Buffer.from("FlowChain browser attachment process restart evidence\n", "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");

async function login(request: any) {
  const response = await request.post("/api/auth/login", { data: { email: "attachment-browser-admin@example.invalid", name: "Ignored", company: "Ignored" } });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  return body;
}

test("API process A receives and binds browser attachment evidence", async ({ request }) => {
  const authenticated = await login(request);
  const stagedResponse = await request.post("/api/uploads/stage", { headers: { Authorization: `Bearer ${authenticated.token}` }, data: { fileName: "browser-restart-proof.txt", mimeType: "text/plain", contentBase64: bytes.toString("base64"), sha256 } });
  const staged = await stagedResponse.json();
  expect(stagedResponse.ok(), JSON.stringify(staged)).toBeTruthy();
  const bindResponse = await request.post("/api/receiving/drafts/attachment-browser-receiving/attachments", { headers: { Authorization: `Bearer ${authenticated.token}` }, data: { uploadId: staged.uploadId, sourceDeviceId: "attachment-browser-device-a" } });
  const bound = await bindResponse.json();
  expect(bindResponse.ok(), JSON.stringify(bound)).toBeTruthy();
  const firstDownload = await request.get(`/api/attachments/${bound.attachmentId}/download`, { headers: { Authorization: `Bearer ${authenticated.token}` } });
  expect(Buffer.from(await firstDownload.body())).toEqual(bytes);
  expect(firstDownload.headers()["x-content-sha256"]).toBe(sha256);
  await writeFile(statePath, JSON.stringify({ attachmentId: bound.attachmentId, uploadId: staged.uploadId, fileName: "browser-restart-proof.txt", mimeType: "text/plain", sha256, sizeBytes: bytes.length }));
});

test("Chromium downloads the same attachment after API process B starts", async ({ page, request }) => {
  const expected = JSON.parse(await readFile(statePath, "utf8"));
  const authenticated = await login(request);
  const inspected = await request.get(`/api/attachments/${expected.attachmentId}/download`, { headers: { Authorization: `Bearer ${authenticated.token}` } });
  expect(inspected.ok()).toBeTruthy();
  expect(inspected.headers()["x-content-sha256"]).toBe(expected.sha256);
  expect(inspected.headers()["content-type"]).toContain(expected.mimeType);
  await page.context().setExtraHTTPHeaders({ Authorization: `Bearer ${authenticated.token}` });
  await page.goto("/api/health");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.evaluate((url) => { const link = document.createElement("a"); link.href = url; document.body.appendChild(link); link.click(); }, `/api/attachments/${expected.attachmentId}/download`),
  ]);
  expect(download.suggestedFilename()).toBe(expected.fileName);
  expect(Buffer.from(await readFile(await download.path()))).toEqual(bytes);
  expect(createHash("sha256").update(await readFile(await download.path())).digest("hex")).toBe(expected.sha256);
});
