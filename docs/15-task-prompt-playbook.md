# 15 — Full Task Prompt Playbook

> Every prompt in this file is written to be copied and pasted **exactly as-is**, in order, one at a time, into your AI coding agent session. Don't skip ahead. Don't combine two tasks into one prompt. Follow the loop from `docs/14-how-to-instruct-the-agent.md` for every single one: plan → build → review → test yourself → commit → check the box in `docs/13-roadmap-and-phases.md` → move to the next.

**Total: 45 tasks across 8 phases.** This will take weeks, not days — that's expected and correct for a project this size.

Before Task 0.1, make sure you've already run the orientation prompt from `docs/14`.

---

## PHASE 0 — Setup (3 tasks)

### Task 0.1 — Project scaffold + Supabase connection

```
Task: Scaffold the Next.js (App Router) + TypeScript + Tailwind CSS project,
following the folder structure in docs/11-coding-standards.md. Create a new
Supabase project and connect it.

Relevant docs: docs/04-architecture.md, docs/11-coding-standards.md

Give me a plan first: what you'll create, what commands you'll run, what I need
to do manually (e.g., creating accounts/projects on Supabase's website).

Scope: setup only. No features, no database tables yet.

When done: tell me exactly how to run the dev server and confirm it's working.
```

### Task 0.2 — Environment variables + secrets discipline

```
Task: Set up the environment variable structure per docs/11-coding-standards.md —
a working .env.local (with placeholder values), a committed .env.example, and
confirm .env* is git-ignored.

Relevant docs: docs/11-coding-standards.md, docs/06-auth-permissions-security.md

Scope: only env/config setup. Don't add any real secret values — I'll fill
those in myself.

When done: show me exactly which values I need to fill in and where to get them
(Supabase dashboard, etc.).
```

### Task 0.3 — CI basics

```
Task: Add basic CI (GitHub Actions or equivalent) that runs lint and TypeScript
type-checking on every pull request.

Relevant docs: docs/11-coding-standards.md

Scope: CI configuration only.

When done: tell me how to see it run (e.g., open a test PR).
```

**Phase 0 checkpoint:** before Phase 1, confirm — does the dev server start with no errors? Are secrets confirmed git-ignored? Does CI actually run on a test PR?

---

## PHASE 1 — Foundation (7 tasks)

### Task 1.1 — Authentication

```
Task: Implement Supabase Auth with email/password sign-up and login. Create the
`profiles` table and a trigger that creates a profile row automatically when a
new auth user signs up.

Relevant docs: docs/05-database-schema.md (profiles table), docs/06-auth-permissions-security.md

Give me a plan first.

Scope: auth + profiles only. No institutions, no roles yet.

When done: tell me how to test sign-up and login myself in the browser.
```

### Task 1.2 — Institutions schema + RLS

```
Task: Create the `institutions` and `institution_memberships` tables exactly as
defined in docs/05-database-schema.md, including the RLS policy pattern shown
there. Write this as a versioned migration file.

Relevant docs: docs/05-database-schema.md, docs/06-auth-permissions-security.md

Give me a plan first, and show me the migration file content before applying it.

Scope: schema + RLS only, no UI yet.

When done: tell me how to verify the RLS policy actually blocks cross-institution
access using the Supabase SQL editor or a test script.
```

### Task 1.3 — Students, classes, and role tables

```
Task: Create the `students`, `classes`, `class_memberships`, and `class_teachers`
tables per docs/05-database-schema.md, with matching RLS policies following the
pattern already established for `institutions`.

Relevant docs: docs/05-database-schema.md, docs/06-auth-permissions-security.md

Give me a plan and the migration content first.

Scope: schema + RLS only.

When done: tell me how to verify these policies myself.
```

### Task 1.4 — Server-side permission helpers

```
Task: Build reusable server-side helper functions/middleware that check a
user's role and institution membership before allowing an action, per the
permission matrix in docs/06-auth-permissions-security.md. These should be
used by every future server route that touches institution-scoped data.

Relevant docs: docs/06-auth-permissions-security.md, docs/12-api-reference.md

Give me a plan first.

Scope: the helper functions themselves, plus one example route that uses them
correctly. Don't build every feature route yet.

When done: show me the example route and explain how I'd reuse this pattern
going forward.
```

