# Roadmap v1

## Completed Foundation

The current foundation includes:

- canonical evidence links;
- navigation recovery;
- AI cockpit timeout fast path;
- AI provider safety gate disabled by default;
- AI audit latency hardening;
- draft-first action boundary;
- Action Draft Review UI shell;
- PR/RFQ/supplier follow-up draft previews;
- draft-first workflow integration;
- typography token consolidation;
- Overview evidence builder extraction;
- database entity model v2 documentation;
- system harness and product review;
- demo scenario pack and product narrative.

## Current UAT Scope

The current FlowChain scope is a JSON/demo-data-backed UAT demo for:

- Today Cockpit;
- procurement/P2P visibility;
- purchase requests;
- RFQs;
- purchase orders;
- receiving/GRN;
- inventory and inventory exceptions;
- SRM;
- master data;
- forecast/MRP;
- AI Assistant;
- finance collaboration visibility;
- reports/imports/data management.

Current behavior is not production persistence and not full ERP coverage.

## Next Phase: Repository Adapter Boundary

Prepare adapter-ready persistence while keeping default JSON behavior stable:

- lock current JSON behavior with contract tests;
- introduce persistence mode defaulting to JSON;
- introduce an adapter registry;
- keep database adapter placeholders non-runtime until a future ORM/database round.

## Next Phase: Action Draft / Audit Persistence

ActionDraft and AuditLog are the safest first persistence candidates because they do not directly mutate procurement or inventory business documents.

Planned direction:

- repository methods for schema, preview, validation, future persist, future confirm;
- audit repository methods for list and best-effort record;
- keep preview-only behavior;
- keep read-only AI answers resilient to audit write failures.

## Next Phase: Master Data Persistence

Master Data is the safest read-domain adapter after ActionDraft/AuditLog.

Planned direction:

- item repository reads;
- supplier repository reads;
- warehouse/payment term/tax code references;
- response compatibility with current read models;
- no write APIs in this phase.

## Next Phase: Procurement Read Persistence

Procurement read models should move gradually behind adapters:

- documents;
- document detail;
- links;
- followups;
- summary;
- evidence helpers.

No PR/RFQ/PO/GRN/invoice write migration should happen until read contracts are stable.

## Next Phase: Inventory Read Persistence

Inventory read models should move gradually behind adapters:

- items;
- lots;
- serials;
- movements;
- exceptions;
- summary;
- evidence helpers.

No inventory posting, exception closure, or stock mutation should be introduced in the read-adapter phase.

## Future Controlled Write Workflows

Future write workflows should be explicit confirmation flows, not autonomous AI execution.

Possible future confirmations:

- confirm draft PR;
- confirm draft RFQ;
- record supplier follow-up;
- confirm inventory exception closure.

Each future write should include:

- user confirmation;
- permission checks;
- validation;
- audit event;
- repository-backed persistence;
- rollback/error behavior appropriate for the final persistence layer.

## Non-goals

- Do not claim production readiness.
- Do not replace SAP/Oracle/full ERP systems.
- Do not add full finance/GL.
- Do not add payment execution.
- Do not add tax filing.
- Do not add bank integration.
- Do not add CRM, HR, sales order center, or customer center.
- Do not enable external AI by default.
- Do not add autonomous AI execution.
- Do not add production database runtime behavior until an explicit database/ORM round.
