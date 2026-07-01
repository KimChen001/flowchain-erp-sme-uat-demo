# Alpha Feedback Capture Template

Use one entry per issue, confusion point, or pilot observation. Attach screenshots or short screen recordings for all S0, S1, and S2 items.

## Entry

- Reporter:
- Date/time:
- Browser/device:
- Environment: local JSON demo / DB mode / other
- Current HEAD:
- Scenario path: A / B / C / D / E / F / G / H / other
- Starting module:
- Prompt or action:
- Expected:
- Actual:
- Evidence shown: yes / no / unclear
- Navigation target worked: yes / no / unclear
- Recovery path worked: yes / no / unclear
- ActionDraft stayed preview-only: yes / no / not applicable
- Screenshot/video:
- Severity: S0 / S1 / S2 / S3
- Category: AI timeout or no response / navigation or recovery / evidence link / ActionDraft boundary / Planning or MRP explanation / data mismatch / typography or display / performance / permissions or boundary confusion / localization / local runtime setup
- Reproducibility: always / intermittent / once
- Workaround:
- Owner:
- Status: new / triaged / fixed / deferred
- Notes:

## Severity Rules

- S0: cannot continue testing.
- S1: core scenario broken.
- S2: workaround exists.
- S3: polish, copy, or style issue.

## Triage Rules

- S0 and S1 must be cleared before expanding beyond the first 3 internal pilot users.
- S2 can stay open only when a clear workaround is recorded.
- Treat missing evidence, external-provider dependency, or unexpected business mutation as S1 or higher.
- Treat payment, posting, final confirmation, or production-data confusion as a boundary issue even if the UI still works.
