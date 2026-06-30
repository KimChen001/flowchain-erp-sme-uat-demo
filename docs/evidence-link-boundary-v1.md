# Evidence Link Boundary v1

Evidence Link Canonicalization v1 keeps business evidence clickable only when the target can be resolved to a known FlowChain workbench and focused business record.

## Canonical Evidence Model

Frontend consumers normalize mixed backend and UI evidence through `src/lib/evidenceLinks.ts`.

Canonical evidence has this shape:

```ts
{
  module: "procurement" | "inventory" | "supplier" | "masterData" | "todayCockpit" | "ai";
  entityType: string;
  entityId: string;
  label: string;
  status?: string;
  route?: string;
  focusTarget?: { entityType: string; entityId: string };
  source?: string;
  recovery?: unknown;
  clickable: boolean;
}
```

The helper accepts existing shapes from Today Cockpit, Global Search, and AI evidence without changing backend API responses.

## Focus Target Behavior

Known procurement evidence maps to existing workbench views:

- PR: `procurement:requests` with `purchase_request`
- RFQ: `procurement:rfq` with `rfq`
- PO: `procurement:orders` with `purchase_order`
- GRN: `procurement:receiving` with `receiving_doc`
- supplier invoice and three-way match: `procurement:invoices` with `supplier_invoice`

Inventory SKU evidence maps to `inventory` with `inventory_item`.

Supplier evidence maps to `srm:master` with `supplier`.

Master data item, warehouse, and bin evidence maps to the existing master data views where the source already identifies those entities.

Navigation keeps the existing app focus banner and recovery behavior. Global Search still ranks results in the backend as before; selection now normalizes the target before setting focus. Today Cockpit cards, followups, inventory risks, and recent documents use the same focus target where the payload contains enough evidence.

## Broken Evidence Behavior

Evidence is not rendered as a clickable target when:

- the ID is empty;
- the route or module is malformed;
- the entity type is unknown and cannot be mapped;
- the target object does not contain enough information.

Unsupported evidence remains readable text. The UI does not render raw objects or JSON for unknown evidence.

## AI Evidence

AI evidence cards normalize compact evidence rows before display. Known business evidence becomes a focus button. Unknown evidence remains text-only, so unsupported cards do not create dead links or crash the assistant panel.

This preserves deterministic, local AI behavior. The pass does not enable external provider calls.

## Today Cockpit And Search

Today Cockpit continues to consume `GET /api/today-cockpit` unchanged. The frontend normalizes cards, actions, inventory risks, and recent documents for focus-aware navigation.

Global Search continues to use the existing backend search index and ranking. Result selection is compatible with old `moduleId`, `entityType`, and `entityId` fields while using the canonical focus target when safe.

## Non-goals

This pass does not:

- rewrite the router;
- add graph navigation;
- add write APIs;
- add database persistence;
- redesign AI cards;
- enable real GPT, Doubao, DeepSeek, or other external provider calls.