### Task 1.5 — Institution registration flow

```
Task: Build the institution registration UI — institution name, type
(school / tutorial centre), and the exam-focus selection (WAEC only / JAMB
only / both) from docs/09-pricing-billing-entitlements.md. On submit, create
the institution and make the registering user its owner.

Relevant docs: docs/02-users-and-journeys.md, docs/09-pricing-billing-entitlements.md,
docs/10-design-system.md (use the real design tokens, not default styling)

Give me a plan first.

Scope: this registration flow only. No student import, no billing yet.

When done: tell me exactly how to test this myself end-to-end.
```

### Task 1.6 — Student registration flow

```
Task: Build student registration — both paths: (a) an independent student
signing up directly, and (b) a student joining via an institution invite/code.
Collect only what docs/02-users-and-journeys.md specifies for onboarding
(name, email/phone, password, examination(s), subjects) — nothing extra.

Relevant docs: docs/02-users-and-journeys.md, docs/10-design-system.md

Give me a plan first.

Scope: registration only, no dashboard yet.

When done: tell me how to test both paths myself.
```

### Task 1.7 — Institution isolation verification (critical — do not skip)

```
Task: Write an explicit test (or a manual test script if automated testing
isn't set up yet) that creates two separate fake institutions with their own
students, then confirms a user from Institution A cannot read, list, or query
Institution B's students, classes, or any institution-scoped data — via the
UI, direct Supabase client calls, and a direct database query.

Relevant docs: docs/06-auth-permissions-security.md, docs/11-coding-standards.md

This is a critical-path test per docs/11 — treat it accordingly.

When done: walk me through exactly what was tested and show me the result,
including at least one attempted cross-institution access that was correctly
blocked.
```

**Phase 1 checkpoint — do not proceed to Phase 2 until all of these are true:**
- [ ] A user can register, an institution can register
- [ ] An admin can add a teacher and a student
- [ ] Cross-institution access is confirmed blocked by an actual test (Task 1.7), not just code review

---

## PHASE 2 — Content (6 tasks)

### Task 2.1 — Seed examinations, subjects, topics

```
Task: Create and seed the `examinations`, `subjects`, and `topics` tables with
JAMB/UTME and WAEC/WASSCE and their initial subject/topic sets, per the v1
scope in docs/03-mvp-scope.md. Use a small, focused subject list to start —
don't try to seed every possible subject.

Relevant docs: docs/05-database-schema.md, docs/03-mvp-scope.md

Give me a plan first, including which specific subjects you'd seed for a v1
launch and why.

When done: show me how to view the seeded data.
```

### Task 2.2 — Question bank schema + review workflow

```
Task: Create the `questions` and `question_options` tables per
docs/05-database-schema.md, including the status lifecycle
(draft → review → approved → published → archived) and RLS distinguishing
platform-owned content (institution_id is null) from institution-owned content.

Relevant docs: docs/05-database-schema.md, docs/08-assessment-content-engine.md

Give me a plan and migration content first.

Scope: schema only, no UI yet.

When done: tell me how to verify the ownership separation via RLS.
```

### Task 2.3 — Question authoring UI

```
Task: Build a form for creating a multiple-choice question — question text,
4 options with one marked correct, subject, topic, difficulty, explanation.
New questions start in 'draft' status.

Relevant docs: docs/08-assessment-content-engine.md, docs/10-design-system.md

Give me a plan first.

Scope: creation only, not the review/approval workflow yet.

When done: tell me how to create a test question myself.
```

### Task 2.4 — Question review & approval workflow

```
Task: Build the review workflow UI — an admin/reviewer can see questions in
'review' status, approve or reject them, and approved questions move to
'approved' then can be explicitly published. Only 'published' questions should
ever be eligible for use in an assessment.

Relevant docs: docs/08-assessment-content-engine.md

Give me a plan first.

When done: tell me how to walk a test question through the full lifecycle
myself.
```

