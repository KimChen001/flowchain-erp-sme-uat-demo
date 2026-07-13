import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDurableItemMasterRepository } from "../repositories/durable-item-master-repository.mjs";
import { createDurableProcurementRepository } from "../repositories/durable-procurement-repository.mjs";
import { createProcurementWorkflowService } from "../services/procurement-workflow-service.mjs";

const baseItem = {
  itemId: "ITEM-1",
  sku: "SKU-1",
  itemName: "电机",
  baseUnit: "台",
  purchaseUnit: "台",
  specification: "2kW",
  status: "active",
  purchasable: true,
  defaultSupplierId: "SUP-1",
};
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "flowchain-sku-"));
  const items = createDurableItemMasterRepository({
    dataFile: join(directory, "items.json"),
  });
  await items.createItem(baseItem, "fixture");
  const procurement = createDurableProcurementRepository({
    dataFile: join(directory, "procurement.json"),
  });
  const service = createProcurementWorkflowService({
    repository: procurement,
    itemRepository: items,
  });
  return {
    directory,
    items,
    procurement,
    service,
    close: () => rm(directory, { recursive: true, force: true }),
  };
}

test("SKU create, update, duplicate validation and restart persistence", async () => {
  const f = await fixture();
  try {
    const created = await f.items.createItem(
      { itemId: "ITEM-2", sku: "SKU-2", itemName: "轴承", baseUnit: "件" },
      "admin",
    );
    assert.equal((await f.items.getItem("SKU-2")).itemName, "轴承");
    await f.items.updateItem(
      created.itemId,
      { itemName: "精密轴承", expectedVersion: created.version },
      "admin",
    );
    const restarted = createDurableItemMasterRepository({
      dataFile: f.items._dataFile,
    });
    assert.equal((await restarted.getItem("ITEM-2")).itemName, "精密轴承");
    await assert.rejects(
      () =>
        restarted.createItem(
          { itemId: "ITEM-3", sku: "SKU-2", itemName: "重复", baseUnit: "件" },
          "admin",
        ),
      (error) => error.code === "DUPLICATE_ITEM",
    );
  } finally {
    await f.close();
  }
});

test("purchasable selector excludes inactive items", async () => {
  const f = await fixture();
  try {
    const item = await f.items.getItem("ITEM-1");
    await f.items.updateItem(
      "ITEM-1",
      { status: "inactive", expectedVersion: item.version },
      "admin",
    );
    assert.equal(
      (await f.items.listItems({ purchasableOnly: true })).length,
      0,
    );
  } finally {
    await f.close();
  }
});

test("catalog mapping is canonical, immutable after submit and rejects mismatch", async () => {
  const f = await fixture();
  try {
    const pr = await f.service.createPurchaseRequest(
      {
        comments: "设备维护",
        lines: [
          {
            lineType: "catalog_item",
            itemId: "ITEM-1",
            sku: "SKU-1",
            itemNameSnapshot: "伪造名称",
            unitSnapshot: "箱",
            quantity: 2,
            estimatedUnitPrice: 10, supplierId: "SUP-1", needByDate: "2026-08-01", targetWarehouseId: "WH-1", currency: "CNY",
            internalLineComment: "原厂包装",
          },
        ],
      },
      "owner",
    );
    assert.equal(pr.lines[0].itemNameSnapshot, "电机");
    assert.equal(pr.lines[0].unitSnapshot, "台");
    await assert.rejects(
      () =>
        f.service.createPurchaseRequest(
          {
            lines: [
              { lineType: "catalog_item", itemId: "ITEM-1", sku: "WRONG", supplierId: "SUP-1", quantity: 1, estimatedUnitPrice: 10, needByDate: "2026-08-01" },
            ],
          },
          "owner",
        ),
      (error) => error.code === "ITEM_MAPPING_MISMATCH",
    );
    const submitted = await f.service.transitionPurchaseRequest(
      pr.id,
      "submitted",
      { expectedVersion: pr.version, actor: "owner" },
    );
    await assert.rejects(
      () =>
        f.service.updatePurchaseRequestDraft(
          pr.id,
          { expectedVersion: submitted.version, lines: [] },
          "owner",
        ),
      (error) => error.code === "INVALID_STATE_TRANSITION",
    );
    const item = await f.items.getItem("ITEM-1");
    await f.items.updateItem(
      "ITEM-1",
      { itemName: "新名称", expectedVersion: item.version },
      "admin",
    );
    assert.equal(
      (await f.procurement.get("pr", pr.id)).lines[0].itemNameSnapshot,
      "电机",
    );
  } finally {
    await f.close();
  }
});

