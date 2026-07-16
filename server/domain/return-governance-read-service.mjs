import {
  assertWarehouseAccess,
  resolveProvisionedActor,
} from "./pilot-identity.mjs";
import {
  buildReturnAuthorizationPlan,
  buildReturnRequestPlan,
  returnGovernanceFixed as fixed,
  returnGovernanceUnits as units,
} from "./return-governance-policy.mjs";

export class ReturnGovernanceReadError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = "ReturnGovernanceReadError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const fail = (code, message, status = 400, details) => {
  throw new ReturnGovernanceReadError(code, message, status, details);
};
const text = (value) => String(value ?? "").trim();
const iso = (value) => (value ? new Date(value).toISOString() : null);
const requestRoles = new Set([
  "admin",
  "manager",
  "business-specialist",
  "business_specialist",
  "buyer",
]);
const managerRoles = new Set(["admin", "manager"]);

function page(query = {}) {
  const number = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const size = Math.min(
    100,
    Math.max(1, Number.parseInt(query.pageSize, 10) || 20),
  );
  return { page: number, pageSize: size, skip: (number - 1) * size };
}

function warehouseIds(lines = []) {
  return [
    ...new Set(
      lines.flatMap((line) =>
        Array.isArray(line.sourceWarehouseIds)
          ? line.sourceWarehouseIds.map(text).filter(Boolean)
          : [],
      ),
    ),
  ].sort();
}

function canRead(actor, ids) {
  return (
    actor.allWarehouses ||
    ids.every((id) => actor.readWarehouseIds?.has(id))
  );
}

function canRequest(actor, returnType) {
  return (
    requestRoles.has(actor.role) &&
    (actor.role !== "buyer" || returnType === "supplier_return")
  );
}

function requestModel(request) {
  return {
    id: request.id,
    requestNumber: request.requestNumber,
    returnType: request.returnType,
    workflowStatus: request.workflowStatus,
    partnerId: request.partnerId,
    partnerNameSnapshot: request.partnerNameSnapshot,
    contextDocumentType: request.contextDocumentType,
    contextDocumentId: request.contextDocumentId,
    sourceDocumentType: request.sourceDocumentType,
    sourceDocumentId: request.sourceDocumentId,
    sourceDocumentNumber: request.sourceDocumentNumber,
    reasonCode: request.reasonCode,
    reasonDetail: request.reasonDetail,
    requestedAt: iso(request.requestedAt),
    submittedAt: iso(request.submittedAt),
    rejectedAt: iso(request.rejectedAt),
    rejectionReason: request.rejectionReason,
    cancelledAt: iso(request.cancelledAt),
    cancellationReason: request.cancellationReason,
    version: request.version,
    createdAt: iso(request.createdAt),
    updatedAt: iso(request.updatedAt),
  };
}

function lineModel(line) {
  return {
    id: line.id,
    sourceDocumentType: line.sourceDocumentType,
    sourceDocumentId: line.sourceDocumentId,
    sourceDocumentLineId: line.sourceDocumentLineId,
    sourceQuantity: fixed(units(line.sourceQuantity || 0)),
    sourceWarehouseIds: Array.isArray(line.sourceWarehouseIds)
      ? line.sourceWarehouseIds
      : [],
    itemId: line.itemId,
    sku: line.sku,
    itemName: line.itemName,
    requestedQuantity: fixed(units(line.requestedQuantity)),
    unit: line.unit,
    reasonCode: line.reasonCode,
    conditionCode: line.conditionCode,
    version: line.version,
  };
}

function authorizationModel(authorization) {
  return {
    id: authorization.id,
    authorizationNumber: authorization.authorizationNumber,
    returnRequestId: authorization.returnRequestId,
    workflowStatus: authorization.workflowStatus,
    authorizedAt: iso(authorization.authorizedAt),
    rejectedAt: iso(authorization.rejectedAt),
    rejectionReason: authorization.rejectionReason,
    cancelledAt: iso(authorization.cancelledAt),
    cancellationReason: authorization.cancellationReason,
    expiresAt: iso(authorization.expiresAt),
    expiredAt: iso(authorization.expiredAt),
    version: authorization.version,
    createdAt: iso(authorization.createdAt),
    updatedAt: iso(authorization.updatedAt),
    lines: (authorization.lines || []).map((line) => ({
      id: line.id,
      returnRequestLineId: line.returnRequestLineId,
      authorizedQuantity: fixed(units(line.authorizedQuantity)),
      dispositionRoute: line.dispositionRoute,
      version: line.version,
    })),
  };
}