### Task 2.5 — Bulk question import

```
Task: Build CSV bulk import for questions, following the template fields in
docs/08-assessment-content-engine.md. Validate before import — missing fields,
invalid subject/topic references, invalid correct-answer marker — and show a
clear preview + error report before anything is committed to the database.

Relevant docs: docs/08-assessment-content-engine.md

Give me a plan first.

Scope: import + validation only.

When done: give me a sample CSV (including at least one intentionally broken
row) so I can test the validation myself.
```

### Task 2.6 — Content ownership separation test

```
Task: Verify that an institution's own uploaded/created questions are never
visible to or usable by a different institution, and that platform-owned
content is correctly available to everyone according to entitlement rules
(entitlements aren't built yet — for now just confirm visibility logic).

Relevant docs: docs/08-assessment-content-engine.md, docs/06-auth-permissions-security.md

When done: show me exactly what was tested.
```

**Phase 2 checkpoint:** can an admin create, review, and publish a question? Can an institution upload their own bank without seeing or affecting anyone else's?

---

## PHASE 3 — Assessment Engine (6 tasks)

### Task 3.1 — Assessment builder (manual selection)

```
Task: Build the assessment creation flow — name, examination, subject,
duration, question type (v1: mock/diagnostic/practice/topic_test/institutional),
and manual question selection from the published question pool.

Relevant docs: docs/08-assessment-content-engine.md, docs/05-database-schema.md
(assessments, assessment_questions tables)

Give me a plan first.

Scope: manual selection only, not the filtered/blueprint mode yet.

When done: tell me how to create a test assessment myself.
```

### Task 3.2 — Filtered selection mode

```
Task: Add a second assessment-creation mode where the creator specifies
subject + topic(s) + difficulty mix + question count, and the system pulls a
random eligible set from the approved/published pool automatically.

Relevant docs: docs/08-assessment-content-engine.md

Give me a plan first.

When done: tell me how to test this myself.
```

### Task 3.3 — Assessment assignment

```
Task: Build assignment of an assessment to either an individual student or an
entire class, using the assessment_assignments table, with a due date.

Relevant docs: docs/05-database-schema.md, docs/02-users-and-journeys.md

Give me a plan first.

When done: tell me how to assign a test assessment myself and confirm the
right student(s) can see it.
```

### Task 3.4 — CBT delivery interface

```
Task: Build the actual assessment-taking screen — question display, visible
timer, forward/back navigation, jump-to-question, mark-for-review, and an
answered/unanswered status indicator. Follow the design system in
docs/10-design-system.md exactly, including mobile-first layout.

Relevant docs: docs/08-assessment-content-engine.md, docs/10-design-system.md,
docs/02-users-and-journeys.md

Give me a plan first.

Scope: the interface and interaction only — wire it to real data but don't
build final scoring yet.

When done: tell me how to take a full test assessment myself, on both mobile
and desktop viewport sizes.
```

### Task 3.5 — Answer persistence through network loss

```
Task: Implement the answer-persistence requirement from docs/08 and
docs/04-architecture.md: answers save to local state the instant they're
selected (before any network call), get queued for sync, and automatically
sync on reconnect after a dropped connection. Show a clear, honest UI state —
"Saved on this device" vs. "Synced" — never claim synced before the server
actually confirms it.

Relevant docs: docs/08-assessment-content-engine.md, docs/04-architecture.md

Give me a plan first — this is one of our stated product differentiators, so
I want to understand the approach before you build it.

When done: tell me exactly how to simulate a dropped connection myself
(e.g., browser dev tools offline mode) and verify no answers are lost.
```

### Task 3.6 — Server-side scoring pipeline

```
Task: Build the full scoring pipeline per docs/08-assessment-content-engine.md:
on submission, validate the attempt server-side, compare responses against
correct answers, calculate score/percentage/time-used, save the attempt as an
immutable record, and ensure a retried/duplicate submit request cannot create
a second attempt or double-score (idempotency).

Relevant docs: docs/08-assessment-content-engine.md, docs/06-auth-permissions-security.md

Give me a plan first — this is critical-path logic per docs/11-coding-standards.md
and needs tests, not just a working demo.

Scope: scoring and submission only. Don't build the intelligence layer
(topic mastery, readiness) yet — that's Phase 4.

When done: tell me how to test both a normal submission and a simulated
duplicate/retried submission myself.
```

