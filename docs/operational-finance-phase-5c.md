# Phase 5C — Finance Workbench and Product Acceptance

Phase 5C closes the governed Operational Finance product surface without
turning FlowChain into a general-ledger, banking, tax, or settlement system.
PostgreSQL remains authoritative and Runtime JSON is not an authoritative
adapter for return or finance mutations.

## Finance landing and workbenches

The finance landing read model and UI expose counts for:

- supplier invoices awaiting match;
- unresolved match exceptions;
- approved payable obligations;
- customer invoices awaiting issue;
- overdue and disputed receivable obligations;
- supplier credit memos and customer credit notes;
- the currencies in scope and the unconverted multi-currency limitation.

The workbenches provide governed navigation for supplier invoices, three-way
matching, exceptions, payable obligations, supplier credits, customer invoices,
receivables, aging, disputes, and customer credits. A payable obligation is not
shown as paid. A receivable obligation is not shown as collected. External
references remain unverified evidence and never become a settlement fact.

## Capability boundary

The focused capabilities and broad `finance` capability are `beta`,
`databaseOnly`, and `requiresExplicitEnable`. They use the single flag:

```text
FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE=true
```

The broad capability is promoted from unavailable only as part of the Phase 5C
acceptance change. Disabled or non-database execution fails closed. The
capability is not stable and does not imply payment, collection, refund, FX,
tax, journal, ledger, valuation, or accounting-system integration support.

## Currency and access safety

Amounts retain their original ISO currency. Landing and aging models expose
currency groups and `fxConverted: false`; no mixed-currency total or implicit
CNY conversion is produced. Manager and finance-specialist roles may use
governed commands. Viewer access is read-only, and tenant boundaries are
enforced by the signed execution context.

## Acceptance

The PostgreSQL gate validates fresh and Phase 4 upgrade migrations, both P2P
and O2C lifecycles, match review, approval and hold behavior, credits, aging,
multi-currency separation, idempotency, concurrency, isolation, authorization,
error sanitization, evidence, and reconciliation with zero failed and zero
skipped tests.

The Operational Finance browser gate validates the complete P2P/O2C and credit
journeys, AR aging, currency limitations, capability-disabled behavior, and a
read-only viewer. CI runs this gate alongside all Receiving, Reports, Outbound,
Inventory Operations, and Returns/Quarantine browser regressions.

## Explicit exclusions

QuickBooks, general ledger, journals, chart of accounts, bank payment,
collection, refund execution, reconciliation, tax engines or filing, automatic
FX, valuation, FIFO or moving average, COGS, landed cost, payroll, gateways, and
autonomous AI transaction execution remain out of scope.
