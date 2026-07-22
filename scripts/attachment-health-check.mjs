import { createLocalDurableAttachmentStorage } from "../server/domain/attachment-storage-provider.mjs";

const storage = createLocalDurableAttachmentStorage({ env: process.env });
try {
  const report = await storage.healthCheck();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "healthy" || report.writable !== true) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || "ATTACHMENT_STORAGE_HEALTH_CHECK_FAILED", message: error.message, details: error.details || null }, null, 2));
  process.exitCode = 2;
}
