# 07 — Readiness Engine (v1 Specification)

> ⚠️ **Reconciliation note:** the original product research contained two different readiness-weighting formulas in different sections. This document defines the single canonical v1 formula. If you want to change the weights, change them here — don't let two versions of "the truth" exist across documents.

## Philosophy (non-negotiable, applies to every output this engine produces)

1. **Score ≠ Readiness.** Never treat the most recent assessment score as the readiness score.
2. **Every readiness number ships with a reason.** Never display a bare number with no explanation of what it's built on.
3. **Confidence is a first-class output, not an afterthought.** Two assessments is not enough evidence for a strong claim — say so.
4. **Never claim certainty the data doesn't support.** No "you will pass," no fake-precise decimals (`73.482` is wrong; `73` is right).
5. **The formula is versioned and auditable.** Every `readiness_scores` row stores which `algorithm_version` produced it. Never silently recompute and overwrite history — see `docs/05-database-schema.md`.

## v1 Readiness Formula (canonical)

```
Readiness Score =
    30% × Recent Performance
  + 30% × Topic Mastery
  + 15% × Consistency
  + 10% × Syllabus Coverage
  + 15% × Mock Performance
```

- All five inputs are normalized to a 0–100 scale before weighting.
- Store weights in a config table (not hardcoded in application code) so they can be tuned without a deployment — see "Implementation notes" below.
- This formula is a deliberate first pass. It is expected to be recalibrated once real usage data exists. That's why it's versioned.

### Component definitions

**Recent Performance** — accuracy across the student's most recent assessments, with more recent results weighted more heavily than older ones. A simple recency-weighted average is sufficient for v1 (e.g., last 3 assessments weighted 50/30/20).

**Topic Mastery** — the average of `student_mastery.mastery_score` across all topics the student has been assessed on (see mastery calculation below). Weak topics pull this down even if the subject-level average looks fine — never let a strong overall average hide one badly failing topic in the underlying data.

**Consistency** — a measure of variance across recent scores. Two students with the same average can have very different consistency (e.g., 78/76/80/77 vs. 95/48/91/52). Lower variance = higher consistency score. A simple standard-deviation-based normalization is sufficient for v1.

**Syllabus Coverage** — the proportion of relevant topics that have been meaningfully assessed at all. A student who is strong in the 3 topics they've tried but has never attempted 7 others should not show high coverage. **"No evidence" must never be scored as "strong performance."**

**Mock Performance** — performance specifically on assessments of type `mock` (full, timed, exam-condition simulations), which carry more evidentiary weight than a small topic quiz because they better simulate the real exam.

## Readiness bands

| Score | Label |
|---|---|
| 0–39 | Needs Significant Preparation |
| 40–59 | Developing |
| 60–74 | Approaching Readiness |
| 75–89 | Strong Readiness |
| 90–100 | High Readiness |

These thresholds are a v1 starting assumption. Validate and adjust once real student outcome data exists — don't treat them as permanent.

## Confidence levels

| Confidence | Trigger (v1 rule) |
|---|---|
| Low | Fewer than 3 meaningful assessments, or fewer than ~40% of relevant topics have any evidence |
| Moderate | 3–5 assessments across a reasonable topic spread |
| High | 6+ assessments, broad topic coverage, includes at least one mock |

Always display confidence next to the score. A UI showing "Readiness: 72" with no confidence indicator is an incomplete implementation.

## Topic Mastery calculation

```
mastery_score = weighted evidence of demonstrated competence, considering:
  - accuracy on that topic
  - number of questions attempted (more attempts = more reliable)
  - recency (recent attempts weighted more than old ones)
  - difficulty of the questions attempted
```

Mastery labels for UI display:

| Label | Meaning |
|---|---|
| Needs Attention | Weak and/or insufficient evidence of understanding |
| Developing | Partial, inconsistent understanding |
| Good | Consistent, solid performance |
| Strong | High and consistent performance across multiple conditions |

**Minimum evidence rule:** do not assign "Strong" or "Good" based on fewer than ~5 attempted questions on that topic. If evidence is below threshold, the label is "Not enough evidence yet" rather than guessing.

## Recommendation engine (v1 — rule-based, not AI-driven)

v1 recommendations are deterministic `if/then` rules over the intelligence tables, not an LLM decision. This keeps the core loop auditable and cheap. AI may later generate the *natural-language explanation* of a recommendation, but never decides *which* recommendation fires.

Example v1 rules:

```
IF topic.mastery_score < 50 AND topic.evidence_count >= minimum_threshold
  → recommend: "Practice {topic}", priority = high

IF student.recent_trend == "declining" across >= 3 assessments
  → recommend: "Review recent mistakes before your next mock", priority = high

IF topic.evidence_count < minimum_threshold
  → recommend: "Take a short assessment in {topic} — not enough data yet", priority = medium

IF student.mock_count == 0 AND exam_proximity < 60 days
  → recommend: "Take a full timed mock", priority = high

IF no high-priority conditions are true
  → recommend: "Keep going — your current preparation is on track", priority = low
```

Only surface **one primary recommendation** on the student dashboard ("Next Best Action") even if multiple rules fire — rank by priority, show the top one, keep the rest available in a secondary "also worth doing" list. Never dump a long list as the primary UI.

## Explainability requirement

Every readiness or mastery output shown in the UI must be paired with a plain-language reason built from real data, e.g.:

> "Your readiness is 72 because your recent performance and topic mastery are improving, but Mathematics and timed performance still need attention."

Never ship: `Readiness: 72` with no supporting text.

## What the readiness engine must never do

- Never present a probability of passing the actual exam ("78% chance of passing JAMB") — this is an explicit product-wide rule, not just an engine detail
- Never let AI compute or override the numeric score
- Never treat a single assessment as sufficient evidence for a "Strong Readiness" label
- Never silently change historical `readiness_scores` rows when the formula changes — bump `algorithm_version` instead

## Implementation notes for the agent

- Store the five weights above in a config table (e.g., `readiness_config`) keyed by `algorithm_version`, not hardcoded constants — this matches the "versioned, tunable formula" requirement.
- Compute readiness as a background/deferred calculation triggered after each submitted assessment (not synchronously blocking the result screen) — see `docs/08-assessment-content-engine.md` for the submission pipeline this hooks into.
- Recalculating `student_mastery` and `readiness_scores` after every attempt is the correct default for v1 scale; introduce batching/queuing only if performance data shows it's needed.
