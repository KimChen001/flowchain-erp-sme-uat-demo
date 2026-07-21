import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { assertAuthorized } from "../auth/authorization-service.mjs";
import { capabilityRegistryForEnvironment } from "./capability-registry.mjs";
import { resolveProvisionedActor } from "./pilot-identity.mjs";

export class MobileSyncError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "MobileSyncError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const fail = (code, message, status = 400, details) => { throw new MobileSyncError(code, message, status, details); };
const text = (value) => String(value ?? "").trim();
const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableHash = (value) => sha256(JSON.stringify(stable(value)));
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const serial = (value) => value?.toISOString?.() || value || null;

function secretFor(env) {
  const secret = text(env.FLOWCHAIN_SYNC_CURSOR_SECRET);
  if (secret) return secret;
  if (text(env.NODE_ENV).toLowerCase() === "production") fail("SYNC_CURSOR_SECRET_REQUIRED", "FLOWCHAIN_SYNC_CURSOR_SECRET is required in production.", 503);
  return "flowchain-local-sync-cursor-secret-not-for-production";
}

function issueCursor(claims, env) {
  const payload = encode(claims);
  const signature = createHmac("sha256", secretFor(env)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyCursor(cursor, env) {
  const [payload, signature, extra] = text(cursor).split(".");
  if (!payload || !signature || extra) fail("SYNC_CURSOR_INVALID", "The sync cursor is invalid.", 400);
  const expected = createHmac("sha256", secretFor(env)).update(payload).digest();
  let received;
  try { received = Buffer.from(signature, "base64url"); } catch { fail("SYNC_CURSOR_INVALID", "The sync cursor is invalid.", 400); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) fail("SYNC_CURSOR_TAMPERED", "The sync cursor signature is invalid.", 400);
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (claims.v !== 1) fail("SYNC_CURSOR_VERSION_UNSUPPORTED", "The sync cursor version is unsupported.", 400);
    return claims;
  } catch (error) {
    if (error instanceof MobileSyncError) throw error;
    fail("SYNC_CURSOR_INVALID", "The sync cursor payload is invalid.", 400);
  }
}

export function createMobileSyncService({ prisma, env = process.env, idFactory = randomUUID, now = () => new Date() } = {}) {
  if (!prisma) throw new Error("prisma is required");
  const actorFor = async (context) => {
    const actor = await resolveProvisionedActor(prisma, context?.identity || context);
    assertAuthorized({ actor, permission: "mobile.sync.use", tenantId: actor.tenantId });
    return actor;
  };

  async function authorizationFingerprint(actor) {
    const tenant = await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { operationalSettings: true, version: true } });
    const capabilities = capabilityRegistryForEnvironment(env).map(({ id, enabled, maturity, readReady, writeReady }) => ({ id, enabled, maturity, readReady, writeReady }));
    const permissions = [...actor.permissionCodes].sort();
    return stableHash({
      tenantId: actor.tenantId,
      userId: actor.user.id,
      roleIds: [...actor.roleIds].sort(),
      permissions,
      readWarehouseIds: [...(actor.readWarehouseIds || [])].sort(),
      operateWarehouseIds: [...(actor.operateWarehouseIds || [])].sort(),
      fieldVisibilityGroups: {
        finance_amounts: permissions.includes("finance.amounts.read"),
        finance_partner_snapshot: permissions.includes("finance.partner_snapshot.read"),
        procurement_prices: permissions.includes("procurement.prices.read"),
      },
      enabledModules: tenant?.operationalSettings?.modules || tenant?.operationalSettings?.moduleSettings || [],
      tenantVersion: tenant?.version || 0,
      capabilities,
    });
  }

  async function register(input, context) {
    const actor = await actorFor(context);
    const rawDeviceId = text(input.deviceId);
    const platform = text(input.platform).toLowerCase() || "other";
    if (!rawDeviceId) fail("SYNC_DEVICE_ID_REQUIRED", "A device identifier is required.", 422);
    if (!new Set(["web", "pwa", "ios", "android", "other"]).has(platform)) fail("SYNC_PLATFORM_INVALID", "The client platform is invalid.", 422);
    const deviceIdHash = sha256(rawDeviceId);
    const fingerprint = await authorizationFingerprint(actor);
    const existing = await prisma.syncClient.findUnique({ where: { tenantId_userId_deviceIdHash: { tenantId: actor.tenantId, userId: actor.user.id, deviceIdHash } } });
    if (existing?.status === "revoked") fail("SYNC_CLIENT_REVOKED", "This sync client is revoked.", 403);
    const client = existing
      ? await prisma.syncClient.update({ where: { id: existing.id }, data: { platform, appVersion: text(input.appVersion) || null, deviceName: text(input.deviceName) || null, authorizationFingerprint: fingerprint, lastSeenAt: now() } })
      : await prisma.syncClient.create({ data: { id: idFactory(), tenantId: actor.tenantId, userId: actor.user.id, deviceIdHash, platform, appVersion: text(input.appVersion) || null, deviceName: text(input.deviceName) || null, authorizationFingerprint: fingerprint, lastSeenAt: now() } });
    return { clientId: client.id, platform: client.platform, status: client.status, deviceIdHash: client.deviceIdHash, authorizationFingerprint: fingerprint, registeredAt: serial(now()) };
  }

  async function resolveClient(input, context) {
    const actor = await actorFor(context);
    const clientId = text(input.clientId);
    const client = await prisma.syncClient.findFirst({ where: { id: clientId, tenantId: actor.tenantId, userId: actor.user.id } });
    if (!client) fail("SYNC_CLIENT_NOT_FOUND", "The sync client was not found.", 404);
    if (client.status !== "active") fail("SYNC_CLIENT_REVOKED", "This sync client is revoked.", 403);
    const rawDeviceId = text(input.deviceId);
    if (!rawDeviceId) fail("SYNC_DEVICE_ID_REQUIRED", "A device identifier is required.", 422);
    if (sha256(rawDeviceId) !== client.deviceIdHash) fail("SYNC_DEVICE_MISMATCH", "The sync client does not belong to this device.", 403);
    const fingerprint = await authorizationFingerprint(actor);
    return { actor, client, fingerprint };
  }

  const cursorClaims = (client, fingerprint, lastSequence) => ({ v: 1, tenantId: client.tenantId, userId: client.userId, clientId: client.id, deviceIdHash: client.deviceIdHash, lastSequence: String(lastSequence), authorizationFingerprint: fingerprint });

  async function pageChanges(client, actor, afterSequence, limit) {
    const rows = await prisma.domainChangeFeed.findMany({ where: { tenantId: actor.tenantId, sequence: { gt: BigInt(afterSequence) } }, orderBy: { sequence: "asc" }, take: Math.min(200, Math.max(1, Number(limit || 100))) });
    const permissionForGroup = { finance_amounts: "finance.amounts.read", finance_partner_snapshot: "finance.partner_snapshot.read", procurement_prices: "procurement.prices.read" };
    const visible = rows.filter((row) => row.sensitivityGroups.every((group) => !permissionForGroup[group] || actor.permissionCodes.has(permissionForGroup[group])));
    return {
      scannedThroughSequence: String(rows.at(-1)?.sequence ?? afterSequence),
      changes: visible.map((row) => ({ sequence: String(row.sequence), entityType: row.entityType, entityId: row.entityId, operation: row.operation, entityVersion: row.entityVersion, changedAt: serial(row.changedAt), source: row.source, payloadHash: row.payloadHash, sensitivityGroups: row.sensitivityGroups })),
    };
  }

  async function initial(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context);
    if (client.authorizationFingerprint !== fingerprint) await prisma.syncClient.update({ where: { id: client.id }, data: { authorizationFingerprint: fingerprint, lastSeenAt: now() } });
    const page = await pageChanges(client, actor, 0n, input.limit);
    const changes = page.changes;
    const lastSequence = page.scannedThroughSequence;
    return { resetRequired: false, authorizationFingerprint: fingerprint, changes, cursor: issueCursor(cursorClaims(client, fingerprint, lastSequence), env), serverTime: serial(now()) };
  }

  async function changes(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context);
    const claims = verifyCursor(input.cursor, env);
    if (claims.tenantId !== actor.tenantId) fail("SYNC_CURSOR_TENANT_MISMATCH", "The cursor belongs to another tenant.", 403);
    if (claims.userId !== actor.user.id) fail("SYNC_CURSOR_USER_MISMATCH", "The cursor belongs to another user.", 403);
    if (claims.clientId !== client.id || claims.deviceIdHash !== client.deviceIdHash) fail("SYNC_CURSOR_DEVICE_MISMATCH", "The cursor belongs to another device.", 403);
    if (claims.authorizationFingerprint !== fingerprint || client.authorizationFingerprint !== fingerprint) {
      return { code: "SYNC_AUTHORIZATION_CHANGED", resetRequired: true, authorizationFingerprint: fingerprint, cursor: null, changes: [], serverTime: serial(now()) };
    }
    const page = await pageChanges(client, actor, BigInt(claims.lastSequence || 0), input.limit);
    const rows = page.changes;
    const lastSequence = page.scannedThroughSequence;
    await prisma.syncClient.update({ where: { id: client.id }, data: { lastSeenAt: now() } });
    return { resetRequired: false, authorizationFingerprint: fingerprint, changes: rows, cursor: issueCursor(cursorClaims(client, fingerprint, lastSequence), env), serverTime: serial(now()) };
  }

  async function acknowledge(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context);
    const claims = verifyCursor(input.cursor, env);
    if (claims.tenantId !== actor.tenantId || claims.userId !== actor.user.id || claims.clientId !== client.id || claims.deviceIdHash !== client.deviceIdHash) fail("SYNC_CURSOR_SCOPE_MISMATCH", "The cursor scope does not match this client.", 403);
    if (claims.authorizationFingerprint !== fingerprint) fail("SYNC_AUTHORIZATION_CHANGED", "Authorization changed; initial sync is required.", 409, { resetRequired: true });
    const sequence = BigInt(claims.lastSequence || 0);
    await prisma.syncClient.update({ where: { id: client.id }, data: { lastAcknowledgedSequence: sequence, lastSeenAt: now() } });
    return { acknowledgedSequence: String(sequence), serverTime: serial(now()) };
  }

  async function revoke(clientId, input, context) {
    const { actor, client } = await resolveClient({ clientId, deviceId: input?.deviceId }, context);
    await prisma.$transaction([
      prisma.syncClient.update({ where: { id: client.id }, data: { status: "revoked", revokedAt: now(), lastSeenAt: now() } }),
      prisma.domainChangeFeed.create({ data: { tenantId: actor.tenantId, entityType: "SyncClient", entityId: client.id, operation: "access_epoch", actorId: actor.user.id, source: "mobile_sync", requestId: client.id, payloadHash: stableHash({ clientId: client.id, status: "revoked" }), sensitivityGroups: [] } }),
    ]);
    return { clientId: client.id, status: "revoked", revokedAt: serial(now()) };
  }

  return { register, initial, changes, acknowledge, revoke, authorizationFingerprint, issueCursor, verifyCursor };
}
