# Phase 5.2 — Internal Settlement & Cashbook

## Boundary

Phase 5.2 records governed internal cash receipts and disbursements against the
approved payable and receivable obligations already owned by Operational
Finance. It creates an immutable cashbook fact, applies explicit allocations,
updates outstanding obligation amounts atomically, and supports safe reversal.

It does not initiate a bank payment or collection, import a bank statement,
claim that an external reference is verified, create a journal or general-ledger
entry, convert currency, calculate tax, or integrate with QuickBooks. Bank
statement import and matching belong to Phase 5.3.

## Authoritative facts

- `CashbookAccount` is a tenant-owned internal book in exactly one ISO currency.
- `SettlementDocument` is a governed receipt or disbursement instruction.
- `SettlementAllocation` links one settlement to payable or receivable
  obligations. Allocations must equal the settlement amount without cross-
  currency netting.
- `CashbookEntry` is the immutable posted cash fact. Reversal creates an exact
  inverse entry and never edits or deletes the original amount.
- `BusinessCommandExecution` remains the idempotency authority.

## Invariants

1. Signed tenant identity and permission checks are mandatory at every command
   and read boundary.
2. A disbursement allocates only payable obligations; a receipt allocates only
   receivable obligations.
3. Account, settlement, allocation, obligation, and cashbook currency must be
   identical. No FX conversion or mixed-currency total is produced.
4. Allocation totals must equal the settlement amount and may not exceed each
   obligation's outstanding amount.
5. Held payables and disputed receivables cannot be settled.
6. Posting locks the account and every obligation in deterministic order under
   a serializable transaction.
7. A cashbook account cannot become negative.
8. Reversal restores obligation balances, creates one inverse cashbook entry,
   and is rejected if the restoration would violate current obligation facts.
9. Reconciliation is per allocation and account. Offset errors cannot net to a
   false `matched` result.
10. Amounts and counterparty snapshots are redacted by the server when their
    field permissions are absent.

## Permissions

- `finance.cashbook.read`
- `finance.cashbook.manage`
- `finance.settlement.read`
- `finance.settlement.create`
- `finance.settlement.post`
- `finance.settlement.reverse`
- `finance.settlement.reconciliation.read`

Posting and reversal additionally require `finance.amounts.read`. Permission
presence remains distinct from the `internal-settlement` and `cashbook`
capabilities.

## Acceptance

The database gate must cover fresh and upgrade migrations, receipt,
disbursement, partial and full allocation, multi-obligation allocation,
idempotency replay/conflict, concurrent over-allocation, tenant isolation,
permissions, held/disputed boundaries, currency mismatch, insufficient account
balance, exact reversal, unsafe reversal, immutable cash facts, reconciliation,
field redaction, audit, and capability-disabled behavior. API and Playwright
gates must include direct unauthorized calls rather than relying on hidden UI.
