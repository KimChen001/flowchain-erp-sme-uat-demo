import { randomUUID } from "node:crypto";
import {
  PR_TRANSITIONS,
  PO_TRANSITIONS,
  assertVersion,
  procurementError,
  recommendProcurementPath,
  transition,
  validateDirectPo,
} from "../domain/procurement-workflow.mjs";
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
export function createProcurementWorkflowService({
  repository,
  policyProvider = async () => ({}),
  permission = async () => true,
  itemRepository,
}) {
  const audit = (doc, entry) => {
    const record = { id: id("AUD"), timestamp: now(), ...entry };
    doc.auditEntries.push(record);
    return record.id;
  };
  const requirePermission = async (actor, action, entity) => {
    if (!(await permission(actor, action, entity)))
      throw procurementError(
        "PERMISSION_DENIED",
        "当前用户无权执行此操作",
        [],
        403,
      );
  };
  const canonicalLines = async (lines = []) =>
    Promise.all(
      lines.map(async (line, index) => {
        const lineType =
          line.lineType ||
          (line.itemId || line.sku ? "catalog_item" : "non_catalog_item");
        if (lineType === "non_catalog_item") {
          if (!String(line.itemNameSnapshot || line.itemName || "").trim())
            throw procurementError(
              "NON_CATALOG_ITEM_NAME_REQUIRED",
              "非目录物料名称必填",
              [{ field: `lines.${index}.itemNameSnapshot` }],
              400,
            );
          if (!String(line.unitSnapshot || line.unit || "").trim())
            throw procurementError(
              "NON_CATALOG_ITEM_UNIT_REQUIRED",
              "非目录物料单位必填",
              [{ field: `lines.${index}.unitSnapshot` }],
              400,
            );
          return {
            ...structuredClone(line),
            lineType,
            itemId: null,
            sku: null,
            itemNameSnapshot: line.itemNameSnapshot || line.itemName,
            unitSnapshot: line.unitSnapshot || line.unit,
            specificationSnapshot:
              line.specificationSnapshot || line.specification || "",
          };
        }
    if (!itemRepository)
      return {
        ...structuredClone(line),
            itemNameSnapshot: line.itemNameSnapshot || line.itemName || "",
            unitSnapshot: line.unitSnapshot || line.unit || "",
            specificationSnapshot:
              line.specificationSnapshot || line.specification || "",
          };
    const item = await (itemRepository.getManagedItem || itemRepository.getItem)(line.itemId || line.sku);
        if (!item)
          throw procurementError(
            "ITEM_NOT_FOUND",
            "物料不存在",
            [{ field: `lines.${index}.itemId` }],
            400,
          );
        if (item.status !== "active")
          throw procurementError(
            "ITEM_INACTIVE",
            "物料已停用",
            [{ field: `lines.${index}.itemId` }],
            400,
          );
        if (!item.purchasable)
          throw procurementError(
            "ITEM_NOT_PURCHASABLE",
            "物料不允许采购",
            [{ field: `lines.${index}.itemId` }],
            400,
          );
        if (
          (line.itemId && line.itemId !== item.itemId) ||
          (line.sku && line.sku !== item.sku)
        )
          throw procurementError(
            "ITEM_MAPPING_MISMATCH",
            "itemId 与 SKU 不匹配",
            [{ field: `lines.${index}.sku` }],
            400,
          );
        return {
          ...structuredClone(line),
          lineType,
          itemId: item.itemId,
          sku: item.sku,
          itemNameSnapshot: item.itemName,
          unitSnapshot: item.purchaseUnit || item.baseUnit,
          specificationSnapshot: item.specification || "",
          warehouseId: line.warehouseId || item.defaultWarehouseId || "",
          suggestedSupplierId:
            line.suggestedSupplierId || item.defaultSupplierId || "",
        };
      }),
    );
  return {
    async createPurchaseRequest(input, actor) {
      await requirePermission(actor, "pr.create", input);
      const lines = await canonicalLines(input.lines);
      return repository.transact((doc) => {
        const t = now();
        const pr = {
          id: input.id || id("PR"),
          workspaceId: input.workspaceId || "default",
          companyId: input.companyId || "default",
          status: "draft",
          procurementPath: "undecided",
          procurementPathDecision: null,
          requesterId: input.requesterId || actor,
          buyerId: input.buyerId || "",
          departmentId: input.departmentId || "",
          supplierId: input.supplierId || "",
          currency: input.currency || "CNY",
          paymentTermsId: input.paymentTermsId || "",
          expectedDeliveryDate: input.expectedDeliveryDate || "",
          totalAmount: Number(input.totalAmount || 0),
          comments: input.comments || "",
          lines,
          version: 1,
          createdAt: t,
          createdBy: actor,
          updatedAt: t,
          updatedBy: actor,
          auditTrailIds: [],
        };
        pr.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "purchase_request",
            entityId: pr.id,
            action: "PR_CREATED",
            after: pr,
            result: "success",
          }),
        );
        doc.purchaseRequests.push(pr);
        return pr;
      });
    },
    async updatePurchaseRequestDraft(prId, input, actor) {
      await requirePermission(actor, "pr.update", { id: prId });
      const lines =
        input.lines === undefined
          ? undefined
          : await canonicalLines(input.lines);
      return repository.transact((doc) => {
        const pr = doc.purchaseRequests.find((x) => x.id === prId);
        if (!pr)
          throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
        assertVersion(pr, input.expectedVersion);
        if (pr.status !== "draft")
          throw procurementError(
            "INVALID_STATE_TRANSITION",
            "只有草稿可以编辑",
            [],
            409,
          );
        const before = structuredClone(pr);
        for (const key of [
          "requesterId",
          "buyerId",
          "departmentId",
          "supplierId",
          "currency",
          "paymentTermsId",
          "expectedDeliveryDate",
          "totalAmount",
          "lines",
          "emergencyPurchase",
          "singleSource",
          "reason",
          "comments",
        ])
          if (input[key] !== undefined)
            pr[key] = structuredClone(key === "lines" ? lines : input[key]);
        pr.version++;
        pr.updatedAt = now();
        pr.updatedBy = actor;
        pr.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "purchase_request",
            entityId: pr.id,
            action: "PR_UPDATED",
            before,
            after: pr,
            result: "success",
          }),
        );
        return pr;
      });
    },
    async transitionPurchaseRequest(
      prId,
      next,
      { expectedVersion, actor, reason = "" },
    ) {
      await requirePermission(
        actor,
        ["approved", "rejected"].includes(next) ? "pr.approve" : `pr.${next}`,
        { id: prId },
      );
      return repository.transact((doc) => {
        const pr = doc.purchaseRequests.find((x) => x.id === prId);
        if (!pr)
          throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
        const event = transition(
          pr,
          next,
          PR_TRANSITIONS,
          expectedVersion,
          actor,
          `PR_${next.toUpperCase()}`,
        );
        pr.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "purchase_request",
            entityId: pr.id,
            reason,
            ...event,
            result: "success",
          }),
        );
        return pr;
      });
    },
    async recommendPath(prId, actor) {
      const pr = await repository.get("pr", prId);
      if (!pr)
        throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
      const result = recommendProcurementPath(
        pr,
        await policyProvider(pr),
        {},
        {},
      );
      await repository.transact((doc) => {
        audit(doc, {
          actor,
          entityType: "purchase_request",
          entityId: prId,
          action: "PROCUREMENT_PATH_RECOMMENDED",
          after: result,
          result: "success",
        });
        return result;
      });
      return result;
    },
    async recordPathDecision(prId, input, actor) {
      return repository.transact(async (doc) => {
        const pr = doc.purchaseRequests.find((x) => x.id === prId);
        if (!pr)
          throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
        assertVersion(pr, input.expectedVersion);
        if (
          (await repository.findLinkedPo(prId)) ||
          (await repository.findLinkedRfq(prId))
        )
          throw procurementError(
            "DOWNSTREAM_OBJECT_ALREADY_EXISTS",
            "已存在下游采购对象",
            [],
            409,
          );
        const rec = recommendProcurementPath(
          pr,
          await policyProvider(pr),
          {},
          {},
        );
        if (
          input.path === "direct_po" &&
          rec.recommendation === "rfq" &&
          !input.overrideReason
        )
          throw procurementError(
            "RFQ_REQUIRED_BY_POLICY",
            "选择直接采购需要填写覆盖原因",
          );
        pr.procurementPath = input.path;
        pr.procurementPathDecision = {
          path: input.path,
          selectedBy: actor,
          selectedAt: now(),
          reason: input.reason || "",
          recommendation: rec.recommendation,
          recommendationReasons: rec.recommendationReasons,
          policySnapshot: rec.policySnapshot,
          overrideReason: input.overrideReason || "",
        };
        pr.version++;
        pr.updatedAt = now();
        pr.updatedBy = actor;
        pr.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "purchase_request",
            entityId: pr.id,
            action: input.overrideReason
              ? "PROCUREMENT_PATH_OVERRIDDEN"
              : "PROCUREMENT_PATH_SELECTED",
            after: pr.procurementPathDecision,
            policySnapshot: rec.policySnapshot,
            result: "success",
          }),
        );
        return pr;
      });
    },
    async createRfqFromPurchaseRequest(prId, input, actor) {
      const key = `purchase-request:${prId}:create-rfq`;
      const replay = await repository.idempotency(key);
      if (replay) return { ...replay.result, replayed: true };
      return repository.transact((doc) => {
        const pr = doc.purchaseRequests.find((x) => x.id === prId);
        if (!pr)
          throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
        assertVersion(pr, input.expectedVersion);
        if (pr.status !== "approved")
          throw procurementError(
            "INVALID_STATE_TRANSITION",
            "只有已批准采购申请可以发起询价",
            [],
            409,
          );
        const po = doc.purchaseOrders.find(
          (x) => x.sourcePrId === prId && x.status !== "cancelled",
        );
        if (po)
          throw procurementError(
            "DOWNSTREAM_OBJECT_ALREADY_EXISTS",
            "已存在采购订单",
            [],
            409,
          );
        const existing = doc.rfqs.find(
          (x) =>
            x.sourcePrId === prId &&
            !["cancelled", "closed"].includes(x.status),
        );
        if (existing)
          return { purchaseRequest: pr, rfq: existing, replayed: true };
        const t = now();
        const rfq = {
          id: id("RFQ"),
          sourcePrId: pr.id,
          buyerId: pr.buyerId,
          title: input.title || `询价 ${pr.id}`,
          currency: pr.currency,
          dueDate: input.dueDate || pr.expectedDeliveryDate,
          invitedSupplierIds: input.invitedSupplierIds || [],
          lines: structuredClone(pr.lines),
          comments: pr.comments || "",
          sourcePurchaseRequestId: pr.id,
          status: "draft",
          version: 1,
          createdAt: t,
          createdBy: actor,
          updatedAt: t,
          updatedBy: actor,
          auditTrailIds: [],
        };
        pr.procurementPath = "rfq";
        pr.procurementPathDecision = {
          path: "rfq",
          selectedBy: actor,
          selectedAt: t,
          reason: input.reason || "",
          recommendation: input.recommendation || "rfq",
          recommendationReasons: input.recommendationReasons || [],
          policySnapshot: input.policySnapshot || {},
          overrideReason: "",
        };
        pr.version++;
        pr.updatedAt = t;
        pr.updatedBy = actor;
        rfq.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "rfq",
            entityId: rfq.id,
            action: "RFQ_CREATED_FROM_PR",
            relatedEntityIds: [pr.id],
            idempotencyKey: key,
            after: rfq,
            result: "success",
          }),
        );
        doc.rfqs.push(rfq);
        const result = { purchaseRequest: pr, rfq };
        doc.idempotencyRecords.push({ key, result, createdAt: t });
        return result;
      });
    },
    async createDirectPoFromPurchaseRequest(prId, input, actor) {
      const key = `purchase-request:${prId}:create-direct-po`;
      const replay = await repository.idempotency(key);
      if (replay) return { ...replay.result, replayed: true };
      return repository.transact(async (doc) => {
        const pr = doc.purchaseRequests.find((x) => x.id === prId);
        if (!pr)
          throw procurementError("ENTITY_NOT_FOUND", "采购申请不存在", [], 404);
        assertVersion(pr, input.expectedVersion);
        const existing = doc.purchaseOrders.find(
          (x) => x.sourcePrId === prId && x.status !== "cancelled",
        );
        if (existing)
          return {
            purchaseRequest: pr,
            purchaseOrder: existing,
            replayed: true,
          };
        if (
          doc.rfqs.some(
            (x) =>
              x.sourcePrId === prId &&
              !["cancelled", "closed"].includes(x.status),
          )
        )
          throw procurementError(
            "DOWNSTREAM_OBJECT_ALREADY_EXISTS",
            "已存在活动询价",
            [],
            409,
          );
        const merged = {
          ...pr,
          ...input,
          supplierId: input.supplierId || pr.supplierId,
          currency: input.currency || pr.currency,
          paymentTermsId: input.paymentTermsId || pr.paymentTermsId,
          expectedDeliveryDate:
            input.expectedDeliveryDate || pr.expectedDeliveryDate,
        };
        validateDirectPo(
          merged,
          await policyProvider(pr),
          await permission(actor, "procurement.direct_po", pr),
        );
        const t = now();
        const po = {
          id: id("PO"),
          sourcePrId: pr.id,
          sourceRfqId: null,
          procurementPath: "direct_po",
          supplierId: merged.supplierId,
          buyerId: pr.buyerId,
          currency: merged.currency,
          paymentTermsId: merged.paymentTermsId,
          orderDate: t.slice(0, 10),
          expectedDeliveryDate: merged.expectedDeliveryDate,
          subtotal: Number(pr.totalAmount),
          taxAmount: Number(input.taxAmount || 0),
          totalAmount: Number(pr.totalAmount) + Number(input.taxAmount || 0),
          lines: structuredClone(pr.lines),
          comments: pr.comments || "",
          sourcePurchaseRequestId: pr.id,
          status: "draft",
          version: 1,
          createdAt: t,
          createdBy: actor,
          updatedAt: t,
          updatedBy: actor,
          auditTrailIds: [],
        };
        pr.procurementPath = "direct_po";
        pr.status = "converted";
        pr.linkedPoId = po.id;
        pr.version++;
        pr.updatedAt = t;
        pr.updatedBy = actor;
        po.auditTrailIds.push(
          audit(doc, {
            actor,
            entityType: "purchase_order",
            entityId: po.id,
            action: "PO_CREATED_FROM_PR",
            relatedEntityIds: [pr.id],
            idempotencyKey: key,
            after: po,
            result: "success",
          }),
        );
        doc.purchaseOrders.push(po);
        const result = { purchaseRequest: pr, purchaseOrder: po };
        doc.idempotencyRecords.push({ key, result, createdAt: t });
        return result;
      });
    },
    validateDirectPo,
    transitionPurchaseOrder: async (poId, next, args) => {
      if (!(await permission(args.actor, `po.${next}`, { id: poId })))
        throw procurementError(
          "PERMISSION_DENIED",
          "当前用户无权执行此操作",
          [],
          403,
        );
      return repository.transact((doc) => {
        const po = doc.purchaseOrders.find((x) => x.id === poId);
        if (!po)
          throw procurementError("ENTITY_NOT_FOUND", "采购订单不存在", [], 404);
        const event = transition(
          po,
          next,
          PO_TRANSITIONS,
          args.expectedVersion,
          args.actor,
          `PO_${next.toUpperCase()}`,
        );
        po.auditTrailIds.push(
          audit(doc, {
            actor: args.actor,
            entityType: "purchase_order",
            entityId: po.id,
            ...event,
            result: "success",
          }),
        );
        return po;
      });
    },
    transitionRfq: async (rfqId, next, args) =>
      repository.transact((doc) => {
        const rfq = doc.rfqs.find((x) => x.id === rfqId);
        if (!rfq)
          throw procurementError("ENTITY_NOT_FOUND", "询价单不存在", [], 404);
        assertVersion(rfq, args.expectedVersion);
        const allowed = {
          draft: ["open", "cancelled"],
          open: ["collecting_quotes", "cancelled"],
          collecting_quotes: ["closed", "cancelled"],
          cancelled: [],
          closed: [],
        };
        if (!allowed[rfq.status]?.includes(next))
          throw procurementError(
            "INVALID_STATE_TRANSITION",
            `不能从 ${rfq.status} 转换为 ${next}`,
            [],
            409,
          );
        const before = structuredClone(rfq);
        rfq.status = next;
        rfq.version++;
        rfq.updatedAt = now();
        rfq.updatedBy = args.actor;
        rfq.auditTrailIds.push(
          audit(doc, {
            actor: args.actor,
            entityType: "rfq",
            entityId: rfq.id,
            action: `RFQ_${next.toUpperCase()}`,
            before,
            after: rfq,
            result: "success",
          }),
        );
        return rfq;
      }),
  };
}
