---
description: Check a phase's exit criteria honestly before moving on
argument-hint: <phase number, e.g. 1>
---
Verify Phase $ARGUMENTS against `docs/13-roadmap-and-phases.md`.

For every checklist item and exit criterion:
- State **Done / Not done / Partly**.
- Give evidence (file, test name, command output) — not assumptions.
- For anything involving security or isolation, run the relevant test suite and show the result.
- Tell me exactly how I can verify it myself.

Finish with a clear verdict: "Phase $ARGUMENTS is complete" or the list of what remains. Do not recommend starting the next phase unless every item is genuinely done. Update `docs/13` checkboxes and `PROGRESS.md` only for items proven done.