test("catalog and Other lines coexist and snapshots/comments reach RFQ and PO", async () => {
  const f = await fixture();
  try {
    const input = {
      comments: "整单说明",
      currency: "CNY",
      supplierId: "SUP-1",
      paymentTermsId: "NET30",
      expectedDeliveryDate: "2026-08-10",
      lines: [
        {
          lineType: "catalog_item",
          itemId: "ITEM-1",
          sku: "SKU-1",
          quantity: 1,
          estimatedUnitPrice: 10, supplierId: "SUP-1", needByDate: "2026-08-10", targetWarehouseId: "WH-1", currency: "CNY",
          internalLineComment: "目录备注",
        },
        {
          lineType: "non_catalog_item",
          itemNameSnapshot: "设备校准服务",
          unitSnapshot: "项",
          quantity: 1,
          estimatedUnitPrice: 20, supplierId: "SUP-1", needByDate: "2026-08-10", targetWarehouseId: "WH-1", currency: "CNY", commodityId: "service",
          internalLineComment: "服务备注",
        },
      ],
    };
    const pr = await f.service.createPurchaseRequest(input, "owner");
    assert.equal(pr.lines.length, 2);
    assert.equal(pr.lines[1].sku, null);
    const submitted = await f.service.transitionPurchaseRequest(
      pr.id,
      "submitted",
      { expectedVersion: pr.version, actor: "owner" },
    );
    const approved = await f.service.transitionPurchaseRequest(
      pr.id,
      "approved",
      { expectedVersion: submitted.version, actor: "manager" },
    );
    const rfq = await f.service.createRfqFromPurchaseRequest(
      pr.id,
      { expectedVersion: approved.version },
      "buyer",
    );
    assert.equal(rfq.rfq.lines[1].itemNameSnapshot, "设备校准服务");
    assert.equal(rfq.rfq.lines[1].internalLineComment, "服务备注");
    const f2 = await fixture();
    try {
      const p = await f2.service.createPurchaseRequest(input, "owner");
      const s = await f2.service.transitionPurchaseRequest(p.id, "submitted", {
        expectedVersion: p.version,
        actor: "owner",
      });
      const a = await f2.service.transitionPurchaseRequest(p.id, "approved", {
        expectedVersion: s.version,
        actor: "manager",
      });
      const po = await f2.service.createDirectPoFromPurchaseRequest(
        p.id,
        { expectedVersion: a.version, supplierId: "SUP-1" },
        "buyer",
      );
      assert.equal(po.createdPurchaseOrders[0].lines[1].itemNameSnapshot, "设备校准服务");
    } finally {
      await f2.close();
    }
  } finally {
    await f.close();
  }
});

test("Other requires name and unit", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      () =>
        f.service.createPurchaseRequest(
          { lines: [{ lineType: "non_catalog_item", unitSnapshot: "项", supplierId:"SUP-1", quantity:1, estimatedUnitPrice:10, needByDate:"2026-08-01" }] },
          "owner",
        ),
      (error) => error.code === "NON_CATALOG_ITEM_NAME_REQUIRED",
    );
    await assert.rejects(
      () =>
        f.service.createPurchaseRequest(
          {
            lines: [{ lineType: "non_catalog_item", itemNameSnapshot: "服务", supplierId:"SUP-1", quantity:1, estimatedUnitPrice:10, needByDate:"2026-08-01" }],
          },
          "owner",
        ),
      (error) => error.code === "NON_CATALOG_ITEM_UNIT_REQUIRED",
    );
  } finally {
    await f.close();
  }
});
