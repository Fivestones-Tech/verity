# Verity — Progress Log

> The agent reads this at the start of every session and updates it at the end. It is the memory between sessions. Keep entries short and factual. Newest first.

## Current state

- **Current phase:** Pilot slice built (Phases 0–3 + topic_performance). See `docs/13`.
- **Last completed task:** One-subject weekly mocks (2026-11-22)
- **Next task:** Before Jan 11: create the hosted Supabase project + Vercel deploy, apply migrations, register the pilot centre. Then Phase 4 readiness + teacher views (Jan 31), and the full JAMB sitting (English + 3 subjects, 2 h) before end of Feb.
- **Blocked on / waiting for founder:** see "Open questions" below

## Open questions for the founder

(Copy from `docs/23-decisions-log.md` section "Open" when a task needs the answer. Remove when answered.)

- [ ] O4 — Payment provider (needed before Phase 6)
- [x] O3 — subjects answered (D16, 11 subjects); combinations still open
- [ ] O1 — Institutional pricing by exam focus (needed before Phase 6)

## Session log

Format:

```
### YYYY-MM-DD — Task X.Y — short title
- Did: what changed (files/areas)
- Verified: how it was checked (commands run, manual test done)
- Docs touched: which docs changed, if any
- Decisions/assumptions: anything the founder should know
- Next: the very next task
```

### 2026-11-22 — Weekly mocks (one subject per mock)
- Did: `assessment_type = 'mock'` from the builder (`/inst/assessments/new?kind=mock`). The server picks topics from the whole syllabus (form topic ids ignored). Defaults in `lib/assessments/kinds.ts`: JAMB English 60 Q / 40 min, other JAMB subjects 40 Q / 30 min, WAEC 50 Q / 60 min; teachers can change them. Mocks are labelled on the tests list, results, instructions and student home.
- Verified: 54 unit, 36 integration (new `mocks.test.ts`: whole syllabus, ignores another centre's topic ids, refuses oversize), e2e incl. mock creation, lint, typecheck, build.
- Decisions/assumptions: founder chose "both": one-subject mocks now, full JAMB sitting (English + the student's 3 subjects, 180 Q, 2 h) next. No schema change.
- Next: full JAMB sitting (needs each student's subject combination), hosted environments, Phase 4.

### 2026-11-22 — Pilot slice — timed topic tests for the tutorial-centre pilot
- Did: Next.js 16 + Supabase app. Migrations `supabase/migrations/20261122000100_pilot_core.sql` (schema, RLS on every table, server-only write functions) and `..._seed_exams_subjects.sql` (JAMB + WAEC, 11 subjects). Centre registration, staff, classes, student CSV import with sign-in slips, question CSV import (validate → preview → confirm) and single-question form, second-person review, topic-test builder, CBT taking screen with IndexedDB answers + sync engine + service worker, server scoring, result slip with topic breakdown + next step + mistake review, teacher results with CSV export.
- Verified: `npm test` (47 unit), `npm run test:integration` (33, two real centres, RLS isolation, idempotent and concurrent submit, late sync), `npm run test:e2e` (full flow in Chromium incl. offline mid-test + offline reload; screenshots in e2e/artifacts, git-ignored), lint, typecheck, build.
- Docs touched: 13 (phase marker + checkboxes), 23 (D16–D21).
- Decisions/assumptions: D17 student sign-in by centre code, D18 approve = publish, D19 6 h late-sync window, D20 centre-private topics, D21 subtopics roll up. Cache Components left off in next.config.
- Not built yet (deliberately): readiness score, mastery, recommendations engine (Phase 4); full mocks; billing; notifications; parent view; manual question picking in the builder; two-device "continue here?" prompt; question flagging by students; rate limiting beyond Supabase Auth defaults (set at deploy time).
- Next: hosted environments, then mocks + readiness.
