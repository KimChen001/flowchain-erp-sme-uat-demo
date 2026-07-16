import assert from "node:assert/strict";
import test from "node:test";
import { handleInventoryOperationsRoute } from "./inventory-operations.routes.mjs";

for (const prismaCode of ["P2002", "P2025", "P2034"]) {
  test(`inventory operations route does not expose Prisma ${prismaCode}`, async () => {
    let response;
    const databaseError = new Error(
      `Prisma ${prismaCode} table InventoryBalance constraint secret_constraint DATABASE_URL=postgresql://secret`,
    );
    databaseError.code = prismaCode;
    const ctx = {
      req: { method: "GET", headers: {} },
      res: {},
      url: new URL("/api/inventory/operations/entry-data", "http://localhost"),
      env: {
        FLOWCHAIN_PERSISTENCE_MODE: "database",
        FLOWCHAIN_ENABLE_DB_INVENTORY_OPERATIONS: "true",
      },
      identity: {
        authenticated: true,
        tenantId: "tenant-test",
        userId: "user-test",
        role: "manager",
      },
      inventoryOperationsPrisma: {
        user: {
          findFirst: async () => {
            throw databaseError;
          },
        },
      },
      send(_res, status, payload) {
        response = { status, payload };
      },
    };
    assert.equal(await handleInventoryOperationsRoute(ctx), true);
    assert.deepEqual(response, {
      status: 500,
      payload: {
        code: "INVENTORY_OPERATION_FAILED",
        message: "Inventory operation failed.",
      },
    });
    assert.doesNotMatch(
      JSON.stringify(response),
      /P2002|P2025|P2034|Prisma|InventoryBalance|secret_constraint|postgresql:\/\//,
    );
  });
}
