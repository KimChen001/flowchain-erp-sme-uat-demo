# Current Development Limitations v1

## Current State

FlowChain is currently a local JSON-backed development project. It is suitable for product walkthroughs, workflow validation, architecture review, and repeatable local testing.

It is not production-ready SaaS infrastructure.

## Data and Persistence

- Current local data is deterministic and stored in JSON for development.
- There is no production database yet.
- There is no RDS, PolarDB, or ORM-backed production runtime connection.
- `DATABASE_URL` is not required for normal test/build/runtime behavior.

## Draft-first Boundary

- Action drafts are preview-only.
- Purchase request draft preview does not create a purchase request.
- RFQ draft preview does not create an RFQ.
- Supplier follow-up draft preview does not send supplier messages.
- Exception case draft preview does not create a case until explicitly confirmed.
- Confirm/submit behavior remains disabled or future-work unless a later round explicitly implements it.
- No autonomous AI execution is implemented.

## AI Boundary

- External AI providers are disabled by default.
- Placeholder API keys do not activate provider calls.
- Deterministic local AI paths answer supported cockpit, procurement, inventory, supplier, RFQ, planning, and draft-preparation prompts.
- AI answers should include business evidence where supported.
- Audit persistence failures must not break read-only AI answers.

## Business Scope Limits

The current project does not implement:

- full ERP coverage;
- SAP/Oracle replacement behavior;
- full finance or GL;
- payment execution;
- tax filing;
- bank integration;
- CRM/customer lifecycle suite;
- HR/payroll;
- complex WMS execution;
- real supplier message sending;
- production-grade authorization and tenant isolation.

## Operational Limits

- Some legacy/manual write routes still exist as local compatibility surfaces.
- Repository and persistence boundaries are being introduced incrementally.
- Future database adapters should satisfy the same read/draft/safety contracts before replacing JSON-backed behavior.
