# AI Evidence Reuse v1

## Purpose

AI Evidence Reuse v1 makes deterministic AI Assistant answers use existing backend read models before any provider fallback. The goal is faster, safer business answers with canonical evidence links.

## Reused Read Models

- Procurement questions use `server/domain/procurement-read-model.mjs` for document summaries, followups, and evidence routes.
- Inventory questions use `server/domain/inventory-read.mjs` for item risk, exception, and summary fields.
- Today Cockpit questions use `server/domain/today-cockpit-read-model.mjs` for priority actions, urgent followups, inventory risks, and open amount.

The route creates a per-request read-model cache for the evidence reuse branch. No long-lived cache is introduced.

## Supported Deterministic Patterns

- `今天最需要处理什么？`
- `哪些采购单据有风险？`
- `哪些库存项目需要关注？`
- `这个 SKU 为什么风险高？`
- `哪些供应商需要跟进？`

These responses remain local, deterministic, and read-only. They return compatible AI cards plus compact evidence items with type, id, label/status/summary, and route where available.

## Provider Safety

The provider safety gate is unchanged:

- External providers are disabled by default.
- API keys alone do not enable provider calls.
- `AI_PROVIDER_ENABLED=true` is still required for provider-eligible fallback.
- Evidence reuse answers are resolved before provider fallback and do not require provider SDKs.

## Presentation Boundary

Responses avoid raw JSON, code fences, debug labels such as `cards:` or `evidence:`, and markdown heading artifacts. Unknown evidence targets remain safe because the frontend renders evidence cards as compact text and only turns explicitly safe internal targets into links.

## Non-Goals

- No real GPT, Doubao, DeepSeek, or provider SDK integration.
- No streaming.
- No autonomous action execution.
- No PR/RFQ/PO creation.
- No inventory mutation.
- No database persistence.