**Phase 3 checkpoint:** can a student take a full timed assessment, survive a simulated connection drop mid-assessment, and get a server-calculated result?

---

## PHASE 4 — Intelligence (5 tasks)

### Task 4.1 — Topic performance calculation

```
Task: After an assessment is scored, calculate and store topic_performance
records per docs/05-database-schema.md — questions attempted, correct answers,
and percentage, broken down by topic.

Relevant docs: docs/05-database-schema.md, docs/07-readiness-engine.md

Give me a plan first.

When done: tell me how to verify the topic breakdown myself after taking a
test assessment.
```

### Task 4.2 — Student mastery calculation

```
Task: Implement the student_mastery calculation exactly per
docs/07-readiness-engine.md — including the minimum evidence rule (don't
assign "Strong"/"Good" below the evidence threshold) and the mastery
labels (Needs Attention / Developing / Good / Strong).

Relevant docs: docs/07-readiness-engine.md, docs/05-database-schema.md

Give me a plan first.

Scope: mastery calculation only.

When done: tell me how to verify a mastery score and its evidence count
myself.
```

### Task 4.3 — Readiness score calculation

```
Task: Implement the canonical v1 readiness formula exactly as defined in
docs/07-readiness-engine.md (30% recent performance / 30% topic mastery /
15% consistency / 10% syllabus coverage / 15% mock performance), the readiness
bands, and the confidence-level rules. Store weights in a config table, not
hardcoded. Never overwrite historical readiness_scores rows — this table is
append-only, tagged with an algorithm_version.

Relevant docs: docs/07-readiness-engine.md, docs/05-database-schema.md

Give me a plan first — walk me through how you're implementing the weighting
and the confidence rule before you build it.

When done: show me a real readiness score calculated for a test student,
including its confidence level and which components fed it.
```

### Task 4.4 — Recommendation engine

```
Task: Implement the rule-based recommendation engine exactly per the example
rules in docs/07-readiness-engine.md (weak topic → practice recommendation,
declining trend → review recommendation, low mock count near exam → mock
recommendation, etc.). Only one primary "Next Best Action" should surface on
the student dashboard even if multiple rules fire — ranked by priority.

Relevant docs: docs/07-readiness-engine.md

Give me a plan first.

When done: tell me how to trigger at least two different recommendation rules
myself with test data.
```

### Task 4.5 — Explanation text + result screen wiring

```
Task: Wire topic performance, mastery, readiness, and the top recommendation
into the assessment result screen, with plain-language explanation text
(rule-based, not AI, for v1) matching the tone and example format in
docs/07-readiness-engine.md — never a bare number with no explanation.

Relevant docs: docs/07-readiness-engine.md, docs/02-users-and-journeys.md

Give me a plan first.

When done: take a full test assessment myself and confirm the result screen
shows score, topic breakdown, readiness with confidence, an explanation, and
one clear next step.
```

**Phase 4 checkpoint:** after submitting an assessment, does the student see topic breakdown, updated readiness with confidence, an explanation, and one clear recommendation?

---

## PHASE 5 — Dashboards & Reporting (6 tasks)

### Task 5.1 — Readiness Card component

```
Task: Build the reusable ReadinessCard component exactly per the spec in
docs/10-design-system.md — reference label, rotated status stamp, mono score
number, confidence tag, topic bars (weak topics in brick color, others in
pine), and the "Updated X ago" freshness footer. This should be usable both
on the student dashboard and inside printable/downloadable reports later.

Relevant docs: docs/10-design-system.md, docs/07-readiness-engine.md

Give me a plan first.

When done: show me this component rendered with real test data.
```

### Task 5.2 — Student dashboard

