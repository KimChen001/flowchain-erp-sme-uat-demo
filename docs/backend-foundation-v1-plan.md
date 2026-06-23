# Backend Foundation v1 Plan

## Purpose

Backend Foundation v1 should be planned before writing backend code so the project can move from a stable frontend milestone into persistence and API work without expanding product scope by accident.

The goal is to create a backend foundation that supports stability, scope control, persistence readiness, auditability, and future API consistency. This plan is not an implementation spec for a full backend rewrite. It is a sequencing and boundary document for the first backend foundation milestone.

The current frontend is in Frontend Scope Freeze / Frontend Stability Milestone. Backend planning should support the existing product shape and should not trigger new frontend features, pages, cards, KPIs, tables, workflows, or UI expansions unless separately scoped.

## Product Boundary

FlowChain is an AI-assisted supply chain and supplier management platform for SMEs.

中文定位：面向中小企业的 AI 辅助供应链与供应商管理平台。

FlowChain is not a full ERP suite. Backend Foundation v1 should support the current supply chain, supplier management, procurement, inventory, forecasting, finance collaboration, reporting, data management, and AI explanation layers without drifting into a generic enterprise system.

The backend should not reposition the product as full ERP. It should provide stable foundations for current modules and preserve existing module boundaries.

## Recommended Implementation Sequence

### Phase 1: Minimal User / Tenant / Role Context

Start with the smallest identity and context layer needed by the existing frontend and future audit records.

Candidate endpoints:

- `GET /api/me`
- `GET /api/tenants/current`

Initial scope:

- Basic user profile context
- Basic tenant context
- Simple role context for UI behavior and audit attribution

This is not full RBAC. It should not include permission matrices, SSO, MFA, policy engines, or complex access control logic. The purpose is to establish who is acting, which tenant context they are in, and what simple role label should be attached to future audit entries.

### Phase 2: Basic Audit Log Foundation

Add a small audit log foundation before broad transactional persistence.

Recommended audit fields:

- Actor
- Action
- Module
- Entity type
- Entity id
- Timestamp
- Before/after summary where practical

This is a foundation for accountability and traceability. It is not a full workflow engine. It should record meaningful changes and decisions, but it should not attempt to model every approval path, notification rule, escalation, or state machine in Backend Foundation v1.

### Phase 3: Master Data API / Persistence First

Master Data should be the first persisted domain because it provides canonical records used by procurement, inventory, finance collaboration, SRM, reporting, and imports.

Initial resources:

- Item master
- Supplier master canonical fields
- Warehouse/bin
- Tax code
- Payment terms

Master Data should come before transactional APIs because transactions need stable references. PR, RFx, PO, GRN, invoice, inventory movement, exception, reconciliation, and report APIs all become harder to reason about if supplier, item, warehouse, tax, and payment term identity is not stable first.

### Phase 4: SRM Supplier Profile / Scoring API

After Master Data foundations exist, add SRM APIs that expose supplier-facing read models and scoring snapshots.

Initial resources:

- Supplier profile
- Performance snapshot
- Risk snapshot
- Scoring snapshot
- Scoring rule version

SRM scoring should expose current score, dimension evidence, and rule version in a way that the frontend can display clearly. The API should not imply external risk data or third-party financial data is already connected unless that integration is separately scoped later.

Backend Foundation v1 should not include external supplier integration, supplier external accounts, or supplier invitation flows.

### Phase 5: Procurement / Inventory / Finance APIs

Once identity, auditability, Master Data, and SRM read models are stable, expand into transactional APIs.

Procurement candidates:

- PR
- RFQ
- PO
- GRN

Inventory candidates:

- Inventory movements
- Inventory exception documents

Finance collaboration candidates:

- Supplier invoices
- Credit memos
- Reconciliation visibility

Finance must remain collaboration visibility only. It should not become accounting execution. Backend APIs may expose invoice status, AP/payables visibility, credit offset, reconciliation status, tax split visibility, and settlement readiness, but they should not execute payments, post to GL, file taxes, or integrate with banks.

