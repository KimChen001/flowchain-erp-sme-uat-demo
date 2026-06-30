# Demo Script v1

## 10-15 Minute Flow

### 1. Open Today Cockpit

Start on the Today Cockpit / overview page.

Explain that FlowChain is a focused AI-assisted SCM workbench for SMEs, not a full ERP replacement. The cockpit is the daily operating screen for procurement, inventory, supplier follow-up, and finance-collaboration visibility.

### 2. Explain Summary Cards

Point out the summary cards:

- open PRs;
- active RFQs;
- open POs;
- pending receiving;
- match exceptions;
- inventory risks;
- urgent follow-ups;
- total open amount.

Explain that these are read-model summaries over the current demo data.

### 3. Inspect Inventory Risk

Open a high-risk inventory item from the cockpit.

Explain:

- the SKU has low stock or exception evidence;
- inventory risk is connected to procurement recommendations;
- the user can recover back to the cockpit or inventory list.

### 4. Click Evidence Into SKU or Inventory Focus

Use the evidence/focus navigation to move into the SKU context.

Show:

- SKU facts;
- movement or exception entry points where available;
- navigation recovery controls.

### 5. Return to Cockpit

Use recovery controls to return to the main cockpit.

Explain that users are not trapped in a detail state after evidence navigation.

### 6. Inspect Procurement Follow-up / PO Evidence

Open a procurement follow-up or PO evidence item.

Explain:

- PR/RFQ/PO/GRN/invoice evidence is canonicalized;
- related documents help reconstruct the procurement story;
- invoice and three-way match exceptions stay visible for finance collaboration.

### 7. Use Global Search

Search for a PO or SKU, such as `PO-2026-1301` or `SKU-00287`.

Show:

- ranked result;
- canonical focus target;
- evidence rows;
- navigation into the relevant module.

### 8. Ask AI Cockpit Prompt

Open the AI Assistant and ask:

`今天最需要处理什么？`

Explain:

- this prompt uses the deterministic local cockpit fast path;
- it does not wait for external provider calls;
- it returns business-readable content with cards and evidence;
- fake API keys do not enable providers.

### 9. Click AI Evidence

Click an AI evidence item where supported.

Explain that AI answers are evidence-based and route through the same canonical navigation model as Global Search and Today Cockpit.

### 10. Generate PR Draft Preview

From a low-stock action, generate a PR draft preview.

Explain:

- the draft is prepared from inventory/procurement evidence;
- it is reviewable;
- it does not create a real PR.

### 11. Show Action Draft Review Shell

Open the Action Draft Review shell.

Show:

- draft title and type;
- business payload;
- validation status;
- origin evidence;
- audit trail;
- confirmation boundary.

### 12. Explain Confirmation Boundary

Point out that confirmation/submit is intentionally disabled or future-work.

Explain:

- FlowChain is draft-first;
- AI assists preparation;
- users review before future confirmed actions;
- no autonomous execution happens in the current UAT scope.

### 13. Explain Provider Safety

Explain that external AI provider calls are disabled by default. The local deterministic AI path handles cockpit, procurement, inventory, RFQ, supplier, and draft-preparation prompts where supported.

### 14. Close With Roadmap

Close by explaining the roadmap:

- keep JSON/demo behavior stable;
- add contract tests for future adapters;
- introduce persistence mode and adapter registry;
- adapt ActionDraft/AuditLog first;
- adapt Master Data, Procurement, and Inventory reads;
- only later implement a real database/ORM layer.

## Talk Track Summary

FlowChain shows how an SME supply chain team can move from scattered manual workflows toward evidence-based procurement and inventory operations, while keeping AI safe, explainable, and draft-first.
