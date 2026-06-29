# UI Typography Consistency v1

## Typography Scale

- Page title: 20px / 28px, semibold to bold.
- Section or card title: 16px / 24px or compact 14px / 20px, semibold.
- Body and table body: 14px / 22px.
- Table header: 13px / 20px, semibold.
- Form label: 13px / 20px, semibold.
- Form input: 14px / 22px.
- Button text: 14px / 20px for standard controls, 11-12px only for dense row actions.
- Chip / tag: 12px / 18px, semibold.
- Metadata / helper text: 12px / 18px or compact 11px where space is constrained.

## Table Link Rule

Link is a state, not a typography level. Table links use the same 14px / 22px body scale as surrounding cells and rely on blue color, hover underline, pointer behavior, and focus ring for affordance.

`src/components/ui/workbenchTable.ts` defines:

- `tableBodyTextClass`
- `thClass`
- `td*Class`
- `tableLinkClass`

PO, PR, and RFQ table ID buttons use `tableLinkClass` so clickable IDs do not become title-sized.

## Table And Nowrap Discipline

- Business tables keep horizontal scroll wrappers for wide content.
- ID, SKU, date, amount, status, and action columns remain nowrap.
- Numeric cells continue to use `tabular-nums`.
- Status chips stay single-line with `whitespace-nowrap`.

## Form, Button, And Chip Conventions

- `Field` labels use the shared 13px / 20px label scale.
- `inputStyle` uses 14px / 22px input text.
- `Chip` uses 12px / 18px semibold text with nowrap.
- Dense row action buttons remain small to preserve row height, but table ID links do not rely on global button typography.

## Amount Formatting Check

The compact amount grep found only documentation/tests, AI shorthand normalization helpers, chart axis labels, and out-of-scope sales demo displays. Procurement, inventory, Today Cockpit, and shared table changes did not require a currency formatter rewrite. Transaction amounts remain expected as full currency such as `¥140,000`.

## Non-goals

- No app shell redesign.
- No business logic changes.
- No API shape changes.
- No backend persistence or provider changes.
- No visual regression framework.
