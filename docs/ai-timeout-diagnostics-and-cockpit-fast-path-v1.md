# AI Timeout Diagnostics and Cockpit Fast Path v1

## Observed Issue

The AI Assistant quick prompt `今天最需要处理什么？` could show:

`AI 助手响应超时，请稍后再试。`

That message is produced by the frontend AbortController timeout path when `/api/ai/chat` does not return within 12 seconds. The browser aborts the request, re-enables the panel after `finally`, and the backend may still finish later depending on where it was spending time.

## Frontend Timeout Behavior

- `src/modules/ai-assistant/Panel.tsx` keeps a 12 second timeout around `/api/ai/chat`.
- A duplicate request guard prevents sending another prompt while one is in flight.
- Quick prompts and the text input are disabled only while `asking` is true.
- A slow-request label appears after 1.5 seconds.
- On timeout, the user now sees: `AI 助手响应超时，可能是本地 API 服务未响应。可以重试，或先查看 Today Cockpit。`
- Timeout messages include a retry button for the same prompt.
- Raw error details, stack traces, endpoint internals, and JSON payloads are not shown to the user.

## Cockpit Deterministic Fast Path

`/api/ai/chat` now checks a cockpit fast path before generic evidence reuse, operational handlers, provider safety fallback, or external provider dispatch.

The fast path handles Today Cockpit style prompts in `overview` / Today Cockpit context, including:

- `今天最需要处理什么？`
- `哪些采购单据有风险？`
- `哪些库存项目需要关注？`
- `帮我总结三单匹配异常`
- `哪些供应商需要跟进？`

The response is deterministic and local:

- uses the Today Cockpit read model when available;
- reuses procurement and inventory read models for evidence and summaries;
- returns business-readable Chinese content;
- returns compatible cards and evidence links;
- does not call OpenAI, Doubao, Ark, or other external providers;
- is unaffected by fake `OPENAI_API_KEY`, `ARK_API_KEY`, or `DOUBAO_API_KEY`;
- does not wait for audit persistence.

## Diagnostics

Backend dev timing logs include safe branch diagnostics:

- intent;
- module;
- elapsedMs;
- branchMs;
- card count;
- providerStatus when present.

The diagnostics do not log secrets, API keys, raw provider tokens, full environment values, or raw provider responses.

Frontend dev diagnostics log a safe request timing summary:

- elapsedMs;
- backend timingMs/modelMs/externalMs when returned;
- card count;
- timeout state for failures.

## Validation Coverage

Tests cover:

- cockpit prompt returns deterministic 200 response;
- cockpit prompt does not enter the provider branch;
- fake provider keys do not enable external provider use;
- unmatched prompts still use the provider disabled safe fallback;
- cockpit prompt content is compatible and does not expose raw JSON;
- audit write failure does not break the cockpit deterministic answer;
- frontend timeout copy, retry affordance, AbortController, and duplicate request guard remain present.

## Non-goals

- Do not enable external AI providers.
- Do not add provider SDKs.
- Do not add streaming.
- Do not add queue infrastructure.
- Do not change the draft-first boundary.
- Do not add a database.
- Do not change business write behavior.
