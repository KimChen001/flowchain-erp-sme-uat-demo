import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createPrismaClient } from "../../server/persistence/prisma-client.mjs";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const worker = join(root, "scripts", "attachment-restart-worker.mjs");
const health = join(root, "scripts", "attachment-health-check.mjs");
const orphan = join(root, "scripts", "attachment-orphan-check.mjs");

async function command(args, options = {}) {
  return run(process.execPath, args, { cwd: root, env: process.env, maxBuffer: 5 * 1024 * 1024, ...options });
}

test("attachment bytes, metadata, hashes, and audits survive a real Node process restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flowchain-attachment-restart-result-"));
  const resultPath = join(directory, "result.json");
  try {
    const first = await command([worker, "write", resultPath]);
    assert.match(first.stdout, /"phase":"write"/);
    const durableResult = JSON.parse(await readFile(resultPath, "utf8"));
    assert.equal(durableResult.fileName, "restart-proof.txt");
    const second = await command([worker, "read", resultPath]);
    assert.match(second.stdout, /"phase":"read"/);
    assert.match(second.stdout, new RegExp(durableResult.sha256));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("attachment diagnostics report health and classify anomalies with strict exit behavior", async () => {
  const healthy = await command([health]);
  const healthReport = JSON.parse(healthy.stdout);
  assert.equal(healthReport.status, "healthy");
  assert.equal(healthReport.writable, true);

  const pristine = await command([orphan, "--strict"]);
  assert.equal(JSON.parse(pristine.stdout).ok, true);

  const prisma = await createPrismaClient(process.env);
  let missingPath;
  let orphanPath;
  try {
    const upload = await prisma.stagedUpload.findFirst({ where: { tenantId: "tenant-phase-5-2c1-attachment-restart" } });
    missingPath = join(process.env.FLOWCHAIN_UPLOAD_STORAGE_DIR, ...upload.storageKey.split("/"));
    await unlink(missingPath);
    orphanPath = join(process.env.FLOWCHAIN_UPLOAD_STORAGE_DIR, "controlled-orphan", "orphan.bin");
    await mkdir(dirname(orphanPath), { recursive: true });
    await writeFile(orphanPath, "controlled orphan");
    const anomalyDirectory = join(process.env.FLOWCHAIN_UPLOAD_STORAGE_DIR, "tenant-phase-5-2c1-attachment-restart");
    const mismatchedBytes = Buffer.from("actual bytes do not match the database hash");
    const expiredBytes = Buffer.from("expired staged upload bytes");
    await writeFile(join(anomalyDirectory, "controlled-hash-mismatch"), mismatchedBytes);
    await writeFile(join(anomalyDirectory, "controlled-expired"), expiredBytes);
    await prisma.stagedUpload.createMany({ data: [
      { id: "controlled-hash-mismatch", tenantId: "tenant-phase-5-2c1-attachment-restart", fileName: "hash.txt", mimeType: "text/plain", sizeBytes: mismatchedBytes.length, sha256: "0".repeat(64), storageKey: "tenant-phase-5-2c1-attachment-restart/controlled-hash-mismatch", status: "bound", createdById: "phase-5-2c1-attachment-admin", expiresAt: new Date("2099-01-01T00:00:00.000Z") },
      { id: "controlled-expired", tenantId: "tenant-phase-5-2c1-attachment-restart", fileName: "expired.txt", mimeType: "text/plain", sizeBytes: expiredBytes.length, sha256: createHash("sha256").update(expiredBytes).digest("hex"), storageKey: "tenant-phase-5-2c1-attachment-restart/controlled-expired", status: "staged", createdById: "phase-5-2c1-attachment-admin", expiresAt: new Date("2020-01-01T00:00:00.000Z") },
    ] });
  } finally {
    await prisma.$disconnect();
  }

  const reportOnly = await command([orphan]);
  const report = JSON.parse(reportOnly.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.missingFiles.length, 1);
  assert.deepEqual(report.orphanFiles, ["controlled-orphan/orphan.bin"]);
  assert.deepEqual(report.hashMismatches, ["tenant-phase-5-2c1-attachment-restart/controlled-hash-mismatch"]);
  assert.deepEqual(report.expiredStagedUploads, ["tenant-phase-5-2c1-attachment-restart/controlled-expired"]);
  await assert.rejects(() => command([orphan, "--strict"]), (error) => error.code === 2 && JSON.parse(error.stdout).ok === false);
});
