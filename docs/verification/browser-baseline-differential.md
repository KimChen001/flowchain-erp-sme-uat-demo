# FlowChain Browser Baseline Differential Audit

Audit date: 2026-07-14 (Asia/Shanghai)

## 1. Environment parity

| Variable | Main baseline | Feature |
| --- | --- | --- |
| Worktree | `scm-main-browser-baseline` | `scm-procurement-worktree` |
| Git state | detached `a7608354f1e191e89db65db046af4a1adf833b70` | `codex/persistent-sme-procurement` at `0a7dc6718e56b728294306e9059fe3b64ac78bfc` |
| Remote identity | `origin/main=a7608354f1e191e89db65db046af4a1adf833b70` | `origin/codex/persistent-sme-procurement=0a7dc6718e56b728294306e9059fe3b64ac78bfc` |
| Node / npm | `v24.11.1` / `11.6.2` | `v24.11.1` / `11.6.2` |
| Playwright | `1.61.1` | `1.61.1` |
| `package-lock.json` SHA-256 | `929E455CD51251C50009464635E78DD69EE12C442B3DEA854B37C8F95DF655EB` | same |
| Browser / workers | Chromium / 1 | Chromium / 1 |
| Test timeout / expect timeout / retries | 45 s / 10 s / 0 | same |
| Data mode | explicit `demo` for differential compatibility | same |
| UI / API ports | 5184 / 8887 | 5174 / 8787 |
| Runtime | clean, main-only `%TEMP%/flowchain-main-browser-runtime` files | clean, feature-only `%TEMP%/flowchain-browser-*-8787.json` files |

Both suites used the native lockfile and the exact `npm run test:browser` command. The feature contains eight more tests, so native totals differ (100 versus 108). The main revision predates the health build-identity contract: its `/api/health` does not expose `commitSha`, while process worktree/HEAD evidence proves `a760835`. The feature's UI/API identity test passes and health reports `0a7dc67`, the feature branch, local-dev mode, and the feature worktree. No target port was occupied at test start; no 5173 listener existed.

## 2. Main baseline result

- Result: **21 passed / 78 failed / 1 skipped** (100 total).
- Duration: 38.2 minutes.
- Full local log: `%TEMP%/flowchain-main-browser-baseline.log` (not committed).
- The suite completed without web-server crash or did-not-run tests.

## 3. Feature result

- Result: **38 passed / 69 failed / 1 skipped** (108 total).
- Duration: 29.2 minutes.
- Full local log: `%TEMP%/flowchain-feature-browser-baseline.log` (not committed).
- The suite completed without web-server crash or did-not-run tests.

Exact-name comparison covers 82 tests: 65 failed in both, 4 passed only on main, 2 passed only on feature, 10 passed on both, and 1 skipped on both. Eighteen main test names were replaced by 26 feature test names as the canonical runtime contract changed.

## 4. Confirmed pre-existing failures (A)

The following 64 exact-name tests failed in both revisions at the same stage with the same first effective error. For every record below: main=`failed`, feature=`failed`, classification=`A`, evidence is the section error signature, and recommendation is to replace/retire the legacy contract only when a canonical test exists; do not restore fixture data.

### `Error: expect(locator).toBeVisible() failed` (27)

- `ai-copilot.spec.ts` — R122 Today priority; R123 minimize/restore; R124 evidence navigation; R125 grounded follow-up; R126 ambiguous PO; R127 SKU risk draft; R128 PO/RFQ draft; R129 full workspace; R134 empty panel; R135 PO placeholder; R136 session grounding; R139 broad attention; R139 data limitation; R139 runtime hotfix gates; R139 supplier overview; R146 compound query.
- `core-business-chain-closure.spec.ts` — core business chain closure.
- `erp-information-architecture.spec.ts` — default SME trunk; sales/inventory navigation names; supplier in foundation data.
- `final-product-closure-acceptance.spec.ts` — final product closure acceptance.
- `list-state-recent-pages.spec.ts` — recent pages bounded/persistent.
- `manager-cockpit-contextual-drilldown.spec.ts` — dense cockpit/recovery paths.
- `operations-control-tower-v2.spec.ts` — today actions versus AI suggestions.
- `reports-analytics-v2.spec.ts` — operational insights and safe navigation.
- `reports-bi.spec.ts` — dedicated BI dashboards/library separation.
- `saved-report-views.spec.ts` — saved view lifecycle.

### `Error: expect(locator).toContainText(expected) failed` (7)