function actionModel(actor, request, capabilities) {
  const requestEnabled = capabilities["return-request"]?.enabled === true;
  const authorizationEnabled =
    capabilities["return-authorization"]?.enabled === true;
  const requestAllowed = canRequest(actor, request.returnType);
  const manager = managerRoles.has(actor.role);
  const activeAuthorization = request.authorizations?.some((row) =>
    ["draft", "approved", "partially_executed"].includes(row.workflowStatus),
  );
  return {
    revise:
      requestEnabled &&
      requestAllowed &&
      request.workflowStatus === "draft",
    submit:
      requestEnabled &&
      requestAllowed &&
      request.workflowStatus === "draft",
    cancel:
      requestEnabled &&
      requestAllowed &&
      ["draft", "submitted"].includes(request.workflowStatus) &&
      !activeAuthorization,
    authorize:
      authorizationEnabled &&
      manager &&
      request.workflowStatus === "submitted" &&
      !activeAuthorization,
    reject:
      authorizationEnabled &&
      manager &&
      request.workflowStatus === "submitted" &&
      !activeAuthorization,
    blockingReasonCodes: [
      ...(!requestEnabled
        ? ["RETURN_REQUEST_CAPABILITY_NOT_AVAILABLE"]
        : []),
      ...(!authorizationEnabled
        ? ["RETURN_AUTHORIZATION_CAPABILITY_NOT_AVAILABLE"]
        : []),
      ...(!requestAllowed ? ["PERMISSION_DENIED"] : []),
    ],
  };
}

function authorizationActions(actor, authorization, capabilities, now) {
  const enabled = capabilities["return-authorization"]?.enabled === true;
  const manager = managerRoles.has(actor.role);
  const unexecuted = ["draft", "approved"].includes(
    authorization.workflowStatus,
  );
  return {
    cancel: enabled && manager && unexecuted && !authorization.postings.length,
    expire:
      enabled &&
      manager &&
      unexecuted &&
      !authorization.postings.length &&
      Boolean(authorization.expiresAt && authorization.expiresAt <= now),
    blockingReasonCodes: [
      ...(!enabled ? ["RETURN_AUTHORIZATION_CAPABILITY_NOT_AVAILABLE"] : []),
      ...(!manager ? ["PERMISSION_DENIED"] : []),
    ],
  };
}

async function evidence(prisma, actor, entityType, entityIds) {
  const rows = await prisma.auditLog.findMany({
    where: {
      tenantId: actor.tenantId,
      entityType,
      entityId: { in: entityIds },
    },
    include: { actor: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    summary: row.summary,
    actor: row.actor
      ? { id: row.actor.id, name: row.actor.name, role: row.actor.role }
      : null,
    occurredAt: iso(row.createdAt),
    commandType: row.metadata?.commandType || row.action,
    idempotencyKey: row.metadata?.idempotencyKey || null,
    before: row.metadata?.before ?? null,
    after: row.metadata?.after ?? null,
  }));
}

function requestInput(request) {
  return {
    requestNumber: request.requestNumber,
    returnType: request.returnType,
    contextDocumentType:
      request.contextDocumentType || request.sourceDocumentType,
    contextDocumentId: request.contextDocumentId || request.sourceDocumentId,
    reasonCode: request.reasonCode,
    reasonDetail: request.reasonDetail,
    lines: request.lines.map((line) => ({
      sourceDocumentLineId: line.sourceDocumentLineId,
      requestedQuantity: String(line.requestedQuantity),
      reasonCode: line.reasonCode,
      conditionCode: line.conditionCode,
    })),
  };
}

function preview(plan) {
  return {
    operation: plan.operation,
    allowed: plan.allowed,
    blockingIssues: plan.blockingIssues,
    warnings: plan.warnings,
    inventoryMutation: false,
    request: plan.request
      ? {
          ...plan.request,
          warehouseIds: plan.request.warehouseIds,
        }
      : null,
    lines: plan.lines || plan.authorization?.lines || [],
    authorization: plan.authorization
      ? {
          authorizationNumber: plan.authorization.authorizationNumber,
          expiresAt: iso(plan.authorization.expiresAt),
        }
      : null,
    factsToCreate: plan.factsToCreate,
  };
}

