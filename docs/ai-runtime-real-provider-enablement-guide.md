# AI Runtime Real Provider Enablement Guide

## Purpose

This guide is only for local developer smoke testing of the real external assistance path. FlowChain still uses the local evidence responder by default. Real external assistance is never enabled automatically, and the AI Assistant UI must not display provider, model, key, token, or endpoint details.

Every external result still passes through normalize, validate, and fallback before it can become an `AiRuntimeResponseV2`. FlowChain does not allow AI to automatically approve, order, pay, send externally, write inventory, write financial vouchers, change master data, or overwrite data.

## Current Runtime Chain

```text
AI Assistant
-> AI Runtime Gateway
-> bounded context package
-> provider-specific adapter
-> normalize
-> validate
-> fallback if unsafe or unavailable
-> AiRuntimeResponseV2
-> review-first UI
```

## Supported Server-side Kinds

The server-side optional adapter kinds are:

- `generic_http`
- `openai_responses`
- `deepseek_chat`
- `doubao_chat`

These names are only for local server-side configuration and test commands. They do not mean the feature is enabled by default, and they should not appear in user-visible UI. Do not write a real endpoint in this document or in committed code. Use placeholders only:

- Endpoint placeholder: `<YOUR_PROVIDER_ENDPOINT>`
- Key placeholder: `<YOUR_LOCAL_API_KEY>`
- Model placeholder: `<YOUR_MODEL_NAME>`

## Environment Variables

Set these only in the current shell session:

```powershell
FLOWCHAIN_AI_RUNTIME_MODE=provider_assisted
FLOWCHAIN_AI_PROVIDER_KIND=<generic_http|openai_responses|deepseek_chat|doubao_chat>
FLOWCHAIN_AI_PROVIDER_ENDPOINT=<YOUR_PROVIDER_ENDPOINT>
FLOWCHAIN_AI_PROVIDER_API_KEY=<YOUR_LOCAL_API_KEY>
FLOWCHAIN_AI_PROVIDER_MODEL=<YOUR_MODEL_NAME>
FLOWCHAIN_AI_PROVIDER_TIMEOUT_MS=8000
FLOWCHAIN_AI_PROVIDER_MAX_OUTPUT_CHARS=6000
```

Do not write these values into `.env`. Do not write them into git-tracked files. Do not screenshot a shell that contains a key. Do not send a key to Codex, ChatGPT, GitHub issues, Slack, or any shared channel. Do not put a key in your PowerShell profile.

## PowerShell Temporary Setup

Use placeholder values first, then replace them only in your local shell:

```powershell
$env:FLOWCHAIN_AI_RUNTIME_MODE="provider_assisted"
$env:FLOWCHAIN_AI_PROVIDER_KIND="openai_responses"
$env:FLOWCHAIN_AI_PROVIDER_ENDPOINT="<YOUR_PROVIDER_ENDPOINT>"
$env:FLOWCHAIN_AI_PROVIDER_API_KEY="<YOUR_LOCAL_API_KEY>"
$env:FLOWCHAIN_AI_PROVIDER_MODEL="<YOUR_MODEL_NAME>"
$env:FLOWCHAIN_AI_PROVIDER_TIMEOUT_MS="8000"
$env:FLOWCHAIN_AI_PROVIDER_MAX_OUTPUT_CHARS="6000"
```

Do not paste real vendor endpoints, real keys, or real model names into repository files.

## Fake Smoke First

Run the local fake smoke suite first:

```bash
npm run test:ai-provider-smoke:fake
```

Expected result:

- 24 combinations should pass.
- No external network is used.
- No real key is required.
- No provider-specific visible text is printed.
- No raw request or raw response is printed.

## Env Check

Run the local configuration check:

```bash
npm run check:ai-provider-env
```

Expected output shape:

```text
AI Runtime 辅助配置检查
- 当前数据范围：当前工作区数据
- 运行模式：已配置 / 未配置
- 辅助类型：已选择 / 未选择
- 地址配置：已配置 / 未配置
- 访问凭据：已配置 / 未配置
- 模型配置：已配置 / 未配置
- 输出安全：未显示敏感值
- 建议动作：继续本地验证 / 补充本机临时配置 / 保持本地证据回答
```

The check does not print real environment values. It does not print endpoint URLs, keys, or model names.

## Real Smoke

After fake smoke and env check pass, run one manual real smoke command:

```bash
node scripts/ai-runtime-provider-smoke.mjs --mode real --kind openai_responses
node scripts/ai-runtime-provider-smoke.mjs --mode real --kind deepseek_chat
node scripts/ai-runtime-provider-smoke.mjs --mode real --kind doubao_chat
node scripts/ai-runtime-provider-smoke.mjs --mode real --kind generic_http
```

If the local configuration is missing, real smoke skips the external call and prints that the real assistance check did not run. If the local configuration is complete, the script attempts one manual validation. The output must not include endpoint, key, model, raw request, or raw response. If the call is unsafe, times out, returns non-2xx, is malformed, or is too long, the runtime should fall back to the local evidence answer or mark the result for human review without exposing technical details.

## How to Confirm Success

Success criteria:

- 回复结构：通过
- 证据约束：通过
- 复核优先：通过
- 跳转返回：通过
- 数据限制：已覆盖
- 安全边界：通过
- 外部辅助结果：已通过安全评估 或 未采用
- 最终结论：通过 或 需要人工复核
- No key, endpoint, model, raw request, or raw response appears.
- No automatic business execution appears.

## Rollback to Local Evidence Responder

Clear temporary shell variables:

```powershell
Remove-Item Env:FLOWCHAIN_AI_RUNTIME_MODE -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_KIND -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_ENDPOINT -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_MODEL -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_TIMEOUT_MS -ErrorAction SilentlyContinue
Remove-Item Env:FLOWCHAIN_AI_PROVIDER_MAX_OUTPUT_CHARS -ErrorAction SilentlyContinue
```

Then run:

```bash
node scripts/ai-runtime-provider-smoke.mjs --mode real --kind openai_responses
```

Expected result: real assistance validation is not run, and FlowChain keeps the local evidence answer path.

## Red Flags

Stop immediately if any of these happen:

- Any key appears in console output.
- An endpoint URL appears in a summary.
- Raw request or raw response content is printed.
- External output contains a dangerous execution action and enters the final summary.
- The AI Assistant UI shows provider, model, API, key, token, or endpoint details.
- `git status` shows `.env`.
- `data/scm-demo.json` is staged.
- `.claude/` is staged.
- `test-results/`, `playwright-report/`, or browser trace files are staged.
- Real smoke changes business data.
- Runtime automatically performs approval, ordering, payment, external sending, inventory write, financial voucher write, master-data change, or data overwrite.

## Commit Safety Checklist

Before commit:

```bash
git status --short
```

Confirm:

- Only the guide, env check script, tests, and `package.json` are staged.
- No `.env` is staged.
- No key, token, secret, credential, or auth material is staged.
- No `test-results/`, `playwright-report/`, `blob-report/`, or trace file is staged.
- `data/scm-demo.json` is not staged.
- `.claude/` is not staged.
