import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";

const text = (value) => String(value ?? "").trim();
const fail = (code, message, status = 503, details) => { throw Object.assign(new Error(message), { name: "AttachmentStorageError", code, status, details }); };

export function createLocalDurableAttachmentStorage({ env = process.env, rootDirectory, digest } = {}) {
  const production = text(env.NODE_ENV).toLowerCase() === "production";
  const provider = text(env.FLOWCHAIN_ATTACHMENT_STORAGE_PROVIDER).toLowerCase();
  if (production && provider !== "local") fail("ATTACHMENT_STORAGE_PROVIDER_REQUIRED", "Production attachment storage must explicitly select the local provider.");
  if (provider && provider !== "local") fail("ATTACHMENT_STORAGE_PROVIDER_UNSUPPORTED", "The configured attachment storage provider is not available.", 503);
  const configured = text(rootDirectory || env.FLOWCHAIN_UPLOAD_STORAGE_DIR);
  if (production && !configured) fail("ATTACHMENT_STORAGE_CONFIG_REQUIRED", "A durable attachment directory is required in production.");
  const root = resolve(configured || join(tmpdir(), "flowchain-test-attachments"));
  if (production && !isAbsolute(configured)) fail("ATTACHMENT_STORAGE_PATH_INVALID", "Production attachment storage must use an absolute path.");
  const tempRoot = resolve(tmpdir());
  if (production && (root === tempRoot || root.startsWith(`${tempRoot}${sep}`))) fail("ATTACHMENT_STORAGE_PATH_INVALID", "Production attachment storage cannot use an operating-system temporary directory.");
  const hash = digest || ((bytes) => bytes.toString("hex"));
  let ready = false;
  async function healthCheck() {
    await mkdir(root, { recursive: true });
    const probe = join(root, `.health-${randomUUID()}`);
    try { await writeFile(probe, "ok", { flag: "wx" }); await unlink(probe); ready = true; return { provider: "local", root, writable: true, durableConfigured: Boolean(configured), status: "healthy" }; } catch (error) { fail("ATTACHMENT_STORAGE_UNAVAILABLE", "Attachment storage is not writable.", 503, { root, cause: error.code || error.message }); }
  }
  async function ensureReady() { if (!ready) await healthCheck(); }
  function pathFor(storageKey) {
    const candidate = resolve(root, text(storageKey));
    const rootPrefix = root + "\\";
    if (candidate !== root && !candidate.startsWith(rootPrefix) && !candidate.startsWith(`${root}/`)) fail("ATTACHMENT_STORAGE_KEY_INVALID", "The attachment storage key escapes the configured directory.", 422);
    return candidate;
  }
  async function put(storageKey, bytes, expectedHash) {
    await ensureReady();
    const target = pathFor(storageKey), directory = resolve(target, "..");
    await mkdir(directory, { recursive: true });
    const temporary = `${target}.tmp-${randomUUID()}`;
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, target);
      const verified = await readFile(target);
      if (expectedHash && hash(verified) !== expectedHash) { await unlink(target).catch(() => {}); fail("ATTACHMENT_HASH_MISMATCH", "Attachment storage hash verification failed.", 409); }
      return { storageKey, sizeBytes: verified.length, sha256: expectedHash || hash(verified) };
    } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }
  async function get(storageKey) { await ensureReady(); return readFile(pathFor(storageKey)); }
  async function exists(storageKey) { try { await stat(pathFor(storageKey)); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; } }
  async function remove(storageKey) { await unlink(pathFor(storageKey)).catch((error) => { if (error.code !== "ENOENT") throw error; }); }
  async function verifyHash(storageKey, expectedHash) { const bytes = await get(storageKey); return hash(bytes) === expectedHash; }
  async function listFiles() {
    await ensureReady();
    const result = [];
    for (const tenant of await readdir(root, { withFileTypes: true })) {
      if (!tenant.isDirectory()) continue;
      for (const file of await readdir(join(root, tenant.name), { withFileTypes: true })) if (file.isFile() && !file.name.includes(".tmp-")) result.push({ storageKey: `${tenant.name}/${file.name}`, path: join(root, tenant.name, file.name) });
    }
    return result;
  }
  return { provider: "local", root, healthCheck, put, get, exists, delete: remove, verifyHash, listFiles, relativePath: (storageKey) => relative(root, pathFor(storageKey)) };
}

export function createTestTempAttachmentStorage(options = {}) {
  return createLocalDurableAttachmentStorage({ ...options, env: { NODE_ENV: "test", ...options.env } });
}