export function createReturnGovernanceReadService({
  prisma,
  capabilities = {},
  now = () => new Date(),
} = {}) {
  if (!prisma) throw new Error("prisma is required");

  async function actor(context) {
    return resolveProvisionedActor(prisma, context?.identity || context);
  }

  async function previewRequest(input, context, currentRequestId) {
    const resolved = await actor(context);
    if (!canRequest(resolved, text(input.returnType)))
      fail(
        "PERMISSION_DENIED",
        "The authenticated role cannot create this return request type.",
        403,
      );
    const plan = await buildReturnRequestPlan({
      prisma,
      tenantId: resolved.tenantId,
      input,
      currentRequestId,
    });
    if (plan.request)
      assertWarehouseAccess(resolved, plan.request.warehouseIds, "read");
    return preview(plan);
  }

  async function previewSubmit(requestId, context) {
    const resolved = await actor(context);
    const request = await prisma.returnRequest.findFirst({
      where: { id: text(requestId), tenantId: resolved.tenantId },
      include: { lines: true },
    });
    if (!request)
      fail("RETURN_REQUEST_NOT_FOUND", "Return request was not found.", 404);
    if (!canRequest(resolved, request.returnType))
      fail("PERMISSION_DENIED", "Return request access is denied.", 403);
    assertWarehouseAccess(resolved, warehouseIds(request.lines), "read", {
      maskExistence: true,
    });
    const plan = await buildReturnRequestPlan({
      prisma,
      tenantId: resolved.tenantId,
      input: requestInput(request),
      currentRequestId: request.id,
    });
    return {
      ...preview(plan),
      operation: "submit_return_request",
      allowed: request.workflowStatus === "draft" && plan.allowed,
      blockingIssues:
        request.workflowStatus === "draft"
          ? plan.blockingIssues
          : [
              {
                code: "RETURN_REQUEST_NOT_DRAFT",
                message: "Only a draft return request can be submitted.",
                status: 409,
              },
              ...plan.blockingIssues,
            ],
    };
  }

  async function previewCancel(requestId, input, context) {
    const resolved = await actor(context);
    const request = await prisma.returnRequest.findFirst({
      where: { id: text(requestId), tenantId: resolved.tenantId },
      include: { lines: true, authorizations: true },
    });
    if (!request)
      fail("RETURN_REQUEST_NOT_FOUND", "Return request was not found.", 404);
    assertWarehouseAccess(resolved, warehouseIds(request.lines), "read", {
      maskExistence: true,
    });
    const blockingIssues = [];
    if (!canRequest(resolved, request.returnType))
      blockingIssues.push({
        code: "PERMISSION_DENIED",
        message: "Return request access is denied.",
        status: 403,
      });
    if (!["draft", "submitted"].includes(request.workflowStatus))
      blockingIssues.push({
        code: "RETURN_REQUEST_CANNOT_CANCEL",
        message: "Only a draft or submitted request can be cancelled.",
        status: 409,
      });
    if (!text(input?.reason))
      blockingIssues.push({
        code: "RETURN_REASON_REQUIRED",
        message: "A cancellation reason is required.",
        status: 422,
      });
    if (
      request.authorizations.some((row) =>
        ["draft", "approved", "partially_executed"].includes(
          row.workflowStatus,
        ),
      )
    )
      blockingIssues.push({
        code: "RETURN_AUTHORIZATION_ALREADY_ACTIVE",
        message: "An active authorization prevents request cancellation.",
        status: 409,
      });
    return {
      operation: "cancel_return_request",
      allowed: blockingIssues.length === 0,
      blockingIssues,
      inventoryMutation: false,
      request: requestModel(request),
      factsToCreate: { auditEvents: 1, inventoryMovements: 0 },
    };
  }

  async function previewAuthorization(requestId, input, context) {
    const resolved = await actor(context);
    if (!managerRoles.has(resolved.role))
      fail(
        "PERMISSION_DENIED",
        "Only an Admin or Manager can authorize returns.",
        403,
      );
    const plan = await buildReturnAuthorizationPlan({
      prisma,
      tenantId: resolved.tenantId,
      requestId,
      input,
    });
    if (plan.request)
      assertWarehouseAccess(
        resolved,
        warehouseIds(plan.request.lines),
        "read",
        { maskExistence: true },
      );
    return preview(plan);
  }

  async function listRequests(query, context) {
    const resolved = await actor(context);
    const paging = page(query);
    const where = {
      tenantId: resolved.tenantId,
      ...(text(query.returnType) ? { returnType: text(query.returnType) } : {}),
      ...(text(query.workflowStatus)
        ? { workflowStatus: text(query.workflowStatus) }
        : {}),
      ...(text(query.sourceDocumentId)
        ? { sourceDocumentId: text(query.sourceDocumentId) }
        : {}),
    };
    const candidates = await prisma.returnRequest.findMany({
      where,
      include: { lines: true, authorizations: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    const search = text(query.q).toLowerCase();
    const visible = candidates.filter(
      (row) =>
        canRead(resolved, warehouseIds(row.lines)) &&
        (!search ||
          [
            row.requestNumber,
            row.partnerNameSnapshot,
            row.sourceDocumentNumber,
            ...row.lines.flatMap((line) => [line.sku, line.itemName]),
          ]
            .filter(Boolean)
            .some((value) => text(value).toLowerCase().includes(search))),
    );
    return {
      dataSource: "Authoritative PostgreSQL",
      page: paging.page,
      pageSize: paging.pageSize,
      total: visible.length,
      capabilities,
      requests: visible
        .slice(paging.skip, paging.skip + paging.pageSize)
        .map((row) => ({
          ...requestModel(row),
          lineCount: row.lines.length,
          authorizationStatuses: row.authorizations.map(
            (authorization) => authorization.workflowStatus,
          ),
          warehouseIds: warehouseIds(row.lines),
        })),
    };
  }

  async function requestWorkbench(requestId, context) {
    const resolved = await actor(context);
    const request = await prisma.returnRequest.findFirst({
      where: { id: text(requestId), tenantId: resolved.tenantId },
      include: {
        lines: { orderBy: { id: "asc" } },
        authorizations: {
          include: { lines: { orderBy: { id: "asc" } } },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!request)
      fail("RETURN_REQUEST_NOT_FOUND", "Return request was not found.", 404);
    assertWarehouseAccess(resolved, warehouseIds(request.lines), "read", {
      maskExistence: true,
    });
    const authorizationIds = request.authorizations.map((row) => row.id);
    const [requestEvidence, authorizationEvidence] = await Promise.all([
      evidence(prisma, resolved, "ReturnRequest", [request.id]),
      authorizationIds.length
        ? evidence(
            prisma,
            resolved,
            "ReturnAuthorization",
            authorizationIds,
          )
        : [],
    ]);
    return {
      dataSource: "Authoritative PostgreSQL",
      request: requestModel(request),
      lines: request.lines.map(lineModel),
      authorizations: request.authorizations.map(authorizationModel),
      availableActions: actionModel(resolved, request, capabilities),
      evidence: [...requestEvidence, ...authorizationEvidence].sort((a, b) =>
        String(a.occurredAt).localeCompare(String(b.occurredAt)),
      ),
      capabilities,
      inventoryMutation: false,
      limitations: [
        "Phase 4B.1 governs requests and authorizations only. It does not post or reverse inventory.",
      ],
    };
  }

  async function authorizationWorkbench(authorizationId, context) {
    const resolved = await actor(context);
    const authorization = await prisma.returnAuthorization.findFirst({
      where: { id: text(authorizationId), tenantId: resolved.tenantId },
      include: {
        lines: { orderBy: { id: "asc" } },
        postings: true,
        returnRequest: {
          include: { lines: { orderBy: { id: "asc" } } },
        },
      },
    });
    if (!authorization)
      fail(
        "RETURN_AUTHORIZATION_NOT_FOUND",
        "Return authorization was not found.",
        404,
      );
    assertWarehouseAccess(
      resolved,
      warehouseIds(authorization.returnRequest.lines),
      "read",
      { maskExistence: true },
    );
    return {
      dataSource: "Authoritative PostgreSQL",
      authorization: authorizationModel(authorization),
      request: requestModel(authorization.returnRequest),
      requestLines: authorization.returnRequest.lines.map(lineModel),
      availableActions: authorizationActions(
        resolved,
        authorization,
        capabilities,
        now(),
      ),
      evidence: await evidence(
        prisma,
        resolved,
        "ReturnAuthorization",
        [authorization.id],
      ),
      capabilities,
      inventoryMutation: false,
      limitations: [
        "Phase 4B.1 authorization does not execute a physical return.",
      ],
    };
  }

  return {
    previewRequest,
    previewSubmit,
    previewCancel,
    previewAuthorization,
    listRequests,
    requestWorkbench,
    authorizationWorkbench,
  };
}
