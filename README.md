# FlowChain ERP/SCM UAT Demo

FlowChain is an AI-assisted supply chain and supplier management UAT demo for SMEs moving from Excel, email, chat, and manual approvals into structured procurement, inventory, supplier, and finance-collaboration workflows.

It is not a full ERP, not a SAP/Oracle replacement, not a full finance/GL system, not a payment execution system, not a tax system, and not a fully autonomous AI system.

## Current Status

FlowChain is currently a local JSON/demo-data-backed UAT project. It is useful for product storytelling, workflow validation, architecture review, and repeatable local testing. It is not production-ready SaaS infrastructure.

Default runtime behavior remains JSON-backed through `data/scm-demo.json`. No production database, ORM, RDS, or PolarDB connection is required.

## Core Modules

- Today Cockpit
- Procurement / P2P
- Purchase Request
- RFQ / supplier quotation
- Purchase Order
- Receiving / GRN
- Inventory
- Inventory Exception Closure
- SRM
- Master Data
- Forecast / MRP
- AI Assistant
- Finance collaboration visibility
- Reports / Imports / Data Management

## Run Locally

```bash
npm install
npm run api
```

In another terminal:

```bash
npm run dev
```

The frontend proxies `/api` requests to `http://127.0.0.1:8787`.

## Validate

```bash
npm test
npm run test:harness
npm run typecheck
npm run build
```

`npm run build` may report Vite chunk-size warnings; those warnings do not indicate a failed build.

## Key Backend APIs

Read and preview APIs:

- `GET /api/me`
- `GET /api/tenants/current`
- `GET /api/search`
- `GET /api/today-cockpit`
- `GET /api/procurement/documents`
- `GET /api/procurement/documents/:type/:id`
- `GET /api/procurement/links`
- `GET /api/procurement/followups`
- `GET /api/procurement/summary`
- `GET /api/inventory/items`
- `GET /api/inventory/items/:sku`
- `GET /api/inventory/lots`
- `GET /api/inventory/serials`
- `GET /api/inventory/movements`
- `GET /api/inventory/exceptions`
- `GET /api/inventory/summary`
- `GET /api/master-data/items`
- `GET /api/master-data/suppliers`
- `GET /api/action-drafts/schema`
- `POST /api/action-drafts/preview`
- `GET /api/ai/tools`
- `POST /api/ai/chat`

Legacy/manual demo write routes still exist for compatibility, including purchase request, RFQ, purchase order, receiving, forecast, S&OP, login, and market-signal demo routes. The AI/draft-first surfaces do not autonomously execute those writes.

## AI Safety

External AI providers are disabled by default. Fake `OPENAI_API_KEY`, `ARK_API_KEY`, or `DOUBAO_API_KEY` values do not enable provider calls.

Cockpit-style prompts such as `今天最需要处理什么？` use a deterministic local fast path backed by Today Cockpit, procurement, and inventory read models. Unsupported prompts fall back safely when providers are disabled.

## Draft-first Actions

AI and Today Cockpit actions prepare reviewable drafts rather than executing business writes.

Current draft previews include:

- purchase request draft;
- RFQ draft;
- supplier follow-up draft.

Drafts keep `previewOnly: true`, `requiresConfirmation: true`, and `submitted: false`. Confirm/submit behavior is future work.

## Documentation Map

Start here:

- [Docs index](docs/README.md)
- [Product narrative](docs/product-narrative-v1.md)
- [Demo script](docs/demo-script-v1.md)
- [Architecture overview](docs/architecture-overview-v1.md)
- [Backend route map](docs/backend-route-map-v1.md)
- [Repository boundary](docs/repository-boundary-v1.md)
- [JSON adapter contract tests](docs/json-adapter-contract-tests-v1.md)
- [Persistence mode and adapter registry](docs/persistence-mode-and-adapter-registry-v1.md)
- [Roadmap](docs/roadmap-v1.md)
- [UAT limitations](docs/uat-limitations-v1.md)
- [AI safety and draft-first explainer](docs/ai-safety-and-draft-first-explainer-v1.md)

## Current Limitations

- No production database.
- No ORM.
- No autonomous AI execution.
- No real supplier message sending from drafts.
- No payment execution.
- No tax filing.
- No full finance/GL.
- No CRM, HR, sales order center, customer center, bank integration, OCR, PDF export, or xlsx export.

## Roadmap

The next architecture phase prepares adapter-ready persistence while keeping JSON/demo behavior stable:

- JSON adapter contract tests;
- persistence mode and adapter registry;
- ActionDraft and AuditLog repositories;
- Master Data repository;
- Procurement and Inventory read repositories;
- future ORM/database adapter implementation.
