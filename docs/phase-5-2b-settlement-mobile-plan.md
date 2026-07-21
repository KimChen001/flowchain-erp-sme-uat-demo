# Phase 5.2B Settlement Workflow & Mobile Operations Foundation

## Baseline and audit

- Base is `326f502b048fd93494aaa37b920838234225abac` (`origin/main`). The published tag `v0.5.2-internal-settlement-cashbook` is not modified.
- The isolated worktree is `scm-procurement-worktree`; the original `scm-source` worktree is out of scope and remains untouched.
- Existing settlement facts are the single source of truth: `CashbookAccount`, `SettlementDocument`, `SettlementAllocation`, `CashbookEntry`, `PayableObligation`, and `ReceivableObligation` are defined in `prisma/schema.prisma` and are written by `server/domain/internal-settlement-command-service.mjs`.
- Existing create/preview/post/reverse commands already use `BusinessCommandExecution`, Serializable transactions, tenant-scoped authorization, optimistic versions, exact cashbook reversal, and audit logs. The read model is `server/domain/internal-settlement-read-service.mjs`; it must remain backward compatible and must project legacy `status` from the new lifecycle fields during the transition.
- Existing UI is `src/modules/finance/InternalSettlementWorkbench.tsx` and routes are registered in `src/app/routeRegistry.tsx`. The new workbench actions are additive and keep existing API paths operational.
- Payable/receivable outstanding changes are performed by the existing settlement command; no second obligation or settlement aggregate will be introduced.
- Purchase-order approval is currently owned by the canonical procurement workflow/route service (`server/routes/purchase-orders.routes.mjs` and its domain service). Mobile approval is a read facade plus a call to that command, never a second PO state machine.
- Receiving is owned by `server/domain/receiving-posting-command-service.mjs` and its policy/read services. Mobile receiving will create/read the same `ReceivingDocument`, then call the same post service so GRN, `InventoryMovement`, and `InventoryBalance` remain authoritative.
- Authorization is centralized in `server/auth/authorization-service.mjs` and the permission catalog in `server/auth/permission-catalog.mjs`. New mobile permissions are additional requirements and do not replace module, finance amount, field-visibility, or warehouse-scope checks. Any legacy role checks found in compatibility/bootstrap paths remain compatibility-only; new paths use permission codes.
- Capabilities are registered in `server/domain/capability-registry.mjs`; the three new capabilities are database-only, beta, explicitly enabled, and default disabled.
- Audit evidence is `AuditLog`; `DocumentLink` is the existing relationship evidence model. There is no generic sync feed, signed cursor, device registration, upload, or business attachment model yet.
- Numbering is currently workspace settings JSON (`settings-runtime-repository.mjs`), not a relational numbering table. New document numbers use the existing numbering resolver and remain tenant scoped.
- Signed sessions are provided by `server/domain/local-signed-session.mjs`; synchronization fingerprints are derived from the authoritative actor permissions, role IDs, warehouse scopes, field groups, enabled modules, and capability state.

## Reuse and additive schema

Migration `20260720020000_settlement_workflow_mobile_foundation` is additive only. It extends `SettlementDocument` and `SettlementAllocation`, backfills lifecycle projections, and adds `PartnerAdvance`, `AdvanceApplicationDocument`, `InternalTransferDocument`, `SettlementAttachment`, `DomainChangeFeed`, and `SyncClient`. Existing migration `20260720010000_internal_settlement_cashbook_foundation` and all published facts remain unchanged.

Settlement lifecycle authority is `workflowStatus` plus `postingStatus`; legacy `status` is retained as a compatibility projection (`draft/unposted`, `posted/posted`, `reversed/reversed`, `cancelled/unposted`). Posted facts are immutable and only reversible. Preview and post share one domain plan.

`PartnerAdvance` is one-partner, one-currency, tenant scoped and tracks original/applied/remaining amounts. `AdvanceApplicationDocument` applies an advance to exactly one payable or receivable without a cashbook entry and supports partial application and exact reversal. Settlement allocations gain cash, discount, and total amounts; settlement totals are explicit and cannot net unrelated allocations. Internal transfers create atomic, same-currency outflow/inflow entries in a stable account-lock order and reverse both entries together.

Attachments store metadata and an upload reference only. Binary content is outside business JSON and the change feed. Tenant ownership, MIME/size/hash, expiry, tombstone deletion, permission checks, and post history immutability are enforced by the upload/attachment boundary.

## Workflow and segregation

Commands added are `reviseSettlement`, `submitSettlement`, `approveSettlement`, `rejectSettlement`, `cancelSettlement`, `previewSettlementPosting`, `postSettlement`, and `reverseSettlement`, plus the equivalent internal-transfer commands. Existing create/post/reverse routes remain compatible, with direct post restricted by the new approval policy unless an explicit compatibility policy allows it.

Workspace policy defaults are `settlementApprovalRequired=true`, `settlementSelfApprovalAllowed=false`, `settlementSelfPostingAllowed=true`, `settlementApprovalThreshold=0`, and `settlementDiscountThreshold=0`. Creator/approver/poster separation is evaluated from permissions and policy, never from an Admin role name. Overrides are audited.

## Mobile authority and conflict model

`DomainChangeFeed` records only tenant-scoped entity metadata, versions, operation, actor/request identifiers, payload hash, and sensitivity groups inside the same business transaction. It never stores full payloads, amounts, partner snapshots, or attachment bytes. Reads are reloaded through formal read services and re-authorized at sync time.

`SyncClient` stores a hash of the device identifier, supports multiple devices per user, rejects cross-tenant reuse and revoked clients, and acknowledges an opaque signed cursor. Cursor claims are tenant/user/device scoped, versioned, include the authorization fingerprint and last sequence, and fail closed when `FLOWCHAIN_SYNC_CURSOR_SECRET` is absent in production. A changed fingerprint returns `SYNC_AUTHORIZATION_CHANGED` with `resetRequired=true` and forces protected-cache eviction and initial sync.

Draft mutations accept idempotency, `If-Match`, client mutation/device/platform/version/timestamp metadata. Server time is authoritative. Same key plus same payload replays; same key plus different payload returns 409. Formal actions never auto-merge. Version conflicts return `SYNC_VERSION_CONFLICT` with current read model, visible fields, and available actions.

The unified task inbox is generated from business state and effective permissions, with amount and partner redaction and warehouse scope filtering. PO tasks call the canonical PO approval command. Receiving tasks call the canonical receiving post service and therefore preserve partial receipts, over-receipt checks, GRN, and inventory mathematics. Offline actions show `Pending Sync` until server confirmation; a second device with a stale version receives 409.

## Delivery order

1. Add capability/permission catalog entries and additive migration with backfill.
2. Implement settlement workflow, policy, advances, discounts, transfers, attachments, and feed writes while preserving existing facts and routes.
3. Implement signed cursor, sync clients/feed APIs, authorization reset, mutation conflict contracts, and task inbox.
4. Add PO approval and receiving mobile facades that call canonical services.
5. Add responsive web reference routes/workbenches, focused DB/API/browser gates, and CI wiring.
6. Run the complete regression suite, verify worktree/SHAs, and prepare feature/release branches without changing published history.

## Explicit exclusions

No bank import/matching/execution, payment rails, GL/journals/tax/FX, QuickBooks, native iOS/Android, push/biometric login, barcode hardware, lot/serial scanning, or AI automatic approval/posting is in scope for this phase.
