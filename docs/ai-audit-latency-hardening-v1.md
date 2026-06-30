# AI Audit Latency Hardening v1

## Purpose

Round 7 keeps AI audit value while preventing audit persistence from blocking or breaking `/api/ai/chat` responses.

FlowChain AI remains deterministic and local by default. External provider calls still require the explicit `AI_PROVIDER_ENABLED=true` safety gate.

## Audit Policy

- Read-only deterministic answers use best-effort audit. A failed `writeDb` must not fail the user response.
- Draft preparation events are auditable, but audit failure is hidden from the user and does not block the draft response.
- Provider disabled and safety gate events are best-effort audit events.
- Configured provider calls, when explicitly enabled, still record a best-effort event after the response payload is prepared.
- Audit summaries are short and sanitized. They do not include full prompts, API keys, bearer tokens, raw provider responses, or stack traces.

## Latency Behavior

`server/routes/ai.routes.mjs` now uses `recordAiEventBestEffort` for AI chat events. The helper wraps `event` and `writeDb`, catches failures, and logs only a short non-secret dev warning.

The AI response path no longer depends on audit persistence success for:

- evidence reuse;
- supplier operational query;
- status query;
- procurement operational query;
- RFQ operational query;
- deferred procurement exception;
- draft preparation;
- local workbench response;
- market-data response;
- provider disabled response;
- configured provider response.

## Provider Failure Sanitization

Configured provider errors now return a local degraded fallback:

- `provider: "local"`
- `providerStatus: "degraded"`
- `degraded: true`
- `errorCode: "provider_unavailable"`
- local business-readable `content` and `message`

The response does not include raw provider error messages, endpoint URLs, token fragments, response bodies, or stack traces.

## Compatibility

The route preserves existing frontend-compatible fields where applicable:

- `content`
- `message`
- `cards`
- `evidence`
- `intent`
- `provider`
- `providerStatus`
- `usedWeb`
- `timingMs`
- `externalMs`
- `modelMs`

## Non-goals

- No external AI provider is enabled by default.
- No provider SDK is added.
- No queue infrastructure is added.
- No database persistence layer is introduced.
- No business data is mutated by read-only AI responses.
- No frontend AI UI changes are required.
