# Phase 5.3 Bank Statement Import and Settlement Reconciliation Plan

Date: 2026-07-22  
Base: `bffa47bc315ea728fffe07faef6fd9c2fc672173`  
Branch: `codex/bank-statement-reconciliation`

## Acceptance boundary

Phase 5.3 imports user-supplied CSV/XLSX statement evidence and creates controlled links between immutable imported bank lines and already-posted internal cashbook facts. It does not initiate or verify a bank payment, read a live bank balance, modify a posted cashbook entry, mutate receivables/payables, create a general-ledger entry, perform FX, or connect to a bank API. The capability is PostgreSQL-only, disabled by default, and has no JSON fallback.

## Coding-before audit

| Area | Existing authority and decision |
| --- | --- |
| CashbookAccount | PostgreSQL authority with `accountType`, ISO currency, four-decimal balances, active status, and optimistic `version`. Bank import may target only active `bank`, `payment_platform`, or explicitly allowed account types; it does not recalculate cashbook balances. |
| CashbookEntry | Posted internal fact. Formal amount is positive `amount Decimal(18,4)` and formal direction is `inflow`/`outflow`; balance before/after is evidence, not an import target. Bank credit maps to inflow and bank debit maps to outflow. |
| Cashbook reversal | A new `entryType=reversal` entry has the opposite direction and `reversalOfEntryId`; the original receives `reversedByEntryId`. Phase 5.3 never edits either amount and raises an integrity exception when a reconciled source entry is later reversed. |
| SettlementDocument / SettlementAllocation | A posted settlement creates the cashbook entry and links payable/receivable allocations. Bank reconciliation references the cashbook entry and optionally snapshots the settlement ID; it does not reuse internal obligation allocation semantics. |
| InternalTransferDocument | Posting creates two cashbook entries, one per account/direction. Each side is reconciled independently against a statement for that same cashbook account; the transfer ID remains supporting evidence. |
| PartnerAdvance and supplier/customer workflows | They are downstream/internal settlement facts only. Bank matching must not create, settle, reopen, or otherwise mutate them. |
| Existing internal reconciliation | `finance.settlement.reconciliation.read` proves internal settlement/allocation/cashbook arithmetic. Bank reconciliation is a separate external-evidence relationship and must use separate models and status language. |
| Attachments and staged uploads | `StagedUpload` stores PostgreSQL metadata while `AttachmentStorageProvider` stores bytes durably outside business JSON. Hash verification, path confinement, health/orphan diagnostics, audit, and restart durability are reusable. Bank CSV/XLSX MIME types and size limits require a bank-specific staging policy; bytes never enter a domain change payload. |
| SettlementAttachment / ReceivingAttachment | Their bind/download patterns are reusable, but their domain relationships and permissions are not. A bank batch references its own staged upload rather than masquerading as settlement/receiving evidence. |
| Generic ImportBatch / repository / Pilot Import Service | File naming, preview concepts, issue presentation, and idempotency patterns are reusable. The generic model stores normalized rows in JSON and commits master/operational objects, so it is not bank authority. Bank import gets dedicated mapping, batch, row, and immutable line models. |
| Browser CSV/XLSX components | Header mapping and preview UX can be reused. Formal parsing moves server-side; existing browser helpers use `Number` and must not perform authoritative bank amount math. The installed `xlsx` parser can read cached cell values with formulas/external links rejected. |
| BusinessCommandExecution | Reused for tenant + command + idempotency key, canonical request hashes, replay, and different-payload conflict. Confirm/reverse execute in serializable transactions. |
| AuditLog / DomainChangeFeed | Audit records full controlled decisions with redacted metadata. Change feed contains identifiers, versions, hashes, sensitivity groups, module/permission class, and never raw statement rows or file bytes. |
| Mobile sync | Existing entity policy is fail-closed by capability, permission, tenant, field groups, and tombstone context. Batch, line, group, and exception receive read-only finance projections. Mobile mutation endpoints are not added. |
| Authorization and field visibility | All API operations resolve a signed provisioned actor and call `authorize`/`assertAuthorized`. `finance.amounts.read` controls amount fields; `finance.partner_snapshot.read` controls counterparty/account identifiers. No role-name authorization. |
| Workspace locale/timezone/currency | Tenant defaults exist. Mapping timezone controls date conversion; batch/account currency must match and FX is rejected. UI uses the existing zh-CN/en-US context and responsive shell. |
| Decimal policy | Existing finance fixed-point helpers use scaled `BigInt` and reject more than four decimals. Bank parsing receives an independent fixed-point normalizer with no `Number`/`parseFloat` in authoritative amount calculations. |
| Numbering rules | Existing workspace numbering settings do not yet define bank batches/groups. Phase 5.3 creates deterministic tenant-scoped `BST-*` and `BR-*` identifiers without changing existing rules; metadata records that limitation for later configurable numbering. |
| Parsing support | `xlsx` is already installed; UTF-8/BOM CSV is present only in browser helpers. Server-side delimiter, GB18030 (`TextDecoder`), locale-date, Excel serial-date, sign convention, and security-limit handling must be added and tested with fictitious fixtures. |
| Sensitive storage review | Existing cashbook accounts do not store online-banking secrets. Phase 5.3 stores only masked account identifiers plus SHA-256 hashes in ordinary projections. Mapping metadata is rejected if it contains secret/password/token/certificate/private-key fields. Raw rows remain permission-protected staging evidence. |

