# UI Typography Token Consolidation v2

## Token Scale

`src/components/ui/typography.ts` is the shared lightweight type scale for FlowChain operational screens.

- `pageTitle`: 20px / 28px, semibold.
- `sectionTitle`: 16px / 24px, semibold.
- `subsectionTitle`: 15px / 22px, semibold.
- `body`: 14px / 22px.
- `tableHeader`: 13px / 20px, semibold.
- `tableCell`: 14px / 22px.
- `tableLink`: 14px / 22px, medium.
- `formLabel`: 13px / 20px, semibold.
- `formInput`: 14px / 22px.
- `button`: 14px / 20px, semibold.
- `denseButton`: 12px / 18px, medium.
- `chip`: 12px / 18px, semibold.
- `metadata`: 12px / 18px.
- `compactMetadata`: 11px / 16px.

## Link Scale Rule

Link is a state, not a typography level.

Table links use `tableLink`, which is the same 14px / 22px scale as table cells. Links may use blue color, hover underline, tabular numbers, and focus rings, but they should not become heading-sized just because they are clickable.

## Shared Table Boundary

`src/components/ui/workbenchTable.ts` now consumes the typography tokens for:

- table body scale;
- left and right table headers;
- table ID links;
- numeric right-aligned cells.

Core workbench tables should prefer these classes over one-off `text-xs` table definitions. Today Cockpit recent documents now uses the shared table body, header, numeric, and link classes.

## Form, Button, And Chip Conventions

- `Field` labels stay on the 13px / 20px label scale.
- `inputStyle` stays on the 14px / 22px input scale.
- `Chip` stays on the 12px / 18px semibold scale.
- Dense row actions can remain 11px or 12px when row height is constrained.

## Amount Grep Result

The compact amount grep found:

- documentation and tests that explicitly protect full currency formatting;
- AI shorthand normalization helpers and tests;
- chart axis labels where units are intentionally shown as chart scale;
- out-of-scope legacy sales/supplier demo pages.

No Round 8 formatter rewrite was needed for the core SCM workbench path. Procurement, inventory, Today Cockpit, global search, and AI card amount rules remain full-number oriented, for example `¥140,000`.

## Non-goals

- No full UI redesign.
- No business logic change.
- No API shape change.
- No database or AI provider change.
- No visual regression framework.
