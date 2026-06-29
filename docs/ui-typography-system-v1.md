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
