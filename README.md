# FlowChain ERP/SCM UAT Demo

FlowChain is a lightweight AI-assisted ERP/SCM UAT demo for small and medium-sized businesses moving from Excel, email, and manual approvals into structured supply-chain workflows.

This repository is not a production-ready SaaS system and is not intended to replace SAP, Oracle, or a full ERP implementation. It remains a JSON-backed UAT demo focused on product validation and workflow storytelling.

## Current Capabilities

- Login demo with local user profile persistence.
- SME-friendly workbench dashboard and navigation.
- Inventory planning, stock movement traceability, warehouse views, ABC/XYZ, and replenishment requests.
- Purchase request workflow with approval evidence, supplier recommendation, RFQ trigger, and PR to PO conversion.
- RFQ workflow with source PR traceability and status transitions.
- Purchase order workflow with line-level PO data, approval, dispatch, and audit history.
- GRN receiving workflow with line-level receiving, QC, posted GRN lock, and inventory movement linkage.
- Forecasting, MRP release, and S&OP cycle views.
- Supplier performance and recommendation scoring.
- AI assistant with module evidence, local fallback, external signal support, and AI confidence metadata.
- Market price cards for iron, steel, aluminum, copper, and USD-CNY demo signals.

## Project Structure

The app is being refactored from a Figma demo bundle into a maintainable project:

```text
src/app/                 App shell, routing, and compatibility wrapper
src/modules/             Module page entry points
src/components/          Shared UI component categories
src/domain/              Frontend domain helpers
src/lib/                 API client, constants, formatting
src/data/                Static demo data
src/types/               Shared TypeScript types
server/config/           Runtime environment loading
server/domain/           Backend workflow/domain logic
server/repositories/     JSON database adapter
server/routes/           API route handlers
server/services/         AI and market service boundaries
server/utils/            HTTP and validation utilities
```

`src/app/FlowChainApp.tsx` still contains the compatibility implementation while module pages are migrated incrementally. `server/routes/scm-legacy.routes.mjs` still contains the compatibility route implementation while endpoint handlers are split module by module.

## Running Locally

Install dependencies:

```bash
npm install
```

Start the API server:

```bash
npm run api
```

Start the frontend dev server in another terminal:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run the minimal domain test suite:

```bash
npm test
```

The frontend proxies `/api` requests to `http://127.0.0.1:8787`.

## Data And API

Demo data is stored in `data/scm-demo.json`. The project intentionally continues to use JSON persistence for UAT speed and traceability.

Key endpoints include:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/purchase-requests`
- `POST /api/purchase-requests`
- `PATCH /api/purchase-requests/:pr/status`
- `POST /api/purchase-requests/:pr/convert-to-po`
- `GET /api/purchase-orders`
- `POST /api/purchase-orders`
- `PATCH /api/purchase-orders/:po/status`
- `GET /api/rfqs`
- `POST /api/rfqs`
- `PATCH /api/rfqs/:id/status`
- `GET /api/receiving-docs`
- `POST /api/receiving-docs`
- `PATCH /api/receiving-docs/:grn`
- `GET /api/inventory-movements`
- `GET /api/mrp-plan`
- `GET /api/sop-cycle`
- `POST /api/sop-cycle`
- `POST /api/ai/chat`
- `GET /api/external-signals`
- `GET /api/market-prices`
- `POST /api/market-prices/refresh`

## AI Behavior

AI provider configuration is read from local environment files at runtime. Do not commit `.env.local` or expose API keys.

If configured, the backend can call OpenAI or Doubao/Ark. If provider calls fail or credentials are absent, the API returns a local rule-based fallback using structured demo evidence.
