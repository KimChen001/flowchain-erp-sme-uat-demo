# Phase 5.3.1 Bank Data Security and Reconciliation Control Hardening

## Baseline and scope

- Base: `fcf89a3cc43d045d111053f306ce0abd8af3a8c6` (`v0.5.3-bank-statement-reconciliation`).
- Preserve the existing `bank-statement-reconciliation` capability, routes, stable command semantics, Decimal arithmetic, Cashbook/AP/AR amounts, confirm/reverse behavior, and immutable imported evidence.
- Add only projection, authorization, validation, reconciliation-control, mobile aggregate, tenant-integrity, tests, and CI hardening.

## Audit

The bank routes delegate directly to `bank-statement-service.mjs` and `bank-reconciliation-service.mjs`. The statement service used object spreads in batch, row, and line projections; mapping list/get returned Prisma rows. Import `rawData` was returned to every bank reader, `overrideData` inherited historical projected values, and hash fields were only overwritten with `undefined`. Mapping `columnMapping` and `metadata` had no pre-persistence secret validator. `validateBatch` checked committed lines but did not maintain same-batch transaction/fingerprint sets; `commitBatch` depended on validation and database constraints.

The reconciliation service used Prisma `groupInclude` with raw bank lines, Cashbook entries, settlements, transfers, and exceptions. Candidate, group, and exception projections spread those records. Candidate generation compared against original Cashbook amount and required an over-concatenated document string. `listGroups`, `getGroup`, and `listExceptions` called the writing `detectExceptions`. Resolution marked a group matched when the last stored exception closed without revalidating business facts. Mobile sync mapped `unmatchedCount` from `importedLineCount`. AI finance collaboration currently does not read Bank models; future bank context must use the explicit DTO boundary. The Phase 5.3 migration has tenant-scoped group/bank-line relations but single-column Candidate/Cashbook/Settlement/Transfer/Exception relations that require additive composite FKs.

Audited serialization paths: mapping, batch, import row, bank line, candidate, reconciliation group, bank allocation, Cashbook allocation, settlement/internal-transfer summary, exception, mobile change-feed projection, tombstone, and AI finance response. Audited permissions: `finance.bank_statement.read`, `finance.amounts.read`, `finance.partner_snapshot.read`, and `finance.bank_reconciliation.read`.

## Confirmed defects

- Import Row `rawData` is not trimmed by Amount/Partner permissions; historical `overrideData` is not recursively redacted.
- Reconciliation Group nested relations can expose amounts, partner/account data, hashes, metadata, and entire Prisma records.
- Mapping secret validation is absent from the persistence boundary.
- Validation lacks deterministic same-batch duplicate sets.
- Candidate generation ignores confirmed Cashbook allocations and uses weak document/reference matching (`bank-match-v1`).
- GET requests write integrity exceptions; exception resolution does not revalidate underlying invariants.
- Mobile `unmatchedCount` uses imported count rather than active line status.
- Candidate/allocation/exception relations are not all tenant-composite foreign keys.

## Implementation gates

1. Explicit allowlisted DTO builders and shared classification policy; recursive raw/override sanitizers default unknown fields to redacted and never expose secrets/internal hashes.
2. Mapping validator runs before create/update transactions and exposes only violating paths.
3. Validation and commit recheck same-batch and committed duplicates.
4. Candidate v1.1 uses confirmed-allocation remaining capacity and deterministic token scoring.
5. GET paths are read-only; explicit integrity refresh command writes exceptions; resolution revalidates facts.
6. Mobile uses active line aggregates; additive migration audits tenant mismatches then installs composite FKs/indexes.
7. PostgreSQL/API/candidate/browser gates and CI commands cover security matrices and regressions.

## Non-goals

No parser or Cashbook rewrite, no confirm/reverse mathematics change, no bank API/payment, fee posting, FX, GL/tax, Universal Intake, Action Proposal, or AI Chat capability expansion.
