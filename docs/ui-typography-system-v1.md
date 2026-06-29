# UI Typography System v1

## Purpose

This is an internal implementation note for keeping FlowChain workbench typography consistent across admin tables, KPI cards, search results, and detail panels.

## Principles

- Use compact, scan-friendly type for operational workbenches.
- Keep table text at steady sizes so filters, rows, and actions do not shift between modules.
- Use full currency amounts for transactional values. Avoid shorthand units in KPI values, table cells, detail fields, search subtitles, and AI cards.
- Keep chart axis units explicit when a chart intentionally aggregates values.
- Avoid customer-visible implementation labels such as demo, sample, UAT, fallback, or static data.

## Tokens

The lightweight token map lives in `src/components/ui/typography.ts`.

- `kpiValue`: primary KPI number.
- `kpiLabel`: KPI label and supporting caption.
- `tableHeader`: table header cells.
- `tableCell`: table body cells.
- `detailTitle`: object detail titles.
- `detailMeta`: detail fields and metadata.
- `searchResultTitle`: global search row title.
- `searchResultMeta`: global search subtitle, evidence, and matched-field hints.

## Formatting

Use `fmt`, `formatCurrencyAmount`, or `formatNumberAmount` from `src/lib/format.ts` for amount display. Transactional examples should render as:

- `¥140,000`
- `¥1,280,000`
- `¥12,345.67`

Do not render transaction amounts as `¥14万` or `¥0.14亿`.

## AI Assistant Presentation Rules

End-user AI output should be plain business language plus structured cards.

- Do not show raw JSON, raw arrays, code fences, or markdown headings such as `###`.
- Do not show JSON-like debug lines inside otherwise readable mixed responses.
- Do not show provider, model, tool, schema, intent, `cards`, or `evidence` debug metadata.
- Preserve business identifiers such as PO, PR, RFQ, supplier, SKU, amounts, and dates.
- Render structured data through UI cards with readable labels and values.
- Evidence should appear as compact label/value rows, not raw payloads.
- Recommended actions should use readable labels and safe internal links.
- Unknown structured card types should show `暂不支持展示该结果类型。` instead of dumping the raw card payload.
- Amount-like strings in AI cards should use full numeric currency formatting when the field label is clearly amount-related.
