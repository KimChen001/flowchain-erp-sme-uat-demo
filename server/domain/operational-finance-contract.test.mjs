import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { capabilityForEnvironment } from "./capability-registry.mjs";
import { operationalFinanceRequestHash } from "./operational-finance-command-service.mjs";

const root = resolve(import.meta.dirname, "..", "..");
const source = (...parts) => readFileSync(resolve(root, ...parts), "utf8");

test("operational finance capabilities are beta, database-only, and explicitly enabled", () => {
  for (const id of [
    "supplier-invoice",
    "three-way-match",
    "payable-obligation",
    "supplier-credit-memo",
  ]) {
    const disabled = capabilityForEnvironment(id, {
      FLOWCHAIN_PERSISTENCE_MODE: "database",
      FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "false",
    });
    assert.equal(disabled.maturity, "beta");
    assert.equal(disabled.databaseOnly, true);
    assert.equal(disabled.requiresExplicitEnable, true);
    assert.equal(disabled.enabled, false);
    assert.equal(
      capabilityForEnvironment(id, {
        FLOWCHAIN_PERSISTENCE_MODE: "database",
        FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "true",
      }).enabled,
      true,
    );
    assert.equal(
      capabilityForEnvironment(id, {
        FLOWCHAIN_PERSISTENCE_MODE: "json",
        FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "true",
      }).enabled,
      false,
    );
  }
  assert.equal(
    capabilityForEnvironment("finance", {
      FLOWCHAIN_PERSISTENCE_MODE: "database",
      FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE: "true",
    }).maturity,
    "unavailable",
  );
});

test("finance idempotency hash is stable for line ordering and changes with payload", () => {
  const first = {
    invoiceNumber: "INV-1",
    currency: "CNY",
    lines: [
      { receivingLineId: "B", quantity: "2.0000" },
      { receivingLineId: "A", quantity: "1.0000" },
    ],
  };
  const reordered = {
    lines: [...first.lines].reverse(),
    currency: "CNY",
    invoiceNumber: "INV-1",
  };
  assert.equal(
    operationalFinanceRequestHash(first),
    operationalFinanceRequestHash(reordered),
  );
  assert.notEqual(
    operationalFinanceRequestHash(first),
    operationalFinanceRequestHash({
      ...first,
      lines: [{ receivingLineId: "A", quantity: "3.0000" }],
    }),
  );
});

test("P2P schema extends legacy invoice and match models without parallel duplicates", () => {
  const schema = source("prisma", "schema.prisma");
  for (const model of [
    "SupplierInvoice",
    "SupplierInvoiceLine",
    "ThreeWayMatch",
    "ThreeWayMatchLine",
    "FinanceMatchException",
    "PayableObligation",
    "SupplierCreditMemo",
    "SupplierCreditMemoLine",
  ])
    assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.equal((schema.match(/model SupplierInvoice \{/g) || []).length, 1);
  assert.equal((schema.match(/model ThreeWayMatch \{/g) || []).length, 1);
  const migration = source(
    "prisma",
    "migrations",
    "20260718050000_operational_finance_p2p",
    "migration.sql",
  );
  assert.match(migration, /ALTER TABLE "SupplierInvoice"/);
  assert.match(migration, /CREATE TABLE "PayableObligation"/);
  assert.match(migration, /CREATE TABLE "SupplierCreditMemo"/);
  assert.doesNotMatch(migration, /CREATE TABLE "SupplierInvoice"/);
});

test("focused finance routes are registered and exclude generic mutation and payment execution", () => {
  const routes = source("server", "routes", "operational-finance.routes.mjs");
  const server = source("server", "routes", "scm-legacy.routes.mjs");
  const command = source(
    "server",
    "domain",
    "operational-finance-command-service.mjs",
  );
  for (const route of [
    "/api/finance/supplier-invoices",
    "/api/finance/match-exceptions",
    "/api/finance/payables",
    "/api/finance/supplier-credit-memos",
  ])
    assert.match(routes, new RegExp(route.replaceAll("/", "\\/")));
  assert.match(server, /handleOperationalFinanceRoute/);
  assert.doesNotMatch(routes, /generic-finance-mutation|\/api\/finance\/mutate/);
  assert.match(command, /isolationLevel: "Serializable"/);
  assert.match(command, /businessCommandExecution/);
  assert.doesNotMatch(command, /\.payment\.(?:create|update|delete)/);
  assert.doesNotMatch(command, /\.journalEntry\.(?:create|update|delete)/);
});
