import { capabilityForEnvironment } from "../domain/capability-registry.mjs";
import {
  createOperationalFinanceCommandService,
  OperationalFinanceError,
} from "../domain/operational-finance-command-service.mjs";
import {
  createOperationalFinanceReadService,
  OperationalFinanceReadError,
} from "../domain/operational-finance-read-service.mjs";
import { PilotIdentityError } from "../domain/pilot-identity.mjs";
import { getPrismaClient } from "../persistence/prisma-client.mjs";

const capabilityIds = [
  "supplier-invoice",
  "three-way-match",
  "payable-obligation",
  "supplier-credit-memo",
];
const capabilities = (env) =>
  Object.fromEntries(
    capabilityIds.map((id) => [id, capabilityForEnvironment(id, env)]),
  );
const query = (url) => Object.fromEntries(url.searchParams.entries());

function unavailable(ctx, capabilityId) {
  ctx.send(ctx.res, 409, {
    code: "OPERATIONAL_FINANCE_CAPABILITY_NOT_AVAILABLE",
    message:
      "Operational finance requires database persistence and explicit enablement.",
    details: { capability: capabilityId },
  });
}

function ensureBoundary(ctx) {
  const env = ctx.env || process.env;
  if (String(env.FLOWCHAIN_PERSISTENCE_MODE || "").toLowerCase() !== "database") {
    unavailable(ctx, "supplier-invoice");
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
  if (capabilityForEnvironment(id, ctx.env || process.env)?.enabled) return true;
  unavailable(ctx, id);
  return false;
}

function knownError(ctx, error) {
  if (
    error instanceof OperationalFinanceError ||
    error instanceof OperationalFinanceReadError ||
    error instanceof PilotIdentityError
  ) {
    ctx.send(ctx.res, error.status || 400, {
      code: error.code || "OPERATIONAL_FINANCE_FAILED",
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }
  ctx.send(ctx.res, 500, {
    code: "OPERATIONAL_FINANCE_FAILED",
    message: "Operational finance could not be completed.",
  });
}

async function services(ctx) {
  const env = ctx.env || process.env;
  const prisma =
    ctx.operationalFinancePrisma || (await getPrismaClient(env));
  return {
    read:
      ctx.operationalFinanceReadService ||
      createOperationalFinanceReadService({
        prisma,
        capabilities: capabilities(env),
      }),
    command:
      ctx.operationalFinanceCommandService ||
      createOperationalFinanceCommandService({ prisma, env }),
  };
}

export async function handleOperationalFinanceRoute(ctx) {
  const path = ctx.url.pathname;
  if (!path.startsWith("/api/finance/")) return false;
  if (!ensureBoundary(ctx)) return true;
  try {
    const { read, command } = await services(ctx);
    if (ctx.req.method === "GET" && path === "/api/finance/entry-data") {
      ctx.send(ctx.res, 200, await read.entryData(ctx));
      return true;
    }
    if (ctx.req.method === "GET" && path === "/api/finance/supplier-invoices") {
      ctx.send(ctx.res, 200, await read.listSupplierInvoices(query(ctx.url), ctx));
      return true;
    }
    if (ctx.req.method === "POST" && path === "/api/finance/supplier-invoices/preview") {
      if (!ensureCapability(ctx, "supplier-invoice")) return true;
      ctx.send(
        ctx.res,
        200,
        await command.previewSupplierInvoice(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }
    if (ctx.req.method === "POST" && path === "/api/finance/supplier-invoices") {
      if (!ensureCapability(ctx, "supplier-invoice")) return true;
      ctx.send(
        ctx.res,
        201,
        await command.createSupplierInvoice(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }
    if (ctx.req.method === "GET" && path === "/api/finance/match-exceptions") {
      ctx.send(ctx.res, 200, await read.listMatchExceptions(query(ctx.url), ctx));
      return true;
    }
    if (ctx.req.method === "GET" && path === "/api/finance/payables") {
      ctx.send(ctx.res, 200, await read.listPayables(query(ctx.url), ctx));
      return true;
    }
    if (ctx.req.method === "GET" && path === "/api/finance/supplier-credit-memos") {
      ctx.send(
        ctx.res,
        200,
        await read.listSupplierCreditMemos(query(ctx.url), ctx),
      );
      return true;
    }
    if (
      ctx.req.method === "POST" &&
      path === "/api/finance/supplier-credit-memos/preview"
    ) {
      if (!ensureCapability(ctx, "supplier-credit-memo")) return true;
      ctx.send(
        ctx.res,
        200,
        await command.previewSupplierCreditMemo(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }
    if (
      ctx.req.method === "POST" &&
      path === "/api/finance/supplier-credit-memos"
    ) {
      if (!ensureCapability(ctx, "supplier-credit-memo")) return true;
      ctx.send(
        ctx.res,
        201,
        await command.createSupplierCreditMemo(await ctx.readBody(ctx.req), ctx),
      );
      return true;
    }

    const invoiceMatch = path.match(
      /^\/api\/finance\/supplier-invoices\/([^/]+)(?:\/([^/]+))?$/,
    );
    if (invoiceMatch) {
      const invoiceId = decodeURIComponent(invoiceMatch[1]);
      const action = invoiceMatch[2] || "";
      if (ctx.req.method === "GET" && !action) {
        ctx.send(ctx.res, 200, await read.supplierInvoiceDetail(invoiceId, ctx));
        return true;
      }
      if (ctx.req.method === "PATCH" && !action) {
        if (!ensureCapability(ctx, "supplier-invoice")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.reviseSupplierInvoice(
            invoiceId,
            await ctx.readBody(ctx.req),
            ctx,
          ),
        );
        return true;
      }
      const body = await ctx.readBody(ctx.req);
      if (ctx.req.method === "POST" && action === "submit-preview") {
        if (!ensureCapability(ctx, "supplier-invoice")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.previewSubmitSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "submit") {
        if (!ensureCapability(ctx, "supplier-invoice")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.submitSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "match-preview") {
        if (!ensureCapability(ctx, "three-way-match")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.previewMatchSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "match") {
        if (!ensureCapability(ctx, "three-way-match")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.matchSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "approve-preview") {
        if (!ensureCapability(ctx, "payable-obligation")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.previewApproveSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
      if (ctx.req.method === "POST" && action === "approve") {
        if (!ensureCapability(ctx, "payable-obligation")) return true;
        ctx.send(
          ctx.res,
          200,
          await command.approveSupplierInvoice(invoiceId, body, ctx),
        );
        return true;
      }
    }

    const exceptionMatch = path.match(
      /^\/api\/finance\/match-exceptions\/([^/]+)\/(review-preview|review)$/,
    );
    if (exceptionMatch && ctx.req.method === "POST") {
      if (!ensureCapability(ctx, "three-way-match")) return true;
      const body = await ctx.readBody(ctx.req);
      const exceptionId = decodeURIComponent(exceptionMatch[1]);
      const result =
        exceptionMatch[2] === "review-preview"
          ? await command.previewReviewMatchException(exceptionId, body, ctx)
          : await command.reviewMatchException(exceptionId, body, ctx);
      ctx.send(ctx.res, 200, result);
      return true;
    }

    const payableMatch = path.match(
      /^\/api\/finance\/payables\/([^/]+)\/(hold|release|mark-export-ready)(-preview)?$/,
    );
    if (payableMatch && ctx.req.method === "POST") {
      if (!ensureCapability(ctx, "payable-obligation")) return true;
      const payableId = decodeURIComponent(payableMatch[1]);
      const action = payableMatch[2];
      const body = await ctx.readBody(ctx.req);
      if (payableMatch[3]) {
        ctx.send(
          ctx.res,
          200,
          await command.previewPayableAction(action, payableId, body, ctx),
        );
        return true;
      }
      const method =
        action === "hold"
          ? "holdPayable"
          : action === "release"
            ? "releasePayable"
            : "markPayableExportReady";
      ctx.send(ctx.res, 200, await command[method](payableId, body, ctx));
      return true;
    }

    const memoMatch = path.match(
      /^\/api\/finance\/supplier-credit-memos\/([^/]+)\/(approve-preview|approve)$/,
    );
    if (memoMatch && ctx.req.method === "POST") {
      if (!ensureCapability(ctx, "supplier-credit-memo")) return true;
      const memoId = decodeURIComponent(memoMatch[1]);
      const body = await ctx.readBody(ctx.req);
      ctx.send(
        ctx.res,
        200,
        memoMatch[2] === "approve-preview"
          ? await command.previewApproveSupplierCreditMemo(memoId, body, ctx)
          : await command.approveSupplierCreditMemo(memoId, body, ctx),
      );
      return true;
    }

    ctx.send(ctx.res, 404, {
      code: "OPERATIONAL_FINANCE_ROUTE_NOT_FOUND",
      message: "Operational finance route was not found.",
    });
    return true;
  } catch (error) {
    knownError(ctx, error);
    return true;
  }
}