Phase 5.3 preserves the existing cashbook mathematics and does not create a second cashbook.

## Bank Statement Authority Plan

1. Add additive PostgreSQL models for versioned mapping templates, import batches, staging rows, immutable statement lines, deterministic candidates, reconciliation groups, bank/cashbook allocations, and integrity exceptions.
2. `BankStatementLine` is the authority for an imported external line after commit. It is append-only apart from controlled status/projection changes. Its positive amount and independent credit/debit direction cannot be client-mutated.
3. `BankReconciliationGroup` is the authority for a human-confirmed relationship. Confirmed allocations—not client status fields—derive matched and remaining amounts.
4. Confirmation locks the group, all referenced statement lines, and all cashbook entries in a serializable transaction; the server recomputes totals, account, currency, direction, reversals, and prior allocations.
5. Reversal retains allocations, marks the group reversed, releases derived allocation projections, writes audit/change-feed evidence, and never changes a cashbook or obligation amount.
6. A confirmed group with reversed/voided/missing evidence is not presented as fully matched; an explicit exception carries the mismatch conclusion.

## Import Reuse Plan

Reusable: durable staging provider, SHA-256 verification, upload lifecycle, CSV header/preview UX concepts, `xlsx` dependency, API error envelopes, signed identity, idempotency, audit, and PostgreSQL transaction harnesses.

Not reusable as authority: generic `ImportBatch`, JSON `normalizedRows`, browser `Number` conversion, Pilot Import business commits, and direct CSV/XLSX-to-domain-object paths. Bank parsing always stages bytes first, writes dedicated rows, validates/duplicates independently, and creates formal lines only on explicit commit.

## Reconciliation Invariant Plan

- Same tenant, cashbook account, ISO currency, and mapped direction across each group.
- Only active statement lines and posted, unreversed cashbook entries are eligible.
- Four-decimal positive allocations cannot over-allocate either side across confirmed non-reversed groups.
- Confirmed bank total equals confirmed cashbook total exactly; difference is zero. No cross-account, cross-currency, credit/debit netting, FX, fee, adjustment, or write-off.
- One-to-one, one-to-many, many-to-one, many-to-many, and partial allocations use the same group/allocation mathematics.
- Candidates are deterministic, ordered by score/evidence/stable IDs, algorithm-versioned, replaceable suggestions only, and never auto-confirmed.
- Exact file duplicate is tenant + account + SHA-256. Exact transaction duplicate prefers account + bank transaction ID and otherwise uses a canonical fingerprint. Possible duplicates remain warnings with audited human decisions.
- Full-statement validation uses `closing = opening + credits - debits`; transaction exports explicitly cannot prove period completeness.

