# 01 — Product Vision

## The one-sentence version

> Most exam apps tell a student what score they got. Verity tells them what that score *means*, what to do next, and eventually — whether they're actually ready.

## The problem we're solving

Nigerian students preparing for JAMB/UTME and WAEC/WASSCE typically combine past-question apps, WhatsApp groups, YouTube, private tutors, and school revision — with no system connecting any of it. A student can answer hundreds of questions and still not know:

- Which topics they actually understand vs. which they're guessing on
- Whether their preparation is improving, stable, or declining
- Whether they're fast enough for real exam conditions
- What to study *next*

Schools and tutorial centres have the parallel problem at scale: they run tests, but rarely turn results into targeted intervention. A teacher may know a class averaged 61% without knowing which 12 students need help with which topic.

## What we are NOT building

Explicitly reject scope creep toward:
- Another plain CBT/past-questions app (commoditized, no moat)
- A general-purpose LMS or full school management system (payroll, fees, attendance — not our problem)
- A social network or gamification-first product
- A general-purpose AI tutor with no structured data behind it

## What we ARE building

An **Exam Readiness & Assessment OS** — the connective layer between:

```
Questions → Assessments → Student Data → Analytics → Recommendations → Institutional Workflows
```

The differentiation is not "we have more questions." It's **evidence-based readiness intelligence** built on top of good questions.

## The core philosophy

> **Score ≠ Readiness.**

A single 85% score is weak evidence. Five consistent 78%s across different conditions is strong evidence — even though the number is lower. The Readiness Engine (`docs/07-readiness-engine.md`) exists to make this distinction real, not just a slogan.

Every readiness output must be:
- **Evidence-based** — traceable to specific assessment data, never a vibe
- **Explainable** — the system says *why*, not just *what*
- **Honest about confidence** — "Developing, but based on only 2 assessments" is a valid and required output state
- **Never a guarantee** — the product must never claim to predict or guarantee an exam outcome

## The core loop (build everything around this)

```
Diagnose → Analyze → Recommend → Practice → Reassess → Measure Improvement → Repeat
```

Every major screen — student dashboard, teacher dashboard, institution dashboard — should visibly answer: **"What should happen next?"**

## Who we serve, in priority order for v1

1. **Students** — individual, direct-to-consumer, mobile-first
2. **Schools** — institutional, teacher + admin workflows
3. **Tutorial centres** — institutional, candidate/batch workflows
4. Parents and platform admins are secondary in v1 (see `docs/03-mvp-scope.md`)

## Positioning statements (use these verbatim in copy/marketing contexts)

- **For students:** "Know where you stand. Know what to improve. Get ready."
- **For schools:** "Know where your students stand before examination day."
- **For tutorial centres:** "Prepare students with evidence, not guesswork."
- **For parents:** "See how prepared your child really is."

## North Star Metric

> Percentage of active students who demonstrate measurable readiness improvement over a defined preparation period.

Not registrations. Not questions answered. **Improvement.** If a feature doesn't move this metric or directly support the loop above, question whether it belongs in the roadmap.

## Product mantra

> Don't just tell students their score. Tell them what the score means, what they need to improve, and what they should do next.

## Brand

- **Product name:** Verity — means "truth/evidence," directly reinforces the positioning
- **Company:** Lumio
- **Initial market:** Nigeria
- **Initial examinations:** JAMB/UTME and WAEC/WASSCE (see `docs/03-mvp-scope.md` for exact subject scope)
- **Future examinations (not v1):** NECO, BECE, Post-UTME
