# 13 — Roadmap & Build Phases

> **Current phase: Pilot slice of Phases 0–3 built (2026-11-22). Next: Phase 4 (mastery + readiness, due for the centre by 2027-01-31) and weekly mocks (2027-01-25).** Update this line as work progresses. An agent should read this line first, every session, to know what's actually safe to build right now.
>
> The tutorial-centre pilot (centre starts 2027-01-11) needed a narrow slice across phases first: centre registration, staff + students, question import + review, timed topic tests, offline-safe answers, server scoring, results with topic breakdown. See `PROGRESS.md` for exactly what exists and what was deferred.

## Why phases matter

Later phases genuinely depend on earlier ones. Building the readiness engine (Phase 4) before the assessment submission pipeline (Phase 3) is complete means building on top of nothing — don't skip ahead because a feature "sounds more interesting."

---

## Phase 0 — Setup

- [x] Repository initialized, this docs set committed at the root
- [x] Next.js + TypeScript + Tailwind scaffolded
- [ ] Supabase project created, connected (local stack works; hosted project still to create)
- [x] Environment variables structure in place (`.env.example`)
- [x] CI basics (lint + typecheck + unit tests on PR)

## Phase 1 — Foundation

- [x] Auth (Supabase Auth, email/password; students sign in with centre code + student number)
- [x] `profiles` table + trigger to create on signup
- [x] `institutions`, `institution_memberships` tables + RLS
- [x] `students`, `classes`, `class_teachers` + RLS (class membership is `students.class_id` for now)
- [x] Role-based access control implemented and **tested** (two fake institutions, confirm isolation holds)
- [x] Basic institution registration flow, including exam-focus selection (`docs/09`)
- [x] Student accounts created by the centre (CSV import + one-by-one); self sign-up deferred

**Exit criteria:** a user can register, an institution can register, an admin can add a teacher and a student, and cross-institution access is confirmed blocked by an actual test, not just code review.

## Phase 2 — Content

- [x] `examinations`, `subjects` seeded (11 subjects, D16); topics come from the centre's import, marked pending verification
- [x] `questions`, `question_options` + review workflow (pilot: approve = publish) (draft → review → approved → published)
- [x] Question authoring UI (manual creation)
- [x] Bulk question import with validation + error reporting
- [x] Institution-owned vs. platform-owned content separation enforced

**Exit criteria:** an admin can create, review, and publish a question; an institution can upload their own question bank without seeing or affecting anyone else's.

## Phase 3 — Assessment Engine

- [x] Assessment builder (filtered selection; manual pick deferred)
- [x] Assessment assignment (whole centre / class)
- [x] CBT delivery UI: timer, navigation, answer persistence through network drop
- [x] Server-side scoring pipeline (`docs/08`)
- [x] Immutable attempt records, idempotent submission

**Exit criteria:** a student can take a full timed assessment, including surviving a simulated connection drop mid-assessment, and receive a server-calculated result.

## Phase 4 — Intelligence

- [x] `topic_performance` calculation
- [ ] `student_mastery` calculation (with confidence/evidence rules — `docs/07`)
- [ ] `readiness_scores` calculation (canonical v1 formula — `docs/07`)
- [ ] Rule-based recommendation engine
- [ ] Readiness explanation text generation (rule-based, not AI, for v1)

**Exit criteria:** after submitting an assessment, a student sees topic breakdown, an updated readiness score with confidence, an explanation, and one clear next recommendation.

## Phase 5 — Dashboards & Reporting

- [ ] Student dashboard (5-question rule — `docs/02`)
- [ ] Teacher dashboard (class + student view, weak-topic heatmap)
- [ ] Institution admin dashboard (cohort readiness distribution)
- [ ] Basic reports (student, class, subject)
- [ ] Readiness Card component built to spec (`docs/10`), used consistently across student dashboard and reports

**Exit criteria:** a teacher can open their dashboard and immediately identify which students need attention and with what topic, without manually cross-referencing spreadsheets.

## Phase 6 — Billing

- [ ] `plans`, `subscriptions`, `payments`, `feature_entitlements` implemented per `docs/09`
- [ ] Payment provider integration (Paystack or Flutterwave) with webhook verification
- [ ] Entitlement checks wired into gated features
- [ ] Individual student pricing ladder functional end-to-end
- [ ] Institutional plan selection functional end-to-end

**Exit criteria:** a real payment can be made, verified server-side, and correctly unlocks the paid features — and a failed/expired payment correctly restricts access without destroying historical data.

## Phase 7 — Pilot Readiness

- [ ] Security checklist complete (`docs/06`)
- [ ] Backups configured and a restore actually tested once
- [ ] Privacy policy + terms of service published
- [ ] Basic notification system (in-app + email minimum)
- [ ] Error monitoring / logging in place
- [ ] Full end-to-end test passes: register → diagnostic → result → readiness → recommendation → practice → reassess

**Exit criteria:** ready to onboard the first real pilot institution and real students, per the go-to-market approach in the original product research (founder-led, small pilot, 1–3 institutions).

---

## Explicitly deferred to post-v1 (do not pull forward without a scope discussion)

Adaptive testing, AI tutor, advanced proctoring, full offline CBT, white-label portals, predictive outcome modeling, parent messaging, WhatsApp/SMS, multi-language, theory grading, institutional benchmarking beyond Pro tier's basic version. Full list: `docs/03-mvp-scope.md`.

## Updating this file

Whoever completes a phase updates the "Current phase" line at the top and checks off the relevant boxes in the same PR that completes the work — not as a separate cleanup task that might not happen.
