# 13 — Roadmap & Build Phases

> **Current phase: Phase 0 — not yet started.** Update this line as work progresses. An agent should read this line first, every session, to know what's actually safe to build right now.

## Why phases matter

Later phases genuinely depend on earlier ones. Building the readiness engine (Phase 4) before the assessment submission pipeline (Phase 3) is complete means building on top of nothing — don't skip ahead because a feature "sounds more interesting."

---

## Phase 0 — Setup

- [ ] Repository initialized, this docs set committed at the root
- [ ] Next.js + TypeScript + Tailwind scaffolded
- [ ] Supabase project created, connected
- [ ] Environment variables structure in place (`.env.example`)
- [ ] CI basics (lint + typecheck on PR, at minimum)

## Phase 1 — Foundation

- [ ] Auth (Supabase Auth, email/password)
- [ ] `profiles` table + trigger to create on signup
- [ ] `institutions`, `institution_memberships` tables + RLS
- [ ] `students`, `classes`, `class_memberships`, `class_teachers` + RLS
- [ ] Role-based access control implemented and **tested** (two fake institutions, confirm isolation holds)
- [ ] Basic institution registration flow, including exam-focus selection (`docs/09`)
- [ ] Basic student registration flow

**Exit criteria:** a user can register, an institution can register, an admin can add a teacher and a student, and cross-institution access is confirmed blocked by an actual test, not just code review.

## Phase 2 — Content

- [ ] `examinations`, `subjects`, `topics` seeded for JAMB + WAEC (v1 subject scope per `docs/03`)
- [ ] `questions`, `question_options` + review workflow (draft → review → approved → published)
- [ ] Question authoring UI (manual creation)
- [ ] Bulk question import with validation + error reporting
- [ ] Institution-owned vs. platform-owned content separation enforced

**Exit criteria:** an admin can create, review, and publish a question; an institution can upload their own question bank without seeing or affecting anyone else's.

## Phase 3 — Assessment Engine

- [ ] Assessment builder (manual + filtered selection)
- [ ] Assessment assignment (individual student / class)
- [ ] CBT delivery UI: timer, navigation, answer persistence through network drop
- [ ] Server-side scoring pipeline (`docs/08`)
- [ ] Immutable attempt records, idempotent submission

**Exit criteria:** a student can take a full timed assessment, including surviving a simulated connection drop mid-assessment, and receive a server-calculated result.

## Phase 4 — Intelligence

- [ ] `topic_performance` calculation
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
