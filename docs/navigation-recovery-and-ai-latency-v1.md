# Navigation Recovery And AI Latency v1

This pass improves two visible workbench behaviors: the AI Assistant now has stronger frontend request guardrails, and focused business-object views have visible recovery paths.

## AI Latency Guardrails

- The AI Assistant prevents duplicate submissions with an in-flight request guard that is independent of React state timing.
- Send, Enter-submit, and quick prompts are disabled while a response is in flight.
- Each request uses `AbortController`.
- A 12 second timeout aborts slow requests and shows a clean timeout fallback.
- Module changes abort the active request and reset the assistant state for the new context.
- User-facing errors remain short and safe, without raw JSON, stack traces, or secrets.

The backend AI provider safety gate is unchanged. External providers remain disabled unless explicitly enabled by environment configuration.

## Timing Visibility

The backend AI route keeps its existing dev timing log. The safe timing shape remains focused on intent, module, branch, elapsed time, cards count, and provider status where available. It does not log provider keys, token values, full environment values, or full prompt payloads.

## Navigation Recovery Model

Focused views entered from Global Search or evidence-style navigation now show a global recovery bar above the active module. The bar includes:

- current focused object;
- `返回上一层`;
- parent module return;
- `清除聚焦`.

Normal sidebar and module navigation clears stale focus so an old SKU, PO, RFQ, GRN, invoice, or supplier focus does not trap the next screen.

## Detail Recovery

Inventory SKU focus now renders a visible SKU recovery card with:

- SKU status and stock facts;
- related inventory movement IDs where data exists;
- related inventory exception IDs where data exists;
- `返回库存列表`;
- links to the movement ledger and exception documents.

Procurement document evidence links now receive the app navigation handler where the current workbench supports it. PR, PO, RFQ, GRN, and invoice detail surfaces keep their local return controls and can navigate to parent/related workbench sections without relying only on browser Back.

## Related Links

Related links are only rendered from existing local data and read models:

- PR to PO, forecast, or inventory evidence when present.
- PO to PR, RFQ, GRN, invoice, and match evidence when present.
- RFQ to source PR and linked PO when present.
- GRN to PO and invoice evidence when present.
- Invoice to PO and GRN evidence when present.
- SKU to movement and exception entries when present.

Empty or unsupported IDs are filtered by existing link builders or are shown as non-actionable values.

## Non-Goals

This pass does not add database persistence, write APIs, autonomous actions, external AI provider calls, new modules, a new router, GL/payment/tax execution, OCR, PDF export, or xlsx export.
