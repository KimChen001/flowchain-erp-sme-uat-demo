# Overview Evidence Boundary v1

## Purpose

Round 9 moves Overview evidence construction out of `src/modules/overview/Page.tsx` so the page can focus on composition, UI state, data loading, modal state, and navigation callbacks.

## Builder Location

Evidence builders now live in:

`src/modules/overview/overviewEvidence.ts`

The helper owns:

- evidence detail types;
- inventory replenishment action derivation;
- CSV export row mapping;
- safe evidence export filename fragments;
- PR, PO, inventory, inventory movement, RFQ, receiving, invoice, purchase return, reconciliation, supplier, forecast, and master data evidence builders.

## Page Boundary

`Page.tsx` still owns:

- Today Cockpit loading state;
- dashboard list state;
- selected evidence modal state;
- summary visibility state;
- navigation and action callbacks;
- rendering the existing Overview UI.

It no longer owns the business evidence builder implementations.

## Canonical Evidence Relationship

The extracted builders continue to emit existing Overview `EvidenceDetail` objects. Their `moduleId` values remain aligned with canonical focus destinations such as:

- `procurement:requests`
- `procurement:orders`
- `procurement:rfq`
- `procurement:receiving`
- `procurement:invoices`
- `inventory`
- `inventory:movements`
- `srm:risk`
- `master-data`

This keeps modal rendering and navigation behavior unchanged while making future canonical evidence alignment easier.

## Non-goals

- No Overview redesign.
- No Today Cockpit removal.
- No backend API change.
- No new write action.
- No database or provider change.
