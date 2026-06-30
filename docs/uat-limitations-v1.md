# UAT Limitations v1

## Demo State

FlowChain is currently a local JSON/demo-data-backed UAT demo. It is suitable for product walkthroughs, workflow validation, architecture review, and repeatable local testing.

It is not production-ready SaaS infrastructure.

## Data and Persistence

- Demo data is local and deterministic.
- The current default data source is JSON/demo data.
- There is no production database yet.
- There is no RDS, PolarDB, or ORM-backed runtime connection.
- `DATABASE_URL` is not required for normal test/build/runtime behavior.

## Draft-first Boundary

- Action Drafts are preview-only.
- PR draft preview does not create a real purchase request.
- RFQ draft preview does not create a real RFQ.
- Supplier follow-up draft preview does not send supplier messages.
- Confirm/submit behavior remains disabled or future-work unless a later round explicitly implements it.
- No autonomous AI execution is implemented.

## AI Boundary

- External AI providers are disabled by default.
- Fake API keys do not activate provider calls.
- Deterministic local AI paths answer supported cockpit, procurement, inventory, supplier, RFQ, and draft-preparation prompts.
- AI answers should include business evidence where supported.
- Audit persistence failures must not break read-only AI answers.

## Business Scope Limits

The current UAT demo does not implement:

- full ERP coverage;
- SAP/Oracle replacement behavior;
- full finance or GL;
- payment execution;
- tax filing;
- bank integration;
- CRM;
- HR;
- sales order center;
- customer center;
- OCR;
- PDF export;
- xlsx export;
- real supplier message sending;
- production-grade authorization and tenant isolation.

## Operational Limits

- API routes are built for demo/UAT behavior.
- Some legacy/manual write routes still exist as demo surfaces.
- Repository and persistence boundaries are being introduced incrementally.
- Future database adapters should satisfy the same read/draft/safety contracts before replacing JSON-backed behavior.
