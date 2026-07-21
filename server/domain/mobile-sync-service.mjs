import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { assertAuthorized } from "../auth/authorization-service.mjs";
import { capabilityRegistryForEnvironment } from "./capability-registry.mjs";
import { getMobileSyncEntityPolicy, loadAuthorizedSyncProjection, mobileSyncEntityPolicy } from "./mobile-sync-entity-policy.mjs";
import { resolveProvisionedActor } from "./pilot-identity.mjs";

export class MobileSyncError extends Error {
  constructor(code, message, status = 400, details) { super(message); this.name = "MobileSyncError"; this.code = code; this.status = status; this.details = details; }
}
const fail = (code, message, status = 400, details) => { throw new MobileSyncError(code, message, status, details); };
const text = (value) => String(value ?? "").trim();
const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;
const stableHash = (value) => sha256(JSON.stringify(stable(value)));
const serial = (value) => value?.toISOString?.() || value || null;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

function cursorKeyring(env) {
  const currentId = text(env.FLOWCHAIN_SYNC_CURSOR_CURRENT_KEY_ID) || (text(env.FLOWCHAIN_SYNC_CURSOR_SECRET) ? "legacy" : "");
  const currentSecret = text(env.FLOWCHAIN_SYNC_CURSOR_CURRENT_SECRET) || text(env.FLOWCHAIN_SYNC_CURSOR_SECRET);
  if (!currentId || !currentSecret) {
    if (text(env.NODE_ENV).toLowerCase() === "production") fail("SYNC_CURSOR_KEY_REQUIRED", "A current sync cursor key is required in production.", 503);
    return { currentId: "local", keys: new Map([["local", "flowchain-local-sync-cursor-secret-not-for-production"]]) };
  }
  if (currentSecret.length < 32) fail("SYNC_CURSOR_KEY_WEAK", "The current sync cursor key must be at least 32 characters.", 503);
  const keys = new Map([[currentId, currentSecret]]);
  const previous = text(env.FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS);
  if (previous) {
    try {
      const parsed = JSON.parse(previous);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) for (const [keyId, secret] of Object.entries(parsed)) if (text(secret).length >= 32) keys.set(text(keyId), text(secret));
    } catch { fail("SYNC_CURSOR_KEY_CONFIG_INVALID", "FLOWCHAIN_SYNC_CURSOR_PREVIOUS_KEYS must be a JSON object.", 503); }
  }
  return { currentId, keys };
}