## Explicit Non-Goals For Backend Foundation v1

Backend Foundation v1 should not include:

- Full RBAC
- SSO / MFA
- GL
- Payment execution / payment engine
- Tax filing
- Bank integration
- Tax bureau integration
- OCR
- Full workflow engine
- Supplier external account invitation
- PostgreSQL deployment
- External integrations
- PDF export
- CRM
- HR
- Full Sales/O2C

## Module Ownership Boundaries

### Master Data

Master Data owns canonical source-of-truth records for item master, supplier master canonical fields, warehouse/bin, tax code, and payment terms.

### SRM

SRM owns supplier profile visibility, performance snapshot, risk snapshot, certification/admission status, sourcing participation summary, contract/catalog summary, supplier collaboration overview, scoring snapshot, and scoring rule version.

### Procurement

Procurement owns PR, RFx, PO, receiving collaboration, invoice collaboration, three-way match, returns, and procurement-side supplier portal visibility.

### Inventory

Inventory owns inventory health, stock visibility, movement ledger, lots/serials, transfers, cycle counts, ABC/XYZ, bin map, and inventory exception documents.

Architecture principle:

- Inventory Movement Ledger answers: "What changed?"
- Inventory Exception Documents answer: "Why did it change and how is the exception closed?"

### Finance

Finance owns supplier invoice register visibility, AP/payables visibility, credit memo offset, supplier reconciliation, settlement readiness, and tax split visibility.

Finance does not own GL, payment execution, tax filing, accounting posting, bank integration, or tax bureau integration.

### Reports

Reports owns read-only cross-module reporting and export paths. It should consume stable read models and should not become a place for writing operational state.

### Data Management

Data Management owns import templates, validation visibility, import history, failed row visibility, and preparation for contextual imports. It should not become the main business workflow layer.

### AI Assistant

AI Assistant owns contextual explanation, evidence-backed guidance, and decision support. It should not own execution, backend business logic, approvals, persistence, or autonomous state changes.

## API Design Principles

Backend Foundation v1 should follow these principles:

- Start with stable canonical resources.
- Prefer small, explicit APIs over broad generic endpoints.
- Separate read models from write intentions where useful.
- Preserve audit attribution on meaningful writes.
- Avoid hiding business rules inside AI Assistant.
- Let AI Assistant explain and recommend, but not own execution or backend business logic.
- Avoid premature infrastructure complexity.
- Keep module boundaries visible in endpoint design.
- Keep Finance as collaboration visibility, not accounting execution.
- Make API responses easy for the current frontend workbench pattern to consume.

## Data Persistence Approach

This document does not choose or implement a database.

Persistence should first be modeled around Master Data and auditability before scaling into transactional APIs. Stable supplier, item, warehouse/bin, tax code, and payment term records should exist before durable PR, RFQ, PO, GRN, invoice, movement, exception, credit, reconciliation, and settlement readiness APIs.

The first persistence design should answer:

- Which canonical records are required by multiple modules?
- Which identifiers need to be stable across imports, reports, AI evidence, and transactional views?
- Which actions need audit attribution?
- Which read models are necessary for current frontend workbenches?

Database deployment, schema migration strategy, and external integration architecture should be planned separately.

## Acceptance Criteria

This document is complete if it:

- Clearly defines Backend Foundation v1 scope.
- Gives a phased implementation order.
- States explicit non-goals.
- Protects frontend scope freeze.
- Preserves FlowChain's SME supply chain/SRM positioning.
- Does not add implementation code.

## Recommended First Backend Planning Output

The next backend task should produce a small technical design for Phase 1 and Phase 2 only:

1. Minimal user/tenant/profile context.
2. Basic audit log shape.
3. No broad persistence migration.
4. No new frontend UI.
5. No full RBAC or workflow engine.

This keeps the backend foundation grounded and prevents the project from jumping directly into broad transaction persistence before the product boundary is stable.