## Security and Redaction Plan

- Capability `bank-statement-reconciliation` requires database persistence and `FLOWCHAIN_ENABLE_DB_BANK_RECONCILIATION=true`; API, navigation, sync, and AI fail closed otherwise.
- Separate system permissions cover mapping, import lifecycle, candidate generation/dismissal, confirmation/reversal, exception resolution, read, and export. Default grants follow the specification and never inspect role names at runtime.
- Server trusts only signed identity, route resource IDs, persisted rows, and recomputed amounts/scores. Body tenant/actor/totals/duplicate/score fields are ignored or rejected.
- File extension, MIME, size, sheet, and row limits are enforced. XLSM, macros, formulas, external links, malformed ZIP/XLSX, and unsupported encodings fail with stable codes. Only cached non-formula values are accepted.
- Full account values are used transiently to compute SHA-256 and a last-four mask; they are never returned or placed in change feed, audit summaries, or normal projections.
- Row raw data is visible only with bank-statement read permission and is separately redacted for amount/partner field groups.

## Mobile Sync Plan

- Register `BankStatementImportBatch`, `BankStatementLine`, `BankReconciliationGroup`, and `BankReconciliationException` under module `finance`, capability `bank-statement-reconciliation`, their read permissions, amount/partner sensitivity, a projection loader, and fail-closed tombstones.
- Expose batch status, unmatched/exception counts, reconciliation state, and desktop deep links only. Do not expose mappings, raw rows, file contents, allocations for mutation, confirm/reverse/void/override operations, or AI-private context.
- Add a read-only `bank_reconciliation_exception` inbox item only when both `mobile.tasks.read` and `finance.bank_reconciliation.read` are granted.
- Close Phase 5.2C.1 acceptance debt in browser evidence: Device B owns its SyncClient/cursor from initial through incremental/ack; attachment upload/bind/download spans two API processes using the same PostgreSQL and durable storage.

## Test Plan

- Parser gate: real fictitious UTF-8, BOM, GB18030, XLSX, Excel date, formula rejection, delimiter/mode/date/decimal/security limits, and malformed fixtures.
- PostgreSQL gate: fresh/upgrade migration, permissions/capability, tenant isolation, mapping history, import validation/duplicates/balance/immutability/void, every allocation topology, partial/over-allocation, deterministic candidates, idempotency/concurrency, reversal/exceptions, redaction, audit/change feed, sync/tombstones.
- Evidence gate: independently recompute file/mapping/source/line/candidate/allocation/actor/time/reversal/audit/change-feed/source-document evidence and return only `matched`, `mismatch`, or `unavailable`.
- API gate: all specified endpoints, signed identity, capability/permission/tenant/actor/amount/score forgery, stable errors, idempotency, version conflicts, redaction, and durable upload binding.
- Browser gate: import wizard and reconciliation workspace in zh-CN/en-US, desktop and 768x1024, no page overflow, manual confirmation, reversal/integrity status, permission/redaction/capability boundaries, and both carried acceptance-debt scenarios.
- Regression: preserve every existing Phase 5.2/5.2B/5.2C/5.2C.1 command and add all five Phase 5.3 commands to Verify/Browser CI at the final feature SHA.

## Delivery order

1. Commit this authority plan.
2. Add schema and additive migration, then permissions/capability.
3. Add secure parser and fictitious fixtures.
4. Add mapping/import validation and immutable line services/routes.
5. Add deterministic candidates, grouped confirmation/reversal/exceptions/read models.
6. Register mobile projections and UI navigation/workbench.
7. Add parser, PostgreSQL, evidence, API, browser, lifecycle-debt, and CI gates.
8. Run all local gates, publish the feature, verify feature CI/eight gates, then perform the prescribed release PR/merge/main CI/annotated-tag closeout without rewriting history.
