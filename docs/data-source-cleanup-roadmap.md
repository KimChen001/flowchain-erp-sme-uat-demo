# Data Source Cleanup Roadmap

## Purpose

This roadmap describes how FlowChain can move from mixed frontend static data and backend JSON runtime data toward backend/API source-of-truth over time without breaking the product.

This is an internal architecture planning document. Customer-visible UI should continue using neutral product language and should not expose implementation labels such as demo data, sample data, or UAT data.

## Current Data Reality

Current sources are mixed:

- Some UI modules still use frontend static data from `src/data/demo-data`.
- Some backend APIs read and write data from `data/scm-demo.json`.
- AI Chat now uses backend domain helpers and API-backed data for many operational queries.
- ECS deployment may store the JSON file on server disk, but this remains file-based persistence, not RDS or PolarDB.

The current state is useful for fast product iteration, but it creates duplication risk. The same business entity can appear in frontend constants, backend JSON, and backend domain helper normalization.

## Target State

The target data posture:

- Backend APIs become the source of truth.
- Frontend modules fetch business data from backend APIs.
- `src/data/demo-data` becomes seed, fallback, or development fixture only.
- `data/scm-demo.json` becomes seed/import fixture before database migration.
- Future production uses database-backed persistence such as PostgreSQL, MySQL, RDS, or PolarDB.

AI Chat should continue going through backend `/api/ai/chat`; the frontend should not construct business answers from local static data.

## Source Types

Likely source types to track:

- frontend static constants
- backend JSON runtime data
- backend domain helpers
- backend REST APIs
- external AI provider later
- future database

The source type should be explicit in architecture notes and internal code comments when it affects behavior.

## Phase 0: Inventory Current Data Dependencies

Goals:

- List modules importing `src/data/demo-data`.
- List modules already using backend APIs.
- Identify duplicated entities across frontend constants and backend JSON.
- Identify fields used only for UI decoration vs actual business logic.
- Identify modules where stale frontend constants can disagree with backend runtime data.

Suggested audit output:

- module name
- imported data constants
- backend endpoint coverage
- write behavior, if any
- activeContext dependencies
- AI Chat card dependencies
- migration risk

## Phase 1: Source-of-Truth Decision

Recommended ownership:

- Master Data: backend APIs and domain helpers
- Supplier profiles: backend API/domain
- Inventory item/risk/status: backend API/domain
- Procurement PR/RFQ/PO/Receiving: backend API/domain
- AI Chat: always through backend `/api/ai/chat`
- Reports: backend aggregation APIs when available
- Finance visibility: backend API/domain, read-only first

The frontend can keep fallback snapshots temporarily, but the primary business path should prefer backend APIs.

## Phase 2: Read API Migration

Goals:

- Replace frontend demo-data imports module by module.
- Start with modules where backend APIs already exist.
- Keep fallback snapshots only for service unavailable cases if needed.
- Avoid customer-visible wording that exposes seed, sample, UAT, or demo implementation details.
- Keep response shapes stable enough that modules can migrate gradually.

Suggested order:

1. Master Data
2. SRM supplier profiles
3. Inventory item/risk/status
4. Procurement PR/RFQ/PO/Receiving
5. AI Assistant activeContext and cards
6. Reports
7. Finance visibility

## Phase 3: Write API and Draft Persistence

AI draft preparation should remain review-only first.

Later draft persistence can store:

- draft metadata
- missing fields
- confidence summary
- evidence
- user edits
- audit trail

Rules:

- Do not auto-submit drafts.
- Do not auto-approve business documents.
- Do not convert PRs, send RFQs, post GRNs, or adjust inventory from AI draft preparation.
- Add explicit save draft APIs only after review-state design is clear.

## Phase 4: Data Seed Cleanup

Goals:

- Move seed data into explicit fixture/seed location.
- Avoid mixing seed data with runtime data.
- Make seed loading explicit for local and development usage.
- Keep runtime data writable through backend persistence only.

Recommended direction:

- Keep seed files read-only in normal runtime.
- Keep runtime JSON or database records separate from seed fixtures.
- Add migration scripts only when the target persistence provider is defined.

## Phase 5: Database Transition

Add a persistence provider abstraction:

```env
PERSISTENCE_PROVIDER=json
```

Later providers:

```env
PERSISTENCE_PROVIDER=postgres
PERSISTENCE_PROVIDER=mysql
```

Migration domains:

- tenants
- users
- master data
- suppliers
- inventory items and balances
- purchase requests
- RFQs
- purchase orders
- receiving documents
- audit log
- AI drafts

RDS or PolarDB deployment should wait until schema boundaries stabilize. File-based JSON can remain the initial provider while APIs and source ownership are cleaned up.

## Cleanup Rules

- Do not delete frontend static data before module replacement is ready.
- Do not remove fallback data until API endpoint coverage is complete.
- Do not use `demo`, `sample`, `UAT`, or similar wording in customer-visible UI.
- Internal docs may use implementation terms when needed.
- Prefer neutral product wording in UI.
- Keep data model names stable and business-oriented.
- Keep AI answers grounded in backend evidence and cards.
- Keep activeContext derived from reliable selected entities only.

## High-Priority Modules

1. Master Data
2. SRM supplier profiles
3. Inventory item/risk/status
4. Procurement PR/RFQ/PO/Receiving
5. AI Assistant activeContext and cards
6. Reports
7. Finance visibility

## Non-Goals

- no immediate RDS migration
- no immediate database schema implementation
- no full RBAC
- no workflow engine
- no bank, tax, or payment integration
- no supplier external portal
- no OCR
- no PDF export restoration

## Near-Term Checklist

- Add a source audit table for modules still importing `src/data/demo-data`.
- Mark backend endpoints that already support read operations.
- Prefer backend APIs for new module work.
- Keep AI Chat operating through backend domain helpers.
- Preserve local deterministic behavior while future provider and persistence abstractions are designed.
