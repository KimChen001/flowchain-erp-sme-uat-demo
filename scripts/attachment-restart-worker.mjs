import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { backfillTenantAuthorization } from "../server/auth/authorization-backfill.mjs";
import { createAttachmentService } from "../server/domain/attachment-service.mjs";
import { createPrismaClient } from "../server/persistence/prisma-client.mjs";

const [mode, resultPath] = process.argv.slice(2);
if (!new Set(["write", "read"]).has(mode) || !resultPath) throw new Error("Usage: attachment-restart-worker.mjs <write|read> <result-path>");
const tenantId = "tenant-phase-5-2c1-attachment-restart";
const userId = "phase-5-2c1-attachment-admin";
const context = { identity: { authenticated: true, tenantId, userId, role: "admin" } };
const bytes = Buffer.from("FlowChain Phase 5.2C.1 durable restart evidence\n", "utf8");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const prisma = await createPrismaClient(process.env);
try {
  const attachments = createAttachmentService({ prisma, env: process.env });
  if (mode === "write") {
    await prisma.tenant.create({ data: { id: tenantId, name: "Phase 5.2C.1 Attachment Restart" } });
    await prisma.user.create({ data: { id: userId, tenantId, email: "attachment-admin@phase-5-2c1.invalid", name: "Attachment Admin", role: "admin" } });
    await prisma.warehouse.create({ data: { id: "attachment-warehouse", tenantId, code: "ATT-WH", name: "Attachment Warehouse" } });
    await backfillTenantAuthorization(prisma, tenantId, { actorId: userId });
    await prisma.receivingDocument.create({ data: { id: "attachment-receiving", tenantId, documentNumber: "RCV-ATT", warehouseId: "attachment-warehouse" } });
    const staged = await attachments.stageUpload({ fileName: "restart-proof.txt", mimeType: "text/plain", contentBase64: bytes.toString("base64"), sha256 }, context);
    const bound = await attachments.bindReceiving("attachment-receiving", { uploadId: staged.uploadId, sourceDeviceId: "attachment-device-a" }, context);
    const downloaded = await attachments.download(bound.attachmentId, context);
    assert.deepEqual(downloaded.bytes, bytes);
    await writeFile(resultPath, JSON.stringify({ attachmentId: bound.attachmentId, uploadId: staged.uploadId, sha256, fileName: downloaded.fileName, mimeType: downloaded.mimeType }));
    console.log(JSON.stringify({ phase: "write", ...bound }));
  } else {
    const expected = JSON.parse(await readFile(resultPath, "utf8"));
    const downloaded = await attachments.download(expected.attachmentId, context);
    assert.deepEqual(downloaded.bytes, bytes);
    assert.equal(downloaded.sha256, expected.sha256);
    assert.equal(downloaded.fileName, expected.fileName);
    assert.equal(downloaded.mimeType, expected.mimeType);
    const row = await prisma.receivingAttachment.findUnique({ where: { id: expected.attachmentId }, include: { upload: true } });
    assert.equal(row.upload.storageProvider, "local");
    assert.equal(row.upload.storageHealthStatus, "healthy");
    assert.equal(await prisma.auditLog.count({ where: { tenantId, entityId: expected.attachmentId, action: "attachment_downloaded" } }), 2);
    console.log(JSON.stringify({ phase: "read", attachmentId: expected.attachmentId, sha256: downloaded.sha256, auditDownloads: 2 }));
  }
} finally {
  await prisma.$disconnect();
}
