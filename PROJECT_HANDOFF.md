# FlowChain Project Handoff

Last updated: 2026-06-13

## Project Location

Local workspace:

```text
C:\Users\chinc\Documents\Codex\2026-06-04\erp-saas\scm-source
```

Public UAT URL:

```text
http://121.40.160.213:8787
```

Aliyun server:

```text
Host: 121.40.160.213
OS: Ubuntu 22.04
App directory: /opt/flowchain
Service: flowchain
Port: 8787
```

Do not store server passwords or API keys in this document.

## What This App Is

FlowChain is an internal UAT demo for a lightweight AI-assisted ERP/SCM product aimed at small and medium-sized businesses. It is not a production-ready SaaS system and is not a replacement for SAP, Oracle, or a full ERP implementation.

It currently includes:

- Login demo with user profile persistence
- Overview dashboard
- Inventory module
- Sales module
- Forecasting module
- Purchase request workflow
- RFQ workflow
- Purchase order workflow
- Line-level GRN receiving and QC workflow
- MRP release and S&OP cycle views
- Procurement cost module
- Supplier performance and recommendation scoring
- Right-side AI insight panel
- Embedded AI assistant
- AI confidence metadata
- Market price data cards for iron/steel/aluminum/copper/USD-CNY

## Current Data Model

Demo data is stored as JSON:

```text
data/scm-demo.json
```

Server-side data on Aliyun is stored in:

```text
/opt/flowchain/data/scm-demo.json
```

Important arrays:

- `purchaseOrders`
- `purchaseRequests`
- `receivingDocs`
- `rfqs`
- `inventoryMovements`
- `sopCycles`
- `products`
- `suppliers`
- `salesForecasts`
- `marketSignals`
- `marketPrices`
- `events`
- `users`

## Key API Endpoints

Health:

```text
GET /api/health
```

Auth demo:

```text
POST /api/auth/login
GET /api/auth/me
```

Purchase orders:

```text
GET /api/purchase-orders
POST /api/purchase-orders
PATCH /api/purchase-orders/:po/status
```

Purchase requests:

```text
GET /api/purchase-requests
POST /api/purchase-requests
PATCH /api/purchase-requests/:pr/status
POST /api/purchase-requests/:pr/convert-to-po
```

RFQ:

```text
GET /api/rfqs
POST /api/rfqs
PATCH /api/rfqs/:id/status
```

Receiving:

```text
GET /api/receiving-docs
POST /api/receiving-docs
PATCH /api/receiving-docs/:grn
```

Planning:

```text
GET /api/mrp-plan
GET /api/sop-cycle
POST /api/sop-cycle
```

AI and signals:

```text
POST /api/ai/chat
GET /api/external-signals
GET /api/market-prices
POST /api/market-prices/refresh
```

Engineering checks:

```bash
npm run build
npm run typecheck
npm test
```

## AI Behavior

The AI provider is configured with environment variables in `.env.local`.

Current provider:

```text
AI_PROVIDER=doubao
ARK_MODEL=doubao-seed-2-0-lite-260215
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

Do not commit `.env.local`.

Behavior notes:

- Price/market questions such as "今天的铁的市场价格" use internal `marketPrices` data and return immediately via `provider=market-data`.
- General ERP questions use Doubao/Ark if configured.
- External news/FX signals are fetched only for questions that need web context.
- If AI fails, the API falls back to local rule-based analysis.

## Local Development

Install dependencies:

```bash
npm install
```

Run local API:

```bash
npm run api
```

Run local frontend:

```bash
npm run dev
```

Build production frontend:

```bash
npm run build
```

Run production mode locally:

```bash
npm start
```

Production mode serves both:

- Static frontend from `dist`
- API routes under `/api`

## Aliyun Deployment

Server app directory:

```bash
cd /opt/flowchain
```

Build:

```bash
npm ci
npm run build
```

Restart service:

```bash
systemctl restart flowchain
systemctl status flowchain --no-pager
```

View logs:

```bash
journalctl -u flowchain -n 80 --no-pager
```

Verify on server:

```bash
curl http://127.0.0.1:8787/api/health
curl http://127.0.0.1:8787/api/market-prices
```

Verify from local machine:

```powershell
Invoke-WebRequest http://121.40.160.213:8787/api/health -UseBasicParsing
```

## Important Security Notes

- Rotate the server root password after setup.
- Prefer SSH key login for future work.
- Do not commit `.env.local`.
- Do not publish API keys, server passwords, or cloud console screenshots containing sensitive data.
- Current UAT is HTTP only. For longer internal testing, add Nginx and HTTPS.

## Current Known Limitations

- Data is JSON-based, not a real database.
- User login is demo-only and does not use password hashing or JWT.
- Multi-tenant data isolation is not implemented yet.
- Market prices are UAT sample/cache data, not official exchange data.
- No HTTPS/domain yet.
- No formal test suite yet.

## Recommended Next Work

1. Add a full functional UAT test checklist.
2. Build a stronger purchase request flow:
   - Create request
   - AI risk explanation
   - Approve/reject
   - Generate PO
   - Receive goods
   - QC and inbound update
3. Replace JSON with PostgreSQL.
4. Add tenant/company data isolation.
5. Add Nginx + HTTPS.
6. Add audit log and role permissions.
7. Connect real market data provider for steel/iron/copper/aluminum prices.
8. Add streaming AI responses or fast local summary + async AI enhancement.

## New Conversation Bootstrap Prompt

Use this at the start of a new Codex conversation:

```text
请继续 FlowChain 项目。项目路径是 C:\Users\chinc\Documents\Codex\2026-06-04\erp-saas\scm-source。请先读取 PROJECT_HANDOFF.md、package.json、server/scm-api.mjs 和 src/app/App.tsx，然后继续开发。不要读取或输出 .env.local 里的密钥。
```
