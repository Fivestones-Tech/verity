# 08 — Assessment & Content Engine

## Core principle

> Good questions → structured assessments → reliable response data → meaningful analysis → readiness intelligence.

The question bank is not a pile of content. Every question needs enough metadata (subject, topic, difficulty, correct answer, explanation) that the readiness engine can actually use it. Garbage-in on tagging means garbage-out on every dashboard downstream.

## Question types (v1)

Only **multiple choice** (single correct answer) in v1. True/false may follow. Theory/essay, matching, and fill-in-the-blank are explicitly out of scope — see `docs/03-mvp-scope.md`.

## Question lifecycle

```
draft → review → approved → published → (archived, if retired)
```

- Only `published` questions are eligible for assessments visible to students.
- A `flagged` state exists for reported issues (wrong answer key, ambiguous wording, broken content) — flagged questions are pulled from active rotation pending review.
- Never let unreviewed content silently enter an assessment. This applies equally to platform content and institution-uploaded content.

## Content ownership

Three distinct pools, tracked via `questions.institution_id`:

| Owner | `institution_id` |
|---|---|
| Platform content | `null` |
| School-owned | that school's id |
| Tutorial-centre-owned | that centre's id |

Institutions never see or use another institution's private question bank. Platform content is available to everyone according to their entitlement (see `docs/09-pricing-billing-entitlements.md`).

## Bulk question import

- Accept CSV/spreadsheet with a defined template: question text, 4 options, correct answer, subject, topic, difficulty, explanation
- **Validate before import, not after:** missing fields, invalid subject/topic references, invalid correct-answer marker, obvious duplicates
- Show the uploader a clear preview + error report before committing anything to the database
- Never silently drop or auto-correct malformed rows — reject them with a specific reason

## Assessment builder

Assessment types (v1): `diagnostic`, `practice`, `topic_test`, `mock`, `institutional`.

Two selection modes for v1:
1. **Manual** — creator picks specific questions
2. **Filtered/blueprint-lite** — creator specifies subject + topic(s) + difficulty mix + question count, system pulls from the approved pool

Full weighted blueprint generation (e.g., "40% Algebra, 30% Geometry...") is a reasonable v1.5 addition but not required for v1 — a simple filtered random pull that respects subject/topic/difficulty constraints is enough to start.

## Randomization rules

- Question order and option order may be randomized per attempt
- Randomization must never break question logic (e.g., a passage-dependent question set stays grouped)
- Randomization pulls from an *approved* pool only — never from draft/unreviewed content

## CBT delivery — the actual assessment-taking experience

Required interface elements:
- Question display with clear numbering
- Timer, always visible, accurate
- Forward/backward navigation + jump-to-question
- Mark-for-review flag
- Answered/unanswered visual status
- Submit with a confirmation step showing "X of Y answered"

## Answer persistence — this is a stated product differentiator, build it properly

```
Student selects an answer
  → saved to local state immediately (before any network call)
  → queued for sync
  → on successful sync: marked synced
  → on reconnect after a drop: queued answers sync automatically
```

UI must never claim "saved" in a way that implies server confirmation unless the server has actually confirmed it. Correct pattern: show "Saved on this device" vs. "Synced" as distinct states — this exact distinction is a product promise, not just an implementation detail (see `docs/04-architecture.md`, offline resilience section).

## Timer behavior

- On expiry: auto-submit, and record `status = 'auto_submitted'` on the attempt (distinct from a normal submission — this matters for time-management analytics)
- Timer must be validated server-side at submission (don't trust a client-reported elapsed time as the sole source of truth for a graded assessment)

## Scoring pipeline

```
Student submits
  → validate attempt (not already submitted, within time window, belongs to this student)
  → compare each response against the question's correct option — server-side
  → calculate: correct, incorrect, unanswered, raw score, percentage, time used
  → save attempt as immutable record
  → trigger topic_performance calculation
  → trigger student_mastery recalculation for affected topics
  → trigger readiness_scores recalculation (see docs/07-readiness-engine.md)
  → trigger recommendation generation
  → return result to student
```

This entire pipeline runs server-side. The client displays the result; it never computes or asserts it.

## Idempotent submission

A retried submit request (e.g., from a flaky connection triggering a duplicate call) must not create a second attempt or double-score. Use the attempt's unique id + a status check (`if status != 'in_progress', reject or return existing result`) as the idempotency guard.

## Result screen — must go beyond a bare score

Every result screen shows, at minimum:
- Score / percentage
- Correct / incorrect / unanswered counts
- Topic-level breakdown (not just subject-level)
- Time used
- One clear recommended next step (from the recommendation engine — see `docs/07`)

A result screen that only shows a percentage is an incomplete implementation of this product's core value proposition.

## Mistake review

Students can revisit incorrectly answered questions with the correct answer and explanation shown. This data also feeds future practice question selection (weak-topic-weighted practice sets) — see `docs/07-readiness-engine.md` recommendation rules.

## Content quality signals (v1.5+, note for later, don't build in v1)

Once real response volume exists: track percentage-correct per question, average response time, and flag questions where the empirical difficulty diverges wildly from the assigned label. Not required for launch — noted here so the schema (`docs/05`) already accommodates it without a redesign.