- `ai-assistant-availability-hotfix.spec.ts` — core workspace questions.
- `ai-response-contract-v2.spec.ts` — supplier/unreceived PO; receiving/match failures; Today cockpit.
- `ai-runtime-contextual-draft-review.spec.ts` — contextual action draft.
- `ai-runtime-gateway-v2.spec.ts` — evidence-bounded gateway.
- `ai-runtime-multiturn-context.spec.ts` — multi-turn context.

### Other identical assertion errors (3)

- `report-center-layout.spec.ts` — `toHaveCount` failure in both.
- `typography-system.spec.ts` — `toHaveCSS` failure in both.
- `reports-bi.spec.ts` — finance chart drilldown `toHaveURL` failure in both.

### `Test timeout of 45000ms exceeded` (27)

- `ai-response-contract-v2.spec.ts` — PO/supplier/data-access navigation.
- `ai-suggestions-workbench-v2.spec.ts` — suggestions workbench.
- `app-layout-width.spec.ts` — wide workbench layout.
- `audit-integration-history-v2.spec.ts` — audit/integration history.
- `collaboration-notification-drafts-v2.spec.ts` — notification drafts.
- `data-access-quality-v2.spec.ts` — data coverage/quality.
- `erp-information-architecture.spec.ts` — supplier subpages.
- `evidence-graph-ui.spec.ts` — sales graph; AI/search return path.
- `import-persistence.spec.ts` — PR workbook persistence.
- `inline-print-layout-editor.spec.ts` — delivery editor; comments; receipt/receive sheet; unsaved protection.
- `pilot-readiness-governance-v2.spec.ts` — readiness center.
- `po-receiving-invoice-evidence.spec.ts` — PO/receipt/invoice/match evidence.
- `report-filtering.spec.ts` — unified report query.
- `reports-bi.spec.ts` — BI filter persistence.
- `review-first-action-workflow-v2.spec.ts` — review-first lifecycle.
- `rfq-sourcing-detail.spec.ts` — RFQ comparison/recommendation.
- `supplier-operational-profile.spec.ts` — supplier operational evidence.
- `user-data-management-ui.spec.ts` — default business view; mapping/quality/failed rows; CSV entry/return paths.
- `user-role-permission-visibility-v2.spec.ts` — role visibility.
- `workspace-boundary-visibility-v2.spec.ts` — workspace boundary.
- `workspace-setup-config-v2.spec.ts` — workspace setup.

## 5. Feature-only regressions (B)

| Test | Main | Feature / first error | Evidence and recommendation |
| --- | --- | --- | --- |
| `excel-business-workflows.spec.ts` — downloads a real three-sheet supplier invoice template | pass | fail — `toBeVisible` | Formal finance fixture routes were disconnected. Replace with a runtime-supported export contract or hide the unavailable action; never restore invoices. |
| `excel-business-workflows.spec.ts` — exports filtered supplier invoices as a real xlsx workbook | pass | fail — `toBeVisible` | Same boundary. Implement runtime export/empty-state capability or retire with replacement. |
| `list-state-recent-pages.spec.ts` — delivery list keeps filters/sort/page | pass | fail — `toBeGreaterThan` | Legacy delivery list no longer supplies rows. Replace with a canonical runtime list-state test. |
| `navigation-routing.spec.ts` — breadcrumb parents are links while current page is not | pass | fail — `toHaveURL` | This is a genuine shell/navigation regression candidate and must be fixed on the cutover branch. |

Count: **4**. These block merging the existing feature branch.

## 6. Feature fixes (C) and canonical replacements

Exact-name feature fixes:

| Test | Main / first error | Feature | Recommendation |
| --- | --- | --- | --- |
| `sales-document-workflows.spec.ts` — separate list/detail surfaces | fail — 45 s timeout | pass | Keep runtime contract; document the revised assertions. |
| `sales-document-workflows.spec.ts` — independent risk/evidence views | fail — 45 s timeout | pass | Keep runtime contract. |

Native test-name replacement map (main old contract → feature canonical contract):

| Area | Old tests | Canonical replacement | Result / evidence |
| --- | --- | --- | --- |
| Business drilldown | PR filter-return; three-way match detail; invoice/reconciliation/settlement semantic links | runtime PR refresh URL; legacy match missing; finance routes real empty state | feature 3/3 pass |
| Inventory allocation | fixture ATP/SKU/AI cockpit | explicitly created runtime availability and Item Master link | feature pass; main current-contract run fails with inventory POST 404 |
| Inventory documents | adjustment view; warning planning fields; legacy lot/exception semantics | unmigrated route authoritative empty state; lot/exception runtime endpoints | feature 2/2 pass |
| Procurement gate | synthetic RFQ; old overflow wording; generic permissions | real RFQ empty state; runtime overflow; supplier permission/version | feature 3/3 pass |
| Procurement detail/UX | fixture PR detail, OR query, RFQ rows/buyer filter | runtime PR detail/list, RFQ empty state, obsolete buyer filter absent | feature 5/5 pass |
| Sales demand | fixture search/order/AI flow | explicitly created runtime SO with recoverable SO/SKU links | feature pass |
| SKU/PR | old SKU list and fixture PR selector | runtime SKU persistence and approved relationship selector | feature 2/2 pass |
| New runtime identity/links | absent | 6 `runtime-entity-links` tests | feature 6/6 pass; main current-contract run 0/6 |
| New SME closure | absent | supplier authority, runtime homepage, procurement runtime closure | feature 3/3 pass; main current-contract run 0/3 |

