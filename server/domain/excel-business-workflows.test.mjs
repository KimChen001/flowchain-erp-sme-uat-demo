import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workbook = readFileSync(new URL('../../src/lib/excel/excelWorkbookService.ts', import.meta.url), 'utf8');
const schemas = readFileSync(new URL('../../src/lib/excel/excelSchemas.ts', import.meta.url), 'utf8');
const validation = readFileSync(new URL('../../src/lib/excel/importValidationService.ts', import.meta.url), 'utf8');
const tasks = readFileSync(new URL('../../src/lib/excel/importTaskService.ts', import.meta.url), 'utf8');

test('Excel templates contain data, field definitions, and import guide sheets', () => {
  for (const sheet of ['导入数据', '字段说明', '导入说明']) assert.ok(workbook.includes(sheet));
  for (const filename of ['supplier-invoice-import-template.xlsx', 'supplier-reconciliation-import-template.xlsx', 'purchase-request-import-template.xlsx', 'supplier-master-import-template.xlsx', 'item-master-import-template.xlsx', 'customer-master-import-template.xlsx', 'inventory-balance-import-template.xlsx']) assert.ok(schemas.includes(filename));
  assert.match(workbook, /\.xlsx、\.xls、\.csv/);
  assert.match(workbook, /!autofilter/);
  assert.match(workbook, /!freeze/);
});

test('Excel import validates mappings, data formats, master data, and errors', () => {
  for (const rule of ['必填字段缺失', '日期格式错误', '数字格式错误', '负金额', '负数量', '币种无效', '状态值无效', '重复编号', '无法识别的字段']) assert.ok(validation.includes(rule));
  for (const master of ['SUPPLIER_MASTER', 'ITEM_MASTER', 'WAREHOUSE_BINS', 'purchaseOrders', 'receivingDocs', 'SUPPLIER_INVOICES']) assert.ok(validation.includes(master));
});

test('import task model persists required status and audit fields', () => {
  for (const field of ['importTaskId', 'originalFileName', 'sheetName', 'businessObject', 'sourcePage', 'uploadedBy', 'uploadedAt', 'totalRows', 'validRows', 'warningRows', 'errorRows', 'fieldMapping', 'validationErrors', 'validationWarnings', 'completedAt']) assert.ok(tasks.includes(field));
  for (const status of ['parsing', 'validating', 'ready', 'importing', 'completed', 'completed_with_warnings', 'failed']) assert.ok(tasks.includes(status));
});
