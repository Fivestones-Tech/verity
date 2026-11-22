# 16 — Screen Specifications

> Screen-by-screen spec for v1. Build mobile layout first. Every screen must use the tokens and patterns in `docs/10-design-system.md`. Every screen must define four states: **loading, empty, error, populated** — an unfinished state is an unfinished screen.

## Global rules (apply to every screen)

- **Tone:** never shame. "Needs attention", not "failed" or "poor". Brick color marks a weak topic only.
- **Numbers:** mono font, tabular-nums.
- **One primary action per screen.** If two buttons compete, one is wrong.
- **Loading:** skeleton blocks in `--paper-soft`, no spinners over content areas. Spinners only inside buttons.
- **Empty states:** say what this screen will show and give one action to fill it. Never a blank panel.
- **Error states:** short, honest, tell the user what to do next (see `docs/11-coding-standards.md`). Never show raw errors.
- **Freshness:** any readiness or analytics figure shows "Updated {time} ago".
- **Touch targets:** minimum 44px height on mobile.
- **No horizontal scroll** on body at any width.

## Route map

```
PUBLIC
/                      Landing (already built — see verity-landing.html)
/login                 Login
/register              Student register (independent)
/register/institution  Institution register
/join/[code]           Join an institution via invite code
/forgot-password       Request reset
/reset-password        Set new password

STUDENT
/app                         Dashboard
/app/onboarding              First-run exam + subject selection
/app/assessments             List (assigned + available)
/app/assessments/[id]        Instructions screen
/app/assessments/[id]/take   Taking screen (full-screen, no nav)
/app/results/[attemptId]     Result
/app/mistakes                Mistake review
/app/progress                Readiness timeline + subject trends
/app/subjects/[id]           Subject detail (topic mastery)
/app/upgrade                 Pricing ladder + checkout
/app/profile                 Profile + settings

INSTITUTION (teacher / admin)
/inst                        Dashboard (role-aware)
/inst/classes                Classes list
/inst/classes/[id]           Class detail (heatmap + students)
/inst/students               Students list + import
/inst/students/[id]          Student detail
/inst/assessments            Assessments list
/inst/assessments/new        Assessment builder
/inst/assessments/[id]       Assessment results
/inst/questions              Question bank (institution-owned)
/inst/questions/import       Bulk import
/inst/reports                Reports
/inst/staff                  Staff management (admin/owner)
/inst/billing                Subscription (owner)
/inst/settings               Institution settings

PLATFORM ADMIN
/admin/review                Question review queue
/admin/institutions          Institutions list
/admin/content               Exams / subjects / topics
```

## Student screens

### /app — Dashboard
**Purpose:** answer five questions without scrolling on mobile: how am I doing, how ready am I, where am I weak, am I improving, what next.

```
┌──────────────────────────────┐
│ Good morning, Daniel         │
│ ┌──────────────────────────┐ │
│ │ READINESS CARD           │ │   ← component from docs/10
│ │ 64 /100  [Developing]    │ │
│ │ Confidence — Moderate    │ │
│ │ Eng ▓▓▓▓▓▓▓░ 78%         │ │
│ │ Math ▓▓▓▓▓░░░ 61% (brick)│ │
│ │ Weakest: Algebra · 2h ago│ │
│ └──────────────────────────┘ │
│ NEXT BEST ACTION             │
│ Practice Algebra — 20 Qs     │
│ Why: mastery is 46%          │
│ [ Start practice ]  (gold)   │
│ Trend ↑ improving            │
│ Recent: Math Mock 64%        │
└──────────────────────────────┘
```
**Data:** latest `readiness_scores` row, top `recommendations` row (status pending, highest priority), last 3 `assessment_attempts`.
**Empty (no assessments yet):** Readiness Card replaced by "Take your first diagnostic" with one primary button. Explain it takes ~15 minutes and gives a starting point.
**Low confidence:** show score with "Early estimate — complete more assessments" instead of a confident label.

### /app/onboarding
Steps (one question per screen, progress dots): 1) Which exam — JAMB / WAEC / Both. 2) Exam year. 3) Subjects (multi-select, filtered by exam). 4) Optional target course (skip allowed). Ends by routing to the diagnostic. No more than four steps.

### /app/assessments/[id] — Instructions
Shows name, subject, question count, duration, type, attempt rules, whether it affects readiness. Single button "Begin". If offline-capable package is not cached, show "Preparing…" until questions are stored locally (see `docs/17`).

### /app/assessments/[id]/take — Taking screen
Full-screen, no site nav. Lightweight: no animations except timer warning.

