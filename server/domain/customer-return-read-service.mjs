import {
  assertWarehouseAccess,
  resolveProvisionedActor,
} from "./pilot-identity.mjs";
import {
  buildCustomerReturnDraftPlan,
  buildCustomerReturnPostingPlan,
  buildCustomerReturnReversalPlan,
} from "./customer-return-transaction-policy.mjs";
import { assertAuthorized } from "../auth/authorization-service.mjs";

const publicValue = (value) => {
  if (typeof value === "bigint") return undefined;
  if (Array.isArray(value))
    return value.map(publicValue).filter((entry) => entry !== undefined);
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "authorization",
              "posting",
              "balance",
              "movement",
              "quantityUnits",
            ].includes(key),
        )
        .map(([key, entry]) => [key, publicValue(entry)])
        .filter(([, entry]) => entry !== undefined),
    );
  return value;
};
const model = (plan) => ({
  allowed: plan.allowed,
  blockingIssues: plan.blockingIssues,
  warnings: plan.warnings,
  normalizedPlan: publicValue(plan.normalizedPlan),
  balanceImpacts: publicValue(plan.balanceImpacts),
  documentImpacts: publicValue(plan.documentImpacts),
  movementFacts: publicValue(plan.movementFacts),
  authorizationStatusAfter: plan.authorizationStatusAfter,
  requestStatusAfter: plan.requestStatusAfter,
});

export function createCustomerReturnReadService({
  prisma,
  capability,
  now = () => new Date(),
} = {}) {
  if (!prisma) throw new Error("prisma is required");
  const actor = (context) =>
    resolveProvisionedActor(prisma, context?.identity || context);
  async function response(plan, resolved, action) {
    const permission = action === "reverse" ? "returns.posting.reverse" : action === "post" ? "returns.posting.post" : action === "ready" ? "returns.posting.ready" : "returns.posting.prepare";
    assertAuthorized({ actor: resolved, permission, tenantId: resolved.tenantId });
    if (plan.warehouseIds?.length)
      assertWarehouseAccess(resolved, plan.warehouseIds, "operate");
    return {
      dataSource: "Authoritative PostgreSQL",
      transactionType: "customer_return_receipt",
      action,
      capability,
      preview: model(plan),
    };
  }
  async function previewDraft(authorizationId, input, context) {
    const resolved = await actor(context);
    return response(
      await buildCustomerReturnDraftPlan({
        prisma,
        tenantId: resolved.tenantId,
        authorizationId,
        lines: input?.lines,
        now: now(),
      }),
      resolved,
      "create",
    );
  }
  async function previewReady(postingId, context) {
    const resolved = await actor(context);
    return response(
      await buildCustomerReturnPostingPlan({
        prisma,
        tenantId: resolved.tenantId,
        postingId,
        now: now(),
        allowedWorkflowStatuses: ["draft"],
      }),
      resolved,
      "ready",
    );
  }
  async function previewPost(postingId, context) {
    const resolved = await actor(context);
    return response(
      await buildCustomerReturnPostingPlan({
        prisma,
        tenantId: resolved.tenantId,
        postingId,
        now: now(),
      }),
      resolved,
      "post",
    );
  }
  async function previewReverse(postingId, context) {
    const resolved = await actor(context);
    return response(
      await buildCustomerReturnReversalPlan({
        prisma,
        tenantId: resolved.tenantId,
        postingId,
      }),
      resolved,
      "reverse",
    );
  }
  return { previewDraft, previewReady, previewPost, previewReverse };
}
