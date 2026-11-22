# 03 — MVP Scope

> This is the single most important document for preventing this project from stalling. Read it before adding anything to the roadmap.

## The MVP must prove one thing

> Can we use digital assessment data to help a student understand and improve their examination readiness — and will schools/tutorial centres pay for the same intelligence at cohort level?

If a feature doesn't serve proving that, it waits.

---

## IN SCOPE — Version 1

### Examinations
- JAMB/UTME (primary)
- WAEC/WASSCE (secondary — a focused subject set, not full breadth on day one)
- NOT NECO, BECE, Post-UTME (future)

### Users
- Student (independent, or attached to 1+ institutions)
- Teacher / Tutor
- Institution Admin (school or tutorial centre)
- Platform Admin (internal, minimal tooling)
- Parent: **read-only view only**, basic implementation — see note below

### Core features

**Identity & institutions**
- Auth (email/password minimum)
- Role-based access
- Multi-tenant institution model with full data isolation
- Institution registration: school or tutorial centre
- Bulk student import (CSV)
- Classes/cohorts
- Examination-focus selection at registration (WAEC-only / JAMB-only / Both) — see `docs/09`

**Content**
- Subjects → Topics → Subtopics hierarchy
- Multiple-choice question bank with full metadata (subject, topic, difficulty, explanation)
- Question review workflow: draft → review → approved → published
- Institution-owned question banks, separate from platform content
- Bulk question import (CSV/spreadsheet) with validation

**Assessment**
- Assessment builder (manual question selection + basic blueprint/filter selection)
- Assessment types: diagnostic, practice, topic test, mock, institutional assessment
- Timed CBT delivery: navigation, timer, auto-submit, answer persistence
- Answers must survive a temporary network drop (local save + sync on reconnect) — this is a stated differentiator, not optional polish
- Automatic scoring for objective questions
- Question and option randomization

**Intelligence (v1, deliberately simple — see `docs/07`)**
- Subject-level and topic-level performance
- Basic mastery classification (Needs Attention / Developing / Good / Strong)
- Basic readiness score (0–100) + confidence level (Low/Moderate/High)
- Rule-based recommendations (not AI-driven in v1 — see `docs/07`)
- Performance trend (improving/stable/declining) once ≥3 data points exist

**Dashboards**
- Student dashboard (5-question rule — see `docs/02`)
- Teacher dashboard (class + student level)
- Institution admin dashboard (cohort level)
- Basic reports (student, class, subject)

**Billing**
- Individual student pricing ladder (Free → single assessment → single subject → JAMB → WAEC → combined) — see `docs/09`
- Institutional plans (Starter / Growth / Pro) — see `docs/09`
- Payment verification via webhook (never client-confirmed)
- Feature entitlement system separate from payment logic

**Infrastructure baseline (non-negotiable even in v1)**
- HTTPS everywhere
- RLS on every institution-scoped table
- Automated backups
- Audit log for critical actions (assessment created/edited, result modified, role changed, payment status changed)
- Privacy policy + terms of service in place before real user data is collected

---

## OUT OF SCOPE — explicitly deferred, do not build without a scope change

- Advanced adaptive testing / dynamically branching diagnostics
- AI-generated questions entering the question bank without human review
- Full AI tutor / conversational study coach
- Advanced proctoring (camera monitoring, browser lockdown, identity verification)
- Full offline CBT mode (v1 only needs answer-persistence-through-network-drop, not a fully offline exam engine)
- White-label / branded institution portals
- Marketplace or teacher content monetization
- Predictive exam-outcome modeling ("you have an X% chance of passing")
- Advanced item-response-theory / knowledge-tracing statistical models
- Parent-teacher messaging / chat features
- WhatsApp/SMS integrations (email + in-app notifications only in v1)
- Multiple languages / localization beyond English
- Theory/essay grading (objective questions only in v1)
- Institutional benchmarking against other institutions
- Custom/configurable roles beyond the fixed role set above
- Full school management (fees, payroll, attendance, timetabling) — never in scope, any version

## Parent access — explicit v1 boundary

Build the data model to support parent-student linking (see `docs/05`), but the actual v1 parent experience should be **minimal**: a read-only summary (readiness, recent progress, one weak area, one recommendation). Do not build a full parent portal, messaging, or notification preferences in v1.

## Why this list matters

Every chapter of the original product spec describes a large, multi-year vision (adaptive learning, AI tutors, predictive models, white-label portals). All of it is a legitimate *future* — none of it is v1. An agent picking up a task should default to the narrower interpretation whenever a feature request is ambiguous, and flag anything that looks like it belongs on the "out of scope" list above instead of quietly building it.