```
┌──────────────────────────────┐
│ Math Mock          ⏱ 42:10   │  ← timer always visible
│ Q 12 / 40      ● Saved here  │  ← sync state (see docs/17)
│ ──────────────────────────── │
│ Question text …              │
│ ( ) A  …                     │
│ ( ) B  …                     │
│ ( ) C  …                     │
│ ( ) D  …                     │
│ [⚑ Mark]                     │
│ [← Prev]            [Next →] │
│ [ Question grid ▾ ]  [Submit]│
└──────────────────────────────┘
```
- Question grid: answered (pine fill), unanswered (outline), marked (gold dot), current (ring).
- Timer turns brick-outline at 5 min and 1 min remaining; announce via `aria-live` once each.
- Submit opens confirm: "You answered 37 of 40. Submit?" with "Go back" as the default focus.
- On time expiry: auto-submit, message "Time's up — your answers were submitted."
- Selecting an answer saves locally first, then syncs. Never show "Submitted" until the server confirms.
- Back button / refresh must not lose answers; resume to the same question.

### /app/results/[attemptId] — Result
Order: score + percentage → correct/incorrect/unanswered → time used → topic breakdown (bars, weak in brick) → readiness change ("Readiness 61 → 64") with plain-language explanation → ONE next action → "Review mistakes" link.
**Pending state:** if intelligence calculation hasn't finished, show score immediately and a skeleton for readiness with "Updating your readiness…"; poll or subscribe, never block the score.

### /app/mistakes
List of wrongly answered questions grouped by topic. Each: question, your answer, correct answer, explanation, "Try a similar question". Filter by subject/topic.

### /app/progress
Readiness timeline (line, mono labels), per-subject trend rows (Improving / Stable / Declining / Not enough data), coverage meter. Show "Not enough data yet" until ≥3 points exist.

### /app/subjects/[id]
Topic list with mastery label + evidence count. Topics under the evidence threshold read "Not enough evidence yet" with a "Take a short check" action.

### /app/upgrade
The six-step pricing ladder from `docs/09`. Show current plan, what each step unlocks, one featured recommendation. Single Assessment (₦300) must be visibly labelled "one-time". After payment: "Confirming your payment…" until the webhook activates entitlements — never unlock on redirect alone.

### /app/profile
Name, email/phone, exams/subjects, institution memberships (list, read-only), notification preferences, sign out, delete-account request.

## Institution screens

### /inst — Dashboard
**Admin:** total/active students, average readiness, students needing attention, weakest topic, readiness distribution, upcoming assessments.
**Teacher:** my classes, class weak topics, students needing attention, assignments due.
Every tile ends in an action ("Assign practice", "View students").

### /inst/classes/[id]
Top: class average + completion rate. Middle: **topic heatmap** (hairline grid, cells coloured by mastery band using pine / gold / brick scale, mono %). Bottom: students list sorted by "needs attention" first. Action: "Assign practice to these students" (preselects weak-topic students).

### /inst/students (+ import)
Paginated table, search, filter by class/status. Import flow: upload CSV → map columns → validate → preview with errors → confirm. Never import silently; show per-row errors. Duplicate detection by institution student number.

### /inst/students/[id]
Overall readiness (ReadinessCard), subject/topic mastery, assessment history, trend, current recommendations, intervention history. Visible only to authorised teachers/admins.

### /inst/assessments/new — Builder
Step 1 type + subject + duration. Step 2 questions: tab "Pick manually" / tab "Auto-select by filters". Step 3 assign to class/students + dates. Step 4 review + publish. Save draft at every step.

### /inst/assessments/[id]
Completion (started/submitted/remaining), average, score distribution, hardest topic, question-level stats (most missed). Export CSV (permission-checked).

### /inst/questions, /inst/questions/import
Filter by subject/topic/difficulty/status. Create form per `docs/08`. Import follows the same validate-preview-confirm pattern as students.

### /inst/billing, /inst/staff, /inst/settings
Owner only for billing. Staff: invite by email, role select, revoke. Settings: institution name, **exam focus** (WAEC only / JAMB only / Both), logo.

## Platform admin screens

### /admin/review
Queue of questions in `review`. Each: full question, options, marked answer, metadata. Actions: Approve / Request changes (with note) / Reject. Keyboard shortcuts for speed. Flagged questions appear here with the reporter's reason.

## Reusable components (build once in `/components/ui`)

`Button`, `Card`, `ReadinessCard`, `StatusStamp`, `TopicBar`, `MasteryBadge`, `ConfidenceTag`, `DataGrid` (hairline), `Heatmap`, `Field` (label + input + error), `EmptyState`, `ErrorState`, `Skeleton`, `Timer`, `QuestionGrid`, `SyncIndicator`, `ConfirmDialog`, `Toast`.

## Accessibility per screen

Visible focus ring (gold, 2px), full keyboard path through the taking screen (number keys 1–4 select A–D, N/P next/prev), labels for every input, colour never the only signal (weak topics also carry the text "Needs attention").