The exact current core contract was also run against main business code by temporarily overlaying the unmodified feature test blobs. Main passed 6 and failed 21; feature passed all 27. The overlay was removed and the baseline returned clean to `a760835`.

## 7. Changed failure mode (D)

| Test | Main error | Feature error | Recommendation |
| --- | --- | --- | --- |
| `excel-business-workflows.spec.ts` — parses/maps/validates/confirms import | 45 s timeout | immediate `toBeVisible` failure | Inspect the missing formal import entry/capability on the cutover branch. Do not classify as historical. |

Count: **1**.

## 8. Infrastructure / flaky (E)

Count: **0**.

Evidence: both serial suites completed; no browser launch error, port conflict, stale server, webServer crash, did-not-run test, runtime cross-contamination, or retry-dependent pass occurred. Exact 45-second failures were locator/business-step timeouts and the next test continued normally.

Control results not in A–E: 10 exact-name tests passed on both; `ai-empty-mode.spec.ts` was skipped on both by its existing condition. The 10 shared passes were import idempotency, import rollback, four shell/navigation cases, direct PR→PO persistence, collapsed AI focus, report drilldown, and non-mutating import preview.

## 9. Core 27 comparison

| Revision | Passed | Failed | Skipped | Notes |
| --- | ---: | ---: | ---: | --- |
| Main `a760835` with exact current test blobs | 6 | 21 | 0 | Main lacks runtime inventory/sales/procurement/supplier routes and identity contract; first failures include inventory POST 404. |
| Feature `0a7dc67` | 27 | 0 | 0 | 37.6 s, 1 worker, isolated runtime. |

Main's six current-contract passes were procurement overflow, distinct procurement surfaces, obsolete RFQ buyer-filter absence, collapsed AI focus, sales list/detail separation, and SKU edit persistence. The other 21 are feature-provided runtime capabilities/fixes.

## 10. Runtime isolation verification

Feature worktree before and after both full suites and core runs:

| File | Before | After |
| --- | --- | --- |
| `data/procurement-transactions.json` | missing | missing |
| `data/inventory-runtime.json` | missing | missing |
| `data/sales-orders-runtime.json` | missing | missing |
| `data/supplier-master-runtime.json` | SHA-256 `090DDD...EE5`, mtime `2026-07-13T17:14:13.4859644Z` | identical |
| `data/item-master-runtime.json` | SHA-256 `A2E273...73F`, mtime `2026-07-13T17:14:13.4849607Z` | identical |
| `data/scm-demo.json` | SHA-256 `F2CE12...A79`, mtime `2026-07-13T09:21:17.0641932Z` | identical |

Pure startup, GET, health, browser navigation, and browser tests did not create or modify formal runtime files. `test-results/` was the only generated worktree artifact and was removed. The protected `scm-source` remained untouched with its pre-existing `data/scm-demo.json` modification and `.claude/` directory.

## 11. Audit conclusion

1. Main: **21 passed / 78 failed / 1 skipped**.
2. Original feature: **38 passed / 69 failed / 1 skipped**.
3. The prior aggregate “66 failures” did not preserve test identities, so its exact intersection with main is **not provable**. The reproducible replacement run has 69 feature failures; 65 exact-name tests also fail on main, of which 64 share the same failure mode and one changed mode.
4. Feature-only regressions: **4**.
5. Changed failure modes: **1**.
6. Confirmed infrastructure failures: **0**.
7. Core 27: main **6/21/0**, feature **27/0/0**.
8. Formal runtime writes: **none**.
9. Stale server: **none**; the pre-existing feature 5174/8787 processes were identity-checked and stopped before the audit, and no 5173 listener existed.
10. Recommendation: proceed to Phase B only on a new `codex/authoritative-runtime-cutover` branch from immutable `0a7dc67`; do not merge the existing feature branch. Resolve the four feature-only items and changed import failure through runtime/capability contracts, never by restoring demo fixtures.
