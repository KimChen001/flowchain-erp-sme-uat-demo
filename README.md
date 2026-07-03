# FlowChain AI Operations Platform for SME Inventory, Sales, Procurement, and Suppliers

FlowChain is an AI-assisted operations platform for SMEs to manage sales demand, inventory availability, procurement, receiving, supplier risk, and finance-collaboration exceptions in one evidence-based workflow.

FlowChain 是面向中小企业的 AI 进销存与供应链协同工作台，帮助团队围绕销售需求、库存、采购、收货、供应商和发票协同异常，识别交付风险、解释供需缺口、生成可复核动作，并形成可追踪的异常处理闭环。

## Current Status

FlowChain is an early-stage local development project. It is not yet production-ready SaaS infrastructure.

Default local runtime behavior uses a deterministic workspace dataset. No production database, ORM, RDS, or PolarDB connection is required for local development.

## Core Modules

- Today Cockpit / 今日风险工作台
- Sales Demand / Customer Orders Lite
- Inventory Allocation / Availability
- Demand-to-Procurement Links
- Procurement / P2P
- Purchase Request
- RFQ / supplier quotation
- Purchase Order
- Receiving / GRN
- Inventory and inventory exceptions
- Supplier operations / SRM
- Master Data
- Forecast / MRP
- AI Assistant
- Finance collaboration visibility
- Reports / Imports / Data Management

## Non-goals

FlowChain is intentionally focused. It is not:

- a full ERP replacement;
- a SAP/Oracle replacement;
- a full finance or general ledger system;
- an HR or payroll system;
- a CRM or customer lifecycle suite;
- a bank or payment execution system;
- a tax filing system;
- an autonomous AI execution platform.

AI-assisted actions are review-first. The system may prepare drafts and explanations, but it must not autonomously issue purchase orders, send supplier emails, post inventory, approve invoices, execute payments, or mutate supplier master data.

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
- `GET /api/sales-demand/summary`
- `GET /api/sales-demand/orders`
- `GET /api/sales-demand/orders/:id`
- `GET /api/sales-demand/risks`
- `GET /api/sales-demand/impact?sku=:sku`
- `GET /api/sales-demand/po-impact?poId=:poId`
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

Legacy/manual local write routes still exist for compatibility, including purchase request, RFQ, purchase order, receiving, forecast, S&OP, login, and market-signal routes. The AI and draft-first surfaces do not autonomously execute those writes.

## AI Safety

External AI providers are disabled by default. Placeholder `OPENAI_API_KEY`, `ARK_API_KEY`, or `DOUBAO_API_KEY` values do not enable provider calls.

Cockpit-style prompts such as `今天最需要处理什么？` use a deterministic local fast path backed by Today Cockpit, procurement, inventory, supplier, and planning read models. Unsupported prompts fall back safely when providers are disabled.

## Draft-first Actions

AI and Today Cockpit actions prepare reviewable drafts rather than executing business writes.

Current draft previews include:

- purchase request drafts;
- RFQ drafts;
- supplier follow-up drafts;
- exception case drafts.

Drafts remain preview-only and require user review before any future confirmed workflow can continue.

## Documentation Map

Start here:

- [Docs index](docs/README.md)
- [Product language and positioning](docs/product-language-and-positioning-v1.md)
- [Product narrative](docs/product-narrative-v1.md)
- [Current development limitations](docs/current-development-limitations-v1.md)
- [Architecture overview](docs/architecture-overview-v1.md)
- [Backend route map](docs/backend-route-map-v1.md)
- [Repository boundary](docs/repository-boundary-v1.md)
- [JSON adapter contract tests](docs/json-adapter-contract-tests-v1.md)
- [Persistence mode and adapter registry](docs/persistence-mode-and-adapter-registry-v1.md)
- [Draft and audit repository adapter](docs/action-draft-audit-repository-adapter-v1.md)
- [Master Data repository adapter](docs/master-data-repository-adapter-v1.md)
- [Procurement and Inventory read repository adapters](docs/procurement-inventory-read-repository-adapters-v1.md)
- [Roadmap](docs/roadmap-v1.md)
- [AI safety and draft-first explainer](docs/ai-safety-and-draft-first-explainer-v1.md)

## Current Limitations

- No production database.
- No ORM-backed production runtime.
- No autonomous AI execution.
- No real supplier message sending from drafts.
- No payment execution.
- No tax filing.
- No full finance/GL.
- No HR/payroll.
- No CRM/customer lifecycle suite.
- No sales order confirmation, shipment execution, invoicing, receivables, or customer notification automation.
- No bank integration.

## Roadmap

- Phase 0 Product positioning and language governance
- Phase 1 Sales Demand Lite
- Phase 2 Inventory Allocation
- Phase 3 Demand-to-Procurement Evidence Chain
- Phase 4 AI Control Tower v2
- Phase 5 Review-first Action Workflow
- Phase 6 DB persistence, tenant isolation, RBAC, audit
- Phase 7 DingTalk / WeCom notification draft adapter
- Phase 8 deployment and launch hardening