```
Task: Build the student dashboard following the 5-question rule from
docs/02-users-and-journeys.md — how am I doing, how ready am I, where am I
weak, am I improving, what should I do next — all visible without scrolling
on mobile. Use the ReadinessCard component from Task 5.1.

Relevant docs: docs/02-users-and-journeys.md, docs/10-design-system.md

Give me a plan first.

When done: tell me how to view this as a test student myself, on mobile
viewport specifically.
```

### Task 5.3 — Teacher dashboard

```
Task: Build the teacher dashboard — assigned classes/students, a class-wide
weak-topic heatmap (not a wall of individual scores), and a one-click path
toward assigning an intervention/practice set to identified weak students.

Relevant docs: docs/02-users-and-journeys.md, docs/10-design-system.md

Give me a plan first.

When done: tell me how to view this as a test teacher and confirm it correctly
only shows their assigned classes.
```

### Task 5.4 — Institution admin dashboard

```
Task: Build the institution admin dashboard — total/active students, average
readiness, students requiring attention, weakest subject/topic across the
cohort, and readiness distribution.

Relevant docs: docs/02-users-and-journeys.md, docs/10-design-system.md

Give me a plan first.

When done: tell me how to verify this myself as a test admin.
```

### Task 5.5 — Basic reports

```
Task: Build basic report views — student report, class report, subject
report — using the same hairline-grid data table pattern specified in
docs/10-design-system.md, not a generic bordered table.

Relevant docs: docs/10-design-system.md

Give me a plan first.

When done: tell me how to generate a test report myself.
```

### Task 5.6 — Mobile responsiveness pass

```
Task: Do a full pass across every dashboard and report built in this phase,
confirming mobile-first layout actually works well on a small viewport, not
just "doesn't break." Fix anything that isn't genuinely usable on a phone.

Relevant docs: docs/10-design-system.md, docs/02-users-and-journeys.md

When done: walk me through what you checked and fixed.
```

**Phase 5 checkpoint:** can a teacher open their dashboard and immediately identify which students need attention and with what topic, without cross-referencing anything manually?

---

## PHASE 6 — Billing (6 tasks)

### Task 6.1 — Billing schema

```
Task: Create the plans, subscriptions, payments, and feature_entitlements
tables exactly per docs/05-database-schema.md and docs/09-pricing-billing-
entitlements.md, including the confirmed individual pricing ladder and
institutional tiers as seed data for the `plans` table.

Relevant docs: docs/05-database-schema.md, docs/09-pricing-billing-entitlements.md

Give me a plan and migration content first.

When done: show me the seeded plans data.
```

### Task 6.2 — Entitlement-check helper

```
Task: Build a reusable server-side helper that checks whether an account
currently holds a given entitlement key (from the canonical list in
docs/09-pricing-billing-entitlements.md), used to gate features throughout
the app. This should read from feature_entitlements, never check plan name or
payment status directly in feature code.

Relevant docs: docs/09-pricing-billing-entitlements.md, docs/11-coding-standards.md

Give me a plan first.

When done: show me one real example of a feature gated using this helper.
```

### Task 6.3 — Payment provider integration (checkout)

```
Task: Integrate [Paystack or Flutterwave — tell it which one you've chosen]
for initiating a payment from the pricing ladder / institutional plan
selection UI.

Relevant docs: docs/09-pricing-billing-entitlements.md, docs/06-auth-permissions-security.md

Give me a plan first.

Scope: checkout initiation only — the webhook confirmation is the next task,
don't activate anything based on the client-side redirect alone.

When done: tell me how to test a payment in the provider's sandbox/test mode
myself.
```

### Task 6.4 — Payment webhook + verification

```
Task: Build the payment webhook handler — verify the provider's signature,
confirm payment status server-side, and only then activate the subscription
and update entitlements. Use payments.provider_reference as the idempotency
key to guard against duplicate webhook deliveries.

Relevant docs: docs/06-auth-permissions-security.md, docs/09-pricing-billing-entitlements.md,
docs/12-api-reference.md

Give me a plan first — this is critical-path logic per docs/11, needs tests
covering success, failure, and a duplicate webhook delivery.

When done: walk me through how you tested all three of those cases.
```

### Task 6.5 — Individual student pricing ladder, end-to-end

