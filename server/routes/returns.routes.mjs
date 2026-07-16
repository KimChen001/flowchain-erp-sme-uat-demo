import { capabilityForEnvironment } from "../domain/capability-registry.mjs";
import {
  createReturnGovernanceCommandService,
  ReturnGovernanceError,
} from "../domain/return-governance-command-service.mjs";
import {
  createReturnGovernanceReadService,
  ReturnGovernanceReadError,
} from "../domain/return-governance-read-service.mjs";
import { PilotIdentityError } from "../domain/pilot-identity.mjs";
import { getPrismaClient } from "../persistence/prisma-client.mjs";

const query = (url) => Object.fromEntries(url.searchParams.entries());
const capabilityIds = ["return-request", "return-authorization"];
const capabilities = (env) =>
  Object.fromEntries(
    capabilityIds.map((id) => [id, capabilityForEnvironment(id, env)]),
  );

function unavailable(ctx, capabilityId) {
  ctx.send(ctx.res, 409, {
    code: "RETURN_GOVERNANCE_CAPABILITY_NOT_AVAILABLE",
    message:
      "Return governance requires database persistence and explicit enablement.",
    details: { capability: capabilityId },
  });
}

function knownError(ctx, error) {
  if (
    error instanceof ReturnGovernanceError ||
    error instanceof ReturnGovernanceReadError ||
    error instanceof PilotIdentityError
  ) {
    ctx.send(ctx.res, error.status || 400, {
      code: error.code || "RETURN_GOVERNANCE_FAILED",
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  ctx.send(ctx.res, 500, {
    code: "RETURN_GOVERNANCE_FAILED",
    message: "Return governance could not be completed.",
  });
}

function ensureDatabaseAndIdentity(ctx) {
  const env = ctx.env || process.env;
  if (String(env.FLOWCHAIN_PERSISTENCE_MODE || "").toLowerCase() !== "database") {
    unavailable(ctx, "return-request");
    return false;
  }
  if (!ctx.identity?.authenticated) {
    ctx.send(ctx.res, 401, {
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
    });
    return false;
  }
  return true;
}

function ensureCapability(ctx, id) {
  if (capabilityForEnvironment(id, ctx.env || process.env)?.enabled)
    return true;
  unavailable(ctx, id);
  return false;
}

async function services(ctx) {
  const env = ctx.env || process.env;
  const prisma =
    ctx.returnGovernancePrisma ||
    ctx.inventoryOperationsPrisma ||
    (await getPrismaClient(env));
  return {
    read:
      ctx.returnGovernanceReadService ||
      createReturnGovernanceReadService({
        prisma,
        capabilities: capabilities(env),
      }),
    command:
      ctx.returnGovernanceCommandService ||
      createReturnGovernanceCommandService({ prisma, env }),
  };
}

export async function handleReturnsRoute(ctx) {
  const path = ctx.url.pathname;
  if (
    !path.startsWith("/api/returns/requests") &&
    !path.startsWith("/api/returns/authorizations")
  )
    return false;
  if (!ensureDatabaseAndIdentity(ctx)) return true;
  try {
    const { read, command } = await services(ctx);
    if (ctx.req.method === "GET" && path === "/api/returns/requests") {
      ctx.send(ctx.res, 200, await read.listRequests(query(ctx.url), ctx));
      return true;
    }
    if (
      ctx.req.method === "POST" &&
      path === "/api/returns/requests/preview"
    ) {
      if (!ensureCapability(ctx, "return-request")) return true;
      ctx.send(
        ctx.res,
        200,
        await read.previewRequest(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }
    if (ctx.req.method === "POST" && path === "/api/returns/requests") {
      if (!ensureCapability(ctx, "return-request")) return true;
      ctx.send(
        ctx.res,
        201,
        await command.createRequest(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }

    const requestMatch = path.match(
      /^\/api\/returns\/requests\/([^/]+)(?:\/([^/]+))?$/,
    );
    if (requestMatch) {
      const requestId = decodeURIComponent(requestMatch[1]);
      const action = requestMatch[2] || "";
      if (
        ctx.req.method === "GET" &&
        (!action || action === "workbench")
      ) {
        ctx.send(
          ctx.res,
          200,
          await read.requestWorkbench(requestId, ctx),
        );
        return true;
      }
      const body = await ctx.readBody(ctx.req);
      if (ctx.req.method === "PATCH" && !action) {
        if (!ensureCapability(ctx, "return-request")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.reviseRequest(requestId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "submit-preview") {
        if (!ensureCapability(ctx, "return-request")) return true;
        ctx.send(ctx.res, 200, await read.previewSubmit(requestId, ctx));
        return true;
      }
      if (ctx.req.method === "POST" && action === "submit") {
        if (!ensureCapability(ctx, "return-request")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.submitRequest(requestId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "cancel-preview") {
        if (!ensureCapability(ctx, "return-request")) return true;
        ctx.send(
          ctx.res,
          200,
          await read.previewCancel(requestId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "cancel") {
        if (!ensureCapability(ctx, "return-request")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.cancelRequest(requestId, body, ctx),
        );
        return true;
      }
      if (
        ctx.req.method === "POST" &&
        action === "authorization-preview"
      ) {
        if (!ensureCapability(ctx, "return-authorization")) return true;
        ctx.send(
          ctx.res,
          200,
          await read.previewAuthorization(requestId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "authorize") {
        if (!ensureCapability(ctx, "return-authorization")) return true;
        ctx.send(
          ctx.res,
          201,
          await command.authorizeRequest(requestId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "reject") {
        if (!ensureCapability(ctx, "return-authorization")) return true;
        ctx.send(
          ctx.res,
          201,
          await command.rejectRequest(requestId, body, ctx),
        );
        return true;
      }
    }

    const authorizationMatch = path.match(
      /^\/api\/returns\/authorizations\/([^/]+)(?:\/([^/]+))?$/,
    );
    if (authorizationMatch) {
      const authorizationId = decodeURIComponent(authorizationMatch[1]);
      const action = authorizationMatch[2] || "";
      if (
        ctx.req.method === "GET" &&
        (!action || action === "workbench")
      ) {
        ctx.send(
          ctx.res,
          200,
          await read.authorizationWorkbench(authorizationId, ctx),
        );
        return true;
      }
      const body = await ctx.readBody(ctx.req);
      if (ctx.req.method === "POST" && action === "cancel") {
        if (!ensureCapability(ctx, "return-authorization")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.cancelAuthorization(authorizationId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "expire") {
        if (!ensureCapability(ctx, "return-authorization")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.expireAuthorization(authorizationId, body, ctx),
        );
        return true;
      }
    }
    ctx.send(ctx.res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    });
  } catch (error) {
    knownError(ctx, error);
  }
  return true;
}
