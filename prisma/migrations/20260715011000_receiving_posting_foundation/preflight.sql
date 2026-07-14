-- Read-only duplicate detection for the receiving posting foundation.
-- Any returned row must be resolved by a business-approved merge or correction
-- before migration.sql is applied. This script intentionally performs no writes.
SELECT
  "tenantId",
  "sku",
  coalesce("warehouseId", '') AS "normalizedWarehouseKey",
  lower(trim(coalesce("location", ''))) AS "normalizedLocationKey",
  count(*) AS "duplicateCount",
  array_agg("id" ORDER BY "id") AS "balanceIds"
FROM "InventoryBalance"
GROUP BY "tenantId", "sku", coalesce("warehouseId", ''), lower(trim(coalesce("location", '')))
HAVING count(*) > 1
ORDER BY "tenantId", "sku", "normalizedWarehouseKey", "normalizedLocationKey";
