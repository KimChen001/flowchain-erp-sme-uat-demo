# Phase 5B — Order-to-Cash Operational Finance

Phase 5B connects posted outbound and customer-return facts to governed
operational-finance records. PostgreSQL is authoritative. The implementation
does not execute collections, refunds, foreign-exchange conversion, or general
ledger entries.

## Transaction chains

`Posted Shipment → Customer Invoice → Receivable Obligation → Aging / Dispute`

`Posted Customer Return Receipt + Original Customer Invoice → Customer Credit Note`

Customer invoices reconcile each line to a posted, non-reversed shipment,
sales-order line, item/SKU, shipped quantity, currency, and authoritative
sales-order price. Drafts do not consume shipped quantity; submission performs
the locked cumulative shipped-not-invoiced check. Issuing an approved invoice
creates one open receivable obligation but does not record a collection.

Customer credit notes reconcile each line to both the original invoice line and
the posted customer return receipt lineage. Quantity cannot exceed returned,
invoiced, or not-yet-credited quantity. Approval reduces receivable outstanding
amount and records approved credit; it does not execute a refund.

## Aging and currencies

Aging uses the workspace IANA timezone and calendar-day buckets:

- Current
- 1–30
- 31–60
- 61–90
- 90+

Amounts are grouped by original ISO currency. Multiple currencies are marked
`multi_currency_unconverted`; `fxConverted` remains `false`.

## Governance

- Serializable transactions and deterministic row locking
- Command idempotency through `BusinessCommandExecution`
- Optimistic versions and preview/execute parity
- Signed tenant and provisioned-role enforcement
- Before/after evidence in `AuditLog`
- Focused beta capabilities: `customer-invoice`,
  `receivable-obligation`, and `customer-credit-note`
- Database-only, explicitly enabled through
  `FLOWCHAIN_ENABLE_DB_OPERATIONAL_FINANCE=true`
- Broad `finance` capability remains unavailable until the Phase 5 acceptance
  gate

## Acceptance commands

```text
npm run db:generate
npm run typecheck
npm run build
npm test
npm run test:db:operational-finance
npm run test:api:operational-finance
```

The PostgreSQL gate covers a fresh migration, a Phase 4 upgrade, P2P regression,
O2C invoice and receivable lifecycles, timezone aging, multi-currency
separation, disputes, external unverified settlement references, customer
credit notes, tenant isolation, role enforcement, idempotency, and the absence
of payment/refund/ledger mutations.
