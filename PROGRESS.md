# Verity — Progress Log

> The agent reads this at the start of every session and updates it at the end. It is the memory between sessions. Keep entries short and factual. Newest first.

## Current state

- **Current phase:** Pilot slice built (Phases 0–3 + topic_performance). See `docs/13`.
- **Last completed task:** Early Access pass and payments (2026-11-23, PR open)
- **Next task:** Before Jan 11: create the hosted Supabase project + Vercel deploy, apply migrations, register the pilot centre. Then Phase 4 readiness + teacher views (Jan 31).
- **Blocked on / waiting for founder:** see "Open questions" below

## Open questions for the founder

(Copy from `docs/23-decisions-log.md` section "Open" when a task needs the answer. Remove when answered.)

- [ ] O4 — Payment provider: Paystack proposed (D29); founder to create the account and add PAYSTACK_SECRET_KEY
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

### 2026-11-23 — Early Access pass and payments
- Did: migration `20261123000100_early_access_pass.sql` (`payments`, `student_passes`, RLS, `activate_online_pass()` service-role only). Free-trial rule in `lib/entitlements/pass.ts` enforced in `startAttempt` (402 `pass_required` / `trial_single_subject_only`). Paystack hosted checkout (`lib/billing/*`, `/app/pass`, `/app/pass/return`, webhook `/api/v1/billing/paystack/webhook`). Student self sign-up `/register/student`: no code → online centre (`ONLINE_CENTRE_CODE`); centre code → join request the centre accepts on its Students page. Online is always ₦1,000. Platform admin area `/admin`: centres, students, passes, cash/free passes, money in, latest payments. Pass column on the Students page. Login tabs now "Centre student" / "Email".
- Verified: 78 unit, 61 integration (new `billing.test.ts`: trial, race, centre cash, payment race, amount mismatch, ₦1,000 server price, join requests, RLS), e2e incl. paywall, admin cash passes, solo sign-up, join request; lint, typecheck, build.
- Decisions/assumptions: D25–D31. Test fixtures give students a free pilot pass unless `{ passes: false }`.
- Next: founder creates Paystack account and the online centre; apply the migration to staging; give the pilot centre's students passes.

### 2026-11-22 — Full JAMB mock sitting
- Did: migration `20261122000300_jamb_full_sitting.sql` (`student_subjects` with RLS, `assessments.format` = single_subject | jamb_utme, subject_id nullable for a sitting). Student subjects from the CSV "subjects" column or the Students page. Builder `/inst/assessments/new?kind=jamb_full` (defaults 60 English + 40 per subject, 120 min). Each attempt gets English then the student's 3 subjects (`sittingBlocks`). Take screen subject tabs and grouped grid. Results JAMB-style (`lib/scoring/jamb.ts`, `lib/assessments/jamb-results.ts`): each subject /100, total /400, on the result slip, teacher table and CSV.
- Verified: 65 unit, 47 integration (new `jamb-sitting.test.ts` incl. RLS on student_subjects and cross-centre writes), e2e incl. full sitting, lint, typecheck, build.
- Decisions/assumptions: D22–D24.
- Next: hosted environments (waiting on founder tokens), Phase 4 readiness + teacher views.

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
