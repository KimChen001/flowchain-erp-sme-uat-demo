# AI Provider Safety Gate v1

## Purpose

FlowChain AI Assistant is deterministic by default. External AI provider access must never be activated only because provider credentials exist in the environment.

## Safety Gate

External provider fallback is disabled unless this exact flag is set:

```env
AI_PROVIDER_ENABLED=true
```

Only the exact lowercase string `true` enables provider-eligible fallback logic. Values such as `1`, `yes`, `on`, `enabled`, `false`, or `FALSE` do not enable it.

## Behavior

- Deterministic AI handlers continue to run normally.
- Local business-data-backed fallback continues to run for supported workbench prompts.
- Market-data local answers continue to run where available.
- Unmatched prompts return a normal blocked fallback when the gate is disabled.
- API keys are treated as credentials only, not activation switches.
- The blocked response does not expose keys, provider token values, environment variables, or stack traces.

## Non-Goals

This note does not add real OpenAI, Doubao, Ark, DeepSeek, streaming, tool execution, or database persistence work. It only prevents accidental provider calls by default.