function issueCursor(claims, env) {
  const keyring = cursorKeyring(env);
  const payload = encode({ ...claims, v: 1, keyId: keyring.currentId });
  const signature = createHmac("sha256", keyring.keys.get(keyring.currentId)).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyCursor(cursor, env, now = Date.now()) {
  const [payload, signature, extra] = text(cursor).split(".");
  if (!payload || !signature || extra) fail("SYNC_CURSOR_INVALID", "The sync cursor is invalid.", 400);
  let claims;
  try { claims = decode(payload); } catch { fail("SYNC_CURSOR_INVALID", "The sync cursor payload is invalid.", 400); }
  if (claims.v !== 1) fail("SYNC_CURSOR_VERSION_UNSUPPORTED", "The sync cursor version is unsupported.", 400);
  const keyId = text(claims.keyId);
  const secret = cursorKeyring(env).keys.get(keyId);
  if (!secret) fail("SYNC_CURSOR_KEY_UNKNOWN", "The sync cursor key is no longer accepted.", 400);
  const expected = createHmac("sha256", secret).update(payload).digest();
  let received;
  try { received = Buffer.from(signature, "base64url"); } catch { fail("SYNC_CURSOR_INVALID", "The sync cursor signature is invalid.", 400); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) fail("SYNC_CURSOR_TAMPERED", "The sync cursor signature is invalid.", 400);
  if (!Number.isFinite(Number(claims.issuedAt)) || !Number.isFinite(Number(claims.expiresAt))) fail("SYNC_CURSOR_INVALID", "The sync cursor lifetime is invalid.", 400);
  if (Number(claims.expiresAt) <= now) fail("SYNC_CURSOR_EXPIRED", "The sync cursor has expired.", 409);
  return claims;
}

const capabilityFor = (id, env) => capabilityRegistryForEnvironment(env).find((entry) => entry.id === id);
const fieldVisibility = (actor) => ({ finance_amounts: { visible: actor.permissionCodes.has("finance.amounts.read") }, finance_partner_snapshot: { visible: actor.permissionCodes.has("finance.partner_snapshot.read") }, procurement_prices: { visible: actor.permissionCodes.has("procurement.prices.read") } });

export function createMobileSyncService({ prisma, env = process.env, idFactory = randomUUID, now = () => new Date(), cursorTtlSeconds = 900 } = {}) {
  if (!prisma) throw new Error("prisma is required");
  const actorFor = async (context) => { const actor = await resolveProvisionedActor(prisma, context?.identity || context); assertAuthorized({ actor, permission: "mobile.sync.use", tenantId: actor.tenantId }); return actor; };
  const expiresAt = () => new Date(now().getTime() + Number(cursorTtlSeconds) * 1000);

  async function authorizationFingerprint(actor) {
    const tenant = await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { operationalSettings: true, version: true } });
    const permissions = [...actor.permissionCodes].sort();
    return stableHash({ tenantId: actor.tenantId, userId: actor.user.id, roleIds: [...actor.roleIds].sort(), permissions, readWarehouseIds: [...(actor.readWarehouseIds || [])].sort(), operateWarehouseIds: [...(actor.operateWarehouseIds || [])].sort(), fieldVisibilityGroups: { finance_amounts: permissions.includes("finance.amounts.read"), finance_partner_snapshot: permissions.includes("finance.partner_snapshot.read"), procurement_prices: permissions.includes("procurement.prices.read") }, enabledModules: tenant?.operationalSettings?.modules || tenant?.operationalSettings?.moduleSettings || [], tenantVersion: tenant?.version || 0, capabilities: capabilityRegistryForEnvironment(env).map(({ id, enabled, maturity, readReady, writeReady }) => ({ id, enabled, maturity, readReady, writeReady })) });
  }

  async function register(input, context) {
    const actor = await actorFor(context), rawDeviceId = text(input.deviceId), platform = text(input.platform).toLowerCase() || "other";
    if (!rawDeviceId) fail("SYNC_DEVICE_ID_REQUIRED", "A device identifier is required.", 422);
    if (!["web", "pwa", "ios", "android", "other"].includes(platform)) fail("SYNC_PLATFORM_INVALID", "The client platform is invalid.", 422);
    const deviceIdHash = sha256(rawDeviceId), fingerprint = await authorizationFingerprint(actor);
    const existing = await prisma.syncClient.findUnique({ where: { tenantId_userId_deviceIdHash: { tenantId: actor.tenantId, userId: actor.user.id, deviceIdHash } } });
    if (existing?.status === "revoked") fail("SYNC_CLIENT_REVOKED", "This sync client is revoked.", 403);
    const client = existing ? await prisma.syncClient.update({ where: { id: existing.id }, data: { platform, appVersion: text(input.appVersion) || null, deviceName: text(input.deviceName) || null, authorizationFingerprint: fingerprint, lastSeenAt: now() } }) : await prisma.syncClient.create({ data: { id: idFactory(), tenantId: actor.tenantId, userId: actor.user.id, deviceIdHash, platform, appVersion: text(input.appVersion) || null, deviceName: text(input.deviceName) || null, authorizationFingerprint: fingerprint, lastSeenAt: now() } });
    return { clientId: client.id, platform: client.platform, status: client.status, deviceIdHash: client.deviceIdHash, authorizationFingerprint: fingerprint, registeredAt: serial(now()) };
  }

  async function resolveClient(input, context) {
    const actor = await actorFor(context), clientId = text(input.clientId), client = await prisma.syncClient.findFirst({ where: { id: clientId, tenantId: actor.tenantId, userId: actor.user.id } });
    if (!client) fail("SYNC_CLIENT_NOT_FOUND", "The sync client was not found.", 404);
    if (client.status !== "active") fail("SYNC_CLIENT_REVOKED", "This sync client is revoked.", 403);
    if (!text(input.deviceId)) fail("SYNC_DEVICE_ID_REQUIRED", "A device identifier is required.", 422);
    if (sha256(input.deviceId) !== client.deviceIdHash) fail("SYNC_DEVICE_MISMATCH", "The sync client does not belong to this device.", 403);
    const fingerprint = await authorizationFingerprint(actor);
    return { actor, client, fingerprint };
  }

  async function maxSequence(tenantId) {
    const result = await prisma.domainChangeFeed.aggregate({ where: { tenantId }, _max: { sequence: true } });
    return BigInt(result._max.sequence || 0);
  }

  function normalClaims(client, fingerprint, lastSequence, snapshotSessionId = null) {
    const issued = now().getTime();
    return { issuedAt: issued, expiresAt: issued + Number(cursorTtlSeconds) * 1000, tenantId: client.tenantId, userId: client.userId, clientId: client.id, deviceIdHash: client.deviceIdHash, lastSequence: String(lastSequence), authorizationFingerprint: fingerprint, snapshotSessionId };
  }

  async function snapshotRows(session, actor, tenant) {
    const entityTypes = Object.keys(mobileSyncEntityPolicy);
    let state = { typeIndex: 0, rowOffset: 0 };
    if (session.entityTypeCursor) {
      try {
        const parsed = JSON.parse(session.entityTypeCursor);
        state = typeof parsed === "number" ? { typeIndex: parsed, rowOffset: 0 } : { typeIndex: Number(parsed.typeIndex || 0), rowOffset: Number(parsed.rowOffset || 0) };
      } catch { state = { typeIndex: Number(session.entityTypeCursor) || 0, rowOffset: 0 }; }
    }
    const cursor = Math.max(0, state.typeIndex), rowOffset = Math.max(0, state.rowOffset);
    const pageSize = Math.min(200, Math.max(1, Number(session.pageSize || 100)));
    const type = entityTypes[cursor];
    if (!type) return { changes: [], nextCursor: cursor, hasMore: false };
    const policy = getMobileSyncEntityPolicy(type);
    const model = prisma[policy.model];
    if (!model) {
      const nextCursor = { typeIndex: cursor + 1, rowOffset: 0 };
      return { changes: [], nextCursor, hasMore: nextCursor.typeIndex < entityTypes.length };
    }
    const where = policy.parent ? { [policy.parent]: { tenantId: actor.tenantId } } : { tenantId: actor.tenantId };
    const rows = await model.findMany({ where, ...(policy.include ? { include: policy.include } : {}), orderBy: { id: "asc" }, skip: rowOffset, take: pageSize + 1 });
    const pageRows = rows.slice(0, pageSize);
    const changes = [];
    for (const row of pageRows) {
      const projection = await loadAuthorizedSyncProjection({ prisma, tenant, actor, entityType: type, entityId: row.id, operation: "upsert", env });
      if (projection) changes.push({ sequence: "0", entityType: type, entityId: row.id, operation: "upsert", entityVersion: row.version ?? null, changedAt: serial(row.updatedAt || row.createdAt), projection, fieldVisibility: fieldVisibility(actor), limitations: [] });
    }
    const hasMoreRows = rows.length > pageSize;
    const nextState = hasMoreRows ? { typeIndex: cursor, rowOffset: rowOffset + pageSize } : { typeIndex: cursor + 1, rowOffset: 0 };
    const hasMore = hasMoreRows || nextState.typeIndex < entityTypes.length;
    if (!changes.length && hasMore) return snapshotRows({ ...session, entityTypeCursor: JSON.stringify(nextState) }, actor, tenant);
    return { changes, nextCursor: nextState, hasMore };
  }

  async function initial(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context);
    const tenant = await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { id: true, operationalSettings: true } });
    if (client.authorizationFingerprint !== fingerprint) await prisma.syncClient.update({ where: { id: client.id }, data: { authorizationFingerprint: fingerprint, lastSeenAt: now() } });
    let session;
    if (input.snapshotCursor) {
      const claims = verifyCursor(input.snapshotCursor, env, now().getTime());
      if (claims.snapshotSessionId !== text(input.snapshotSessionId)) fail("SYNC_SNAPSHOT_SCOPE_MISMATCH", "The snapshot cursor does not match the requested snapshot.", 403);
      session = await prisma.syncSnapshotSession.findFirst({ where: { id: text(input.snapshotSessionId), tenantId: actor.tenantId, userId: actor.user.id, syncClientId: client.id } });
      if (!session || session.status !== "active" || session.expiresAt <= now()) fail("SYNC_SNAPSHOT_EXPIRED", "The initial sync snapshot has expired.", 409);
      if (session.authorizationFingerprint !== fingerprint) { await prisma.syncSnapshotSession.update({ where: { id: session.id }, data: { status: "invalidated" } }); return { code: "SYNC_AUTHORIZATION_CHANGED", resetRequired: true, changes: [], cursor: null, snapshotCursor: null, serverTime: serial(now()) }; }
    } else {
      const highWatermark = await maxSequence(actor.tenantId);
      const requestedPageSize = Math.min(200, Math.max(1, Number(input.pageSize || input.limit || 100)));
      session = await prisma.syncSnapshotSession.create({ data: { id: idFactory(), tenantId: actor.tenantId, userId: actor.user.id, syncClientId: client.id, authorizationFingerprint: fingerprint, highWatermarkSequence: highWatermark, status: "active", entityTypeCursor: "0", pageSize: requestedPageSize, expiresAt: new Date(now().getTime() + Number(cursorTtlSeconds) * 1000) } });
    }
    let page = await snapshotRows(session, actor, tenant);
    if (!input.snapshotCursor && input.limit && !input.pageSize) {
      const legacyLimit = Number(session.pageSize);
      const legacyChanges = [...page.changes];
      while (page.hasMore && legacyChanges.length < legacyLimit) {
        page = await snapshotRows({ ...session, entityTypeCursor: JSON.stringify(page.nextCursor), pageSize: legacyLimit - legacyChanges.length }, actor, tenant);
        legacyChanges.push(...page.changes);
      }
      page = { ...page, changes: legacyChanges };
    }
    const nextCursorIndex = JSON.stringify(page.nextCursor);
    if (page.hasMore) {
      const updated = await prisma.syncSnapshotSession.update({ where: { id: session.id }, data: { entityTypeCursor: nextCursorIndex } });
      const snapshotCursor = issueCursor(normalClaims(client, fingerprint, session.highWatermarkSequence, updated.id), env);
      return { resetRequired: false, authorizationFingerprint: fingerprint, changes: page.changes, snapshotSessionId: updated.id, snapshotCursor, hasMore: true, nextEntityType: Object.keys(mobileSyncEntityPolicy)[page.nextCursor.typeIndex], pageSize: Number(session.pageSize), highWatermark: String(session.highWatermarkSequence), serverTime: serial(now()) };
    }
    const completed = await prisma.syncSnapshotSession.update({ where: { id: session.id }, data: { status: "completed", entityTypeCursor: nextCursorIndex, completedAt: now() } });
    const cursor = issueCursor(normalClaims(client, fingerprint, completed.highWatermarkSequence, null), env);
    return { resetRequired: false, authorizationFingerprint: fingerprint, changes: page.changes, snapshotSessionId: completed.id, snapshotCursor: null, hasMore: false, nextEntityType: null, pageSize: Number(session.pageSize), highWatermark: String(completed.highWatermarkSequence), cursor, serverTime: serial(now()) };
  }

  async function pageChanges(actor, afterSequence, limit) {
    const rows = await prisma.domainChangeFeed.findMany({ where: { tenantId: actor.tenantId, sequence: { gt: BigInt(afterSequence) } }, orderBy: { sequence: "asc" }, take: Math.min(200, Math.max(1, Number(limit || 100))) });
    const tenant = await prisma.tenant.findUnique({ where: { id: actor.tenantId }, select: { id: true, operationalSettings: true } });
    const changes = [];
    for (const row of rows) {
      const projection = await loadAuthorizedSyncProjection({ prisma, tenant, actor, entityType: row.entityType, entityId: row.entityId, operation: row.operation, env });
      if (!projection) continue;
      changes.push({ sequence: String(row.sequence), entityType: row.entityType, entityId: row.entityId, operation: row.operation, entityVersion: row.entityVersion, changedAt: serial(row.changedAt), projection, fieldVisibility: fieldVisibility(actor), limitations: [] });
    }
    return { scannedThroughSequence: String(rows.at(-1)?.sequence ?? afterSequence), changes };
  }

  async function assertSequenceCeiling(tenantId, sequence) {
    const max = await maxSequence(tenantId);
    if (BigInt(sequence) > max) fail("SYNC_CURSOR_SEQUENCE_INVALID", "The cursor sequence exceeds the server high-watermark.", 409, { highWatermark: String(max) });
  }

  async function changes(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context), claims = verifyCursor(input.cursor, env, now().getTime());
    if (claims.tenantId !== actor.tenantId || claims.userId !== actor.user.id) fail("SYNC_CURSOR_SCOPE_MISMATCH", "The cursor scope does not match this user.", 403);
    if (claims.clientId !== client.id || claims.deviceIdHash !== client.deviceIdHash) fail("SYNC_CURSOR_DEVICE_MISMATCH", "The cursor belongs to another device.", 403);
    await assertSequenceCeiling(actor.tenantId, claims.lastSequence || 0);
    if (claims.authorizationFingerprint !== fingerprint || client.authorizationFingerprint !== fingerprint) {
      await prisma.syncSnapshotSession.updateMany({ where: { tenantId: actor.tenantId, userId: actor.user.id, syncClientId: client.id, status: "active" }, data: { status: "invalidated" } });
      return { code: "SYNC_AUTHORIZATION_CHANGED", resetRequired: true, authorizationFingerprint: fingerprint, cursor: null, changes: [], serverTime: serial(now()) };
    }
    const page = await pageChanges(actor, BigInt(claims.lastSequence || 0), input.limit);
    const cursor = issueCursor(normalClaims(client, fingerprint, page.scannedThroughSequence, null), env);
    await prisma.syncClient.update({ where: { id: client.id }, data: { lastSeenAt: now() } });
    return { resetRequired: false, authorizationFingerprint: fingerprint, changes: page.changes, cursor, serverTime: serial(now()) };
  }

  async function acknowledge(input, context) {
    const { actor, client, fingerprint } = await resolveClient(input, context), claims = verifyCursor(input.cursor, env, now().getTime());
    if (claims.tenantId !== actor.tenantId || claims.userId !== actor.user.id || claims.clientId !== client.id || claims.deviceIdHash !== client.deviceIdHash) fail("SYNC_CURSOR_SCOPE_MISMATCH", "The cursor scope does not match this client.", 403);
    if (claims.authorizationFingerprint !== fingerprint) fail("SYNC_AUTHORIZATION_CHANGED", "Authorization changed; initial sync is required.", 409, { resetRequired: true });
    const sequence = BigInt(claims.lastSequence || 0);
    await assertSequenceCeiling(actor.tenantId, sequence);
    if (sequence < BigInt(client.lastAcknowledgedSequence || 0)) fail("SYNC_ACKNOWLEDGEMENT_REGRESSION", "Acknowledgement sequence cannot move backwards.", 409, { currentSequence: String(client.lastAcknowledgedSequence) });
    await prisma.syncClient.update({ where: { id: client.id }, data: { lastAcknowledgedSequence: sequence, lastSeenAt: now() } });
    return { acknowledgedSequence: String(sequence), serverTime: serial(now()) };
  }

  async function revoke(clientId, input, context) {
    const { actor, client } = await resolveClient({ clientId, deviceId: input?.deviceId }, context);
    await prisma.$transaction([prisma.syncClient.update({ where: { id: client.id }, data: { status: "revoked", revokedAt: now(), lastSeenAt: now() } }), prisma.syncSnapshotSession.updateMany({ where: { tenantId: actor.tenantId, syncClientId: client.id, status: "active" }, data: { status: "invalidated" } }), prisma.domainChangeFeed.create({ data: { tenantId: actor.tenantId, entityType: "SyncClient", entityId: client.id, operation: "access_epoch", actorId: actor.user.id, source: "mobile_sync", requestId: client.id, payloadHash: stableHash({ clientId: client.id, status: "revoked" }), sensitivityGroups: [], moduleKey: "mobile", authorizationClass: "mobile.sync.use", resourceTenantId: actor.tenantId } })]);
    return { clientId: client.id, status: "revoked", revokedAt: serial(now()) };
  }

  return { register, initial, changes, acknowledge, revoke, authorizationFingerprint, issueCursor: (claims) => { const issuedAt = Number(claims.issuedAt ?? now().getTime()); return issueCursor({ ...claims, issuedAt, expiresAt: Number(claims.expiresAt ?? issuedAt + Number(cursorTtlSeconds) * 1000), snapshotSessionId: claims.snapshotSessionId ?? null }, env); }, verifyCursor: (cursor) => verifyCursor(cursor, env, now().getTime()) };
}

export { issueCursor, verifyCursor };