```
Task: Wire the full individual pricing ladder end-to-end — Free through
JAMB+WAEC combined — from the pricing UI through checkout, webhook
confirmation, and entitlement activation. Confirm the Single Assessment
(₦300) tier correctly behaves as a one-time purchase, not a subscription.

Relevant docs: docs/09-pricing-billing-entitlements.md

Give me a plan first.

When done: test a real (sandbox) purchase myself, end to end.
```

### Task 6.6 — Institutional billing, end-to-end

```
Task: Wire institutional plan selection (Starter/Growth/Pro) end-to-end,
linked to the exam-focus selection from institution registration (Task 1.5).

Relevant docs: docs/09-pricing-billing-entitlements.md

Give me a plan first.

When done: test a real (sandbox) institutional purchase myself, end to end.
```

**Phase 6 checkpoint:** can a real (sandbox) payment be made, verified server-side, and correctly unlock the paid features? Does a failed/expired payment correctly restrict access without destroying historical data?

---

## PHASE 7 — Pilot Readiness (6 tasks)

### Task 7.1 — Security checklist audit

```
Task: Go through the full security checklist in docs/06-auth-permissions-
security.md item by item, confirm each one is actually true (not assumed),
and fix anything that isn't.

Relevant docs: docs/06-auth-permissions-security.md

When done: give me the checklist back with each item marked confirmed, and
show me evidence for the ones that matter most (RLS coverage, webhook
verification, no secrets in the repo).
```

### Task 7.2 — Backups + restore test

```
Task: Confirm automated backups are configured on the Supabase project, and
actually perform one test restore (not just confirm the setting exists) to
verify the process genuinely works.

Relevant docs: docs/06-auth-permissions-security.md

When done: walk me through what you tested and the result.
```

### Task 7.3 — Privacy policy + terms of service

```
Task: Add privacy policy and terms of service pages to the site, reflecting
the data-handling principles in docs/06-auth-permissions-security.md
(minimal data collection, minor/child-safety considerations, institution data
isolation). Flag clearly that I should have these reviewed by an actual
lawyer before real launch — don't present this as final legal text.

Relevant docs: docs/06-auth-permissions-security.md

When done: show me the pages.
```

### Task 7.4 — Notification system

```
Task: Build the minimum notification system for v1 — in-app notifications
plus email — covering at minimum: assessment assigned, result ready, and
recommendation available.

Relevant docs: docs/03-mvp-scope.md (notifications are explicitly in-app +
email only in v1 — no SMS/WhatsApp)

Give me a plan first.

When done: tell me how to trigger and see a test notification myself.
```

### Task 7.5 — Error monitoring

```
Task: Set up basic error monitoring/logging so we find out about production
errors without waiting for a user to report them.

Relevant docs: docs/11-coding-standards.md

Give me a plan first (which tool you'd use and why).

When done: tell me how to verify it's actually capturing errors.
```

### Task 7.6 — Full end-to-end pilot test

```
Task: Run and confirm the complete core loop works end-to-end, exactly as
described in docs/01-product-vision.md: register → select exam/subjects →
diagnostic → result with topic breakdown → readiness with confidence →
recommendation → practice → reassess → updated readiness. Do this as a real
walkthrough, not a unit test in isolation.

Relevant docs: docs/01-product-vision.md, docs/13-roadmap-and-phases.md

When done: walk me through the full flow yourself, step by step, so I can
verify it end-to-end too before we talk to a real pilot school.
```

**Phase 7 checkpoint — this is the actual "ready for real users" gate:**
- [ ] Every item above is confirmed, not assumed
- [ ] You (the founder) have personally walked through the full core loop and it worked
- [ ] You're ready to onboard the first real pilot institution per the go-to-market approach

---

## After Phase 7

You're not "done" — you're ready for a small, founder-led pilot (1–3 institutions, per the original go-to-market research). Everything past this point should be driven by real pilot feedback, not by continuing to build speculative features. Go back to `docs/03-mvp-scope.md`'s "out of scope" list before adding anything new — most of what feels like an obvious next feature is deliberately deferred there for a reason.
