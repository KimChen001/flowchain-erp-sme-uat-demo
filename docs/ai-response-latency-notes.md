# AI Response Latency Notes

## Current Flow

`POST /api/ai/chat` first tries deterministic business responders:

- supplier operational query
- status query
- procurement operational query
- RFQ operational query
- deferred procurement exception query
- draft preparation
- local workbench explanation

Only after those branches miss does the route consider external signals or configured AI provider calls.

## Latency Logging

In non-production runtime, the backend logs:

```text
[ai-chat] intent=... module=... elapsedMs=... branchMs=... cards=...
```

The log intentionally omits prompt text, provider name, model name, API key state, and raw card payloads.

## Frontend Loading

The floating AI panel keeps the initial loading label short. If a request takes more than about 1.5 seconds, it switches to:

```text
正在查询业务数据...
```

The UI does not display provider, model, or latency metadata.

## Output Quality Rules

- Strip markdown headings and inline emphasis markers from display text.
- Suppress raw JSON, code fences, and debug metadata lines.
- Preserve business IDs such as PR, RFQ, PO, GRN, invoice, supplier, and SKU.
- Normalize amount-context shorthand such as `金额14.2万` to full currency display.
- Do not convert non-amount words such as `万向节`.

## Follow-Up

Add endpoint-level tests around deterministic AI branches using a temporary database fixture so validation can exercise `/api/ai/chat` without mutating the shared local JSON file.
