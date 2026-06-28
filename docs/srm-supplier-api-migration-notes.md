# SRM Supplier API Migration Notes

## Purpose

This is a concise internal note for the partial SRM supplier data-source migration. It documents the current boundary so later SRM, Inventory, Procurement, and AI activeContext work can build on it without expanding scope accidentally.

## Current Change

SRM supplier identity and basic profile fields now prefer the backend master-data supplier API:

- `GET /api/master-data/suppliers`

The SRM page initializes from existing frontend supplier data, then loads backend supplier profiles and merges API identity/basic profile fields into the existing SRM read model.

## API-First Fields

When available, backend supplier fields are preferred for:

- supplier code/id: `id`
- supplier name: `name`
- category: `categories[0]`
- status: `status`
- risk display: `risk`
- display rating: `score`
- currency: `defaultCurrency`
- payment terms: `paymentTermsId`
- certification hint: `preferred`, only when fallback certification is unavailable

## Preserved SRM/Fallback Fields

The narrower master-data supplier API must not erase richer SRM displays. These fields continue to come from existing SRM/frontend read models when backend supplier master data does not provide them:

- contact, email, phone, tax ID, default tax code
- certification status
- on-time rate and quality rate
- delivery performance, response score, risk score, and next action
- RFQ participation, open PO counts, contracts/catalog summaries, invoice variance, credit memo, returns, and reconciliation evidence
- scoring dimensions and scoring rule workbench behavior

## Fallback Behavior

- API success: SRM uses API supplier identity/basic profile where fields exist.
- API failure or invalid response: SRM keeps the existing supplier fallback rows.
- Empty API supplier arrays are treated conservatively as fallback for now because SRM scoring and collaboration views still require supplier rows until backend parity is broader.
- No write behavior was added.
- No backend persistence behavior changed.

## Relationship Matching Bridge

API-preferred supplier code and name are the display identity in SRM. During this partial migration, the previous fallback supplier code/name may be retained internally as relationship matching metadata.

This lets SRM keep existing PO, RFQ, contract, invoice, credit memo, receiving, purchase return, and reconciliation evidence even when the backend supplier name differs from the previous frontend supplier name. Matching is exact after trim/lowercase normalization; it does not use partial or fuzzy matching.

The bridge is internal only. Legacy names, fallback names, and match candidate lists are not customer-visible fields.

Future backend APIs should eventually link SRM evidence by stable supplier IDs instead of display names.

## Active Context

Supplier detail activeContext remains unchanged in shape:

- `module: "srm"`
- `entityType: "supplier"`
- `entityId`: selected supplier code/id, now API-preferred when available
- `entityLabel`: selected supplier name, now API-preferred when available

Context still clears when the supplier detail closes.

## Future Follow-Ups

- Align `/api/supplier-performance` shape with SRM supplier rows.
- Migrate SRM supplier list/details more fully after backend parity exists.
- Migrate scoring dimensions only after backend scoring/evidence coverage is explicit.
- Align RFQ participation and supplier performance evidence with backend APIs.
- Revisit empty API array behavior once SRM has backend-owned scoring and collaboration sources.
