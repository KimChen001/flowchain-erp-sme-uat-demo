# AI Provider Adapter v1 Plan

## Purpose

FlowChain should integrate GPT, Doubao, DeepSeek, or other LLM providers as a language intelligence layer, not as the business system of record.

The provider can help understand natural language, normalize mixed Chinese-English prompts, and extract structured intent and slots. The backend remains responsible for validation, permissions, domain logic, evidence, cards, and any future business actions.

## Target Architecture

```text
Frontend Floating AI Assistant
-> POST /api/ai/chat
-> AI Orchestrator
   -> local deterministic router first
   -> optional LLM intent/slot extractor later
   -> backend validates intent and slots
   -> whitelist tool registry
   -> internal domain helpers / APIs
   -> evidence/cards/actions
   -> optional answer composer later
-> structured response to frontend
```

Default behavior must remain local and deterministic:

```text
AI_PROVIDER=local
```

Provider integration should be additive and feature-flagged. No future provider should directly read runtime data, write business data, or bypass backend validation.

## Provider Modes

Reserved provider modes:

- `local`
- `openai`
- `doubao`
- `deepseek`

Reserved environment variables:

```env
AI_PROVIDER=local
AI_PROVIDER=openai
AI_PROVIDER=doubao
AI_PROVIDER=deepseek
AI_INTENT_EXTRACTION_ENABLED=false
AI_ANSWER_COMPOSER_ENABLED=false
```

No real provider key is required for v1 planning. Provider-specific keys can be added later, but they should not be required for local development or deterministic tests.

## Provider Responsibilities

The provider may eventually:

- understand natural language
- extract intent
- extract slots
- normalize multilingual and mixed Chinese-English prompts
- optionally compose a concise answer from backend evidence later

## Provider Non-Responsibilities

The provider must not:

- directly read the database
- directly write business data
- approve PRs
- submit PRs
- convert PRs to PO
- send RFQs
- award RFQs
- post GRNs
- adjust inventory
- bypass backend validation
- invent data

## LLM v1 Scope

The first LLM-backed scope should be intent extraction only.

Example user message:

```text
帮我看看这个供应商最近是不是不太稳？
```

Example extraction output:

```json
{
  "intent": "supplier_status_query",
  "slots": {
    "supplierId": null,
    "supplierName": null,
    "contextReference": true
  },
  "confidence": 0.82
}
```

Backend flow after extraction:

- checks activeContext
- validates supplier id
- calls existing supplier status query
- returns cards, evidence, and safe actions

## Allowed Intent Enum

Current allowlist:

- `supplier_status_query`
- `inventory_status_query`
- `procurement_exception_query`
- `rfq_status_query`
- `rfq_response_query`
- `supplier_rfq_participation_query`
- `pr_status_query`
- `pr_conversion_status_query`
- `po_status_query`
- `po_overdue_query`
- `receiving_status_query`
- `receiving_exception_query`
- `procurement_followup_summary_query`
- `prepare_purchase_request_draft`
- `prepare_rfq_draft`
- `unsupported`

Any provider output outside this enum must be treated as `unsupported`.

## Slot Schema Examples

Common slots:

- `supplierId`
- `supplierName`
- `itemId`
- `sku`
- `rfqId`
- `prId`
- `poId`
- `receivingId`
- `quantity`
- `requiredDate`
- `targetDeliveryDate`
- `prioritySignal`
- `timeWindow`
- `contextReference`

Slots should be treated as user-provided hints until validated by backend domain helpers.

## Validation Rules

- If intent is not in the allowlist, return `unsupported`.
- If confidence is low, fall back to the local deterministic router or ask for clarification.
- Explicit id from the user message wins over activeContext.
- activeContext is only used if entity type is compatible.
- All business lookups must go through internal tools or domain helpers.
- Draft intents must remain `reviewRequired`.
- Read-only intents must not write business data.
- Provider slots must not be trusted until normalized and validated.

## Future Implementation Phases

### Phase 1: Docs and Schema

- Create architecture documents.
- Define provider modes, intent allowlist, slot schema, and validation rules.
- Do not make external calls.

### Phase 2: Adapter Skeleton

- Add provider adapter helpers.
- Add mock provider tests.
- Keep production flow unchanged unless behavior is local/no-op.

### Phase 3: Optional LLM Intent Extraction

- Add intent extraction behind `AI_INTENT_EXTRACTION_ENABLED=true`.
- Keep local deterministic routing first.
- Use provider output only as a candidate, never as final business authority.

### Phase 4: Optional Answer Composer

- Add answer composition behind `AI_ANSWER_COMPOSER_ENABLED=true`.
- Compose only from backend evidence, cards, and safe actions.
- Never let raw model text become the source of truth.

### Phase 5: Tool Calling

- Consider tool calling only after tool registry, audit, permissions, and tenant boundaries are stronger.
- All tools must have explicit mode, permissions, review requirements, and write flags.

## Risk Controls

- provider timeout
- JSON schema validation
- output sanitization
- no raw model answer as source of truth
- audit of model suggestion vs backend action
- no PII leakage beyond necessary context
- tenant boundary enforcement
- cost and latency guardrails
- fallback to local deterministic behavior

## Recommended v1 Response Contract

Provider extraction result:

```json
{
  "intent": "po_status_query",
  "slots": {
    "poId": "PO-1001"
  },
  "confidence": 0.86
}
```

Backend response remains the existing structured AI Chat envelope:

```json
{
  "provider": "local_procurement_operational_query",
  "mode": "read",
  "message": "PO-1001 is partially received.",
  "intent": {
    "name": "po_status_query",
    "confidence": 0.88,
    "slots": {
      "poId": "PO-1001"
    }
  },
  "cards": [],
  "evidence": []
}
```

The frontend should render backend cards, not provider-owned business objects.
