import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const clone = (value) => structuredClone(value);
const now = () => new Date().toISOString();
const text = (value) => String(value ?? "").trim();

function normalize(input = {}, existing = {}, actor = "system") {
  const timestamp = now();
  return {
    itemId: text(
      input.itemId ||
        input.id ||
        existing.itemId ||
        existing.id ||
        `ITEM-${randomUUID().slice(0, 8).toUpperCase()}`,
    ),
    sku: text(input.sku || existing.sku),
    itemName: text(
      input.itemName || input.name || existing.itemName || existing.name,
    ),
    shortName: text(input.shortName ?? existing.shortName),
    itemType: text(input.itemType || existing.itemType || "material"),
    category: text(
      input.category || input.categoryId || existing.category || "未分类",
    ),
    brand: text(input.brand ?? existing.brand),
    specification: text(input.specification ?? existing.specification),
    baseUnit: text(
      input.baseUnit || input.baseUom || existing.baseUnit || "件",
    ),
    status: text(input.status || existing.status || "active"),
    purchasable: input.purchasable ?? existing.purchasable ?? true,
    inventoryItem: input.inventoryItem ?? existing.inventoryItem ?? true,
    purchaseUnit: text(
      input.purchaseUnit ||
        existing.purchaseUnit ||
        input.baseUnit ||
        input.baseUom ||
        "件",
    ),
    defaultWarehouseId: text(
      input.defaultWarehouseId ?? existing.defaultWarehouseId,
    ),
    safetyStock: Number(input.safetyStock ?? existing.safetyStock ?? 0),
    reorderPoint: Number(input.reorderPoint ?? existing.reorderPoint ?? 0),
    minimumOrderQuantity: Number(
      input.minimumOrderQuantity ??
        input.moq ??
        existing.minimumOrderQuantity ??
        1,
    ),
    purchaseLeadTimeDays: Number(
      input.purchaseLeadTimeDays ??
        input.leadTimeDays ??
        existing.purchaseLeadTimeDays ??
        0,
    ),
    defaultSupplierId: text(
      input.defaultSupplierId ||
        input.preferredSupplierId ||
        existing.defaultSupplierId,
    ),
    taxCodeId: text(input.taxCodeId ?? existing.taxCodeId),
    barcode: text(input.barcode ?? existing.barcode),
    manufacturerPartNumber: text(
      input.manufacturerPartNumber ?? existing.manufacturerPartNumber,
    ),
    batchManaged: input.batchManaged ?? existing.batchManaged ?? false,
    serialManaged: input.serialManaged ?? existing.serialManaged ?? false,
    shelfLifeManaged:
      input.shelfLifeManaged ?? existing.shelfLifeManaged ?? false,
    comments: text(input.comments ?? existing.comments),
    version: Number(existing.version || 0) + 1,
    createdBy: existing.createdBy || actor,
    createdAt: existing.createdAt || timestamp,
    updatedBy: actor,
    updatedAt: timestamp,
  };
}

async function atomicWrite(file, document) {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await mkdir(dirname(file), { recursive: true });
  try {
    await writeFile(temp, JSON.stringify(document, null, 2), "utf8");
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export function createDurableItemMasterRepository({ dataFile }) {
  let document;
  async function load() {
    if (document) return document;
    try {
      document = JSON.parse(await readFile(dataFile, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      document = { schemaVersion: 1, revision: 0, items: [], updatedAt: null };
    }
    return document;
  }
  async function save() {
    document.revision = Number(document.revision || 0) + 1;
    document.updatedAt = now();
    await atomicWrite(dataFile, document);
  }
  const find = (items, key) =>
    items.find((item) =>
      [item.itemId, item.sku].some(
        (value) => value.toLowerCase() === key.toLowerCase(),
      ),
    );
  return {
    mode: "json",
    adapter: "durable-item-master-v1",
    async listItems(filters = {}) {
      const rows = (await load()).items;
      return clone(
        rows.filter(
          (item) =>
            !filters.purchasableOnly ||
            (item.status === "active" && item.purchasable),
        ),
      );
    },
    async getItem(id) {
      return clone(find((await load()).items, decodeURIComponent(id)) || null);
    },
    async createItem(input, actor) {
      const doc = await load();
      const item = normalize(input, {}, actor);
      if (!item.sku || !item.itemName || !item.baseUnit)
        throw Object.assign(new Error("SKU、物料名称和基本单位必填"), {
          code: "VALIDATION_ERROR",
          status: 400,
        });
      if (
        find(doc.items, item.itemId) ||
        doc.items.some(
          (row) => row.sku.toLowerCase() === item.sku.toLowerCase(),
        )
      )
        throw Object.assign(new Error("itemId 或 SKU 编码已存在"), {
          code: "DUPLICATE_ITEM",
          status: 409,
        });
      doc.items.push(item);
      await save();
      return clone(item);
    },
    async updateItem(id, input, actor) {
      const doc = await load();
      const index = doc.items.findIndex((item) =>
        [item.itemId, item.sku].includes(decodeURIComponent(id)),
      );
      if (index < 0)
        throw Object.assign(new Error("物料不存在"), {
          code: "ITEM_NOT_FOUND",
          status: 404,
        });
      const next = normalize(input, doc.items[index], actor);
      if (
        input.expectedVersion !== undefined &&
        Number(input.expectedVersion) !== doc.items[index].version
      )
        throw Object.assign(new Error("物料已被其他用户更新"), {
          code: "VERSION_CONFLICT",
          status: 409,
        });
      if (
        doc.items.some(
          (row, rowIndex) =>
            rowIndex !== index &&
            row.sku.toLowerCase() === next.sku.toLowerCase(),
        )
      )
        throw Object.assign(new Error("SKU 编码已存在"), {
          code: "DUPLICATE_ITEM",
          status: 409,
        });
      doc.items[index] = next;
      await save();
      return clone(next);
    },
    _dataFile: dataFile,
  };
}
