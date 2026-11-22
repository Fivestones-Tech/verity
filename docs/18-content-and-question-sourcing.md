# 18 — Content & Question Sourcing

> The app is an empty shell without trustworthy questions. Content is a launch dependency, not a nice-to-have. Start sourcing in parallel with Phase 0.

## Non-negotiable rules

1. **No scraping.** Do not copy question banks from websites or apps. Copyright and quality risk, and it is not a defensible business.
2. **Every question has provenance:** `source` must be one of `original`, `licensed`, `institution`, `expert_created`. Licensed content requires a written agreement on file; store its reference.
3. **Every question is human-reviewed** (draft → review → approved → published) before a student sees it. AI-drafted questions are allowed only as drafts and must be reviewed by a subject specialist.
4. **Answer keys are verified by solving**, not by trusting the imported key (especially Mathematics, Physics, Chemistry).
5. Do not describe the platform as "official" or partnered with JAMB/WAEC unless that is actually true.

## Sourcing options (use a mix)

| Option | Pros | Cons |
|---|---|---|
| Original questions by hired teachers/graduates | Fully owned, tailored to topic tags | Time and cost per question |
| Licensing from publishers / tutorial centres | Faster volume | Negotiation, ongoing terms |
| Partner schools contribute questions | Cheap, real exam feel | Quality varies, needs review, rights agreement needed |
| AI-assisted drafts reviewed by experts | Speeds authoring | Review is mandatory; never auto-publish |

Recommended v1 path: a small team of subject teachers writing original questions to a template, reviewed by a second teacher, plus one or two partner schools contributing under a written contribution agreement.

## Launch subject scope (assumption — founder to confirm)

Start narrow: the highest-demand subjects first, e.g. Use of English, Mathematics, Physics, Chemistry, Biology for both JAMB and WAEC. Add Economics, Government, Literature later. A student combination needs 4 subjects for JAMB (English + 3), so confirm which combinations the pilot schools actually need before authoring.

## Syllabus mapping

Topics must come from the **official current syllabi** published by JAMB and WAEC. The seed file for `topics` is created from those documents by a subject specialist — an agent must not invent a topic list from memory. Mark the seed file with a header comment: `-- Topics require verification against the current official syllabus`. Record the syllabus version and effective year per subject.

Structure: Subject → Topic → Subtopic (two levels deep is enough for v1).

## Volume targets (starting assumptions, tune with data)

| Use | Minimum approved questions |
|---|---|
| Per subtopic, for meaningful practice | ~25–30 spanning easy/moderate/difficult |
| Per subject diagnostic pool | enough to build 2 non-overlapping diagnostics |
| Per subject mock pool | enough for 2–3 distinct mocks before repeats |

Do not launch a subject whose topics are mostly empty — hide it until it meets a coverage threshold you define.

## Question template (CSV for bulk import)

```
question_text,option_a,option_b,option_c,option_d,correct_option,subject,topic,subtopic,difficulty,explanation,source,exam,year_reference
```

- `correct_option`: A, B, C or D.
- `difficulty`: easy | moderate | difficult.
- `source`: original | licensed | institution | expert_created.
- `year_reference` optional, only for licensed/permitted past-question material.
- UTF-8, one question per row, quoted fields where commas appear.

Validation rules and the preview/error report flow are in `docs/08-assessment-content-engine.md`.

## Authoring quality checklist (reviewer ticks all before approving)

- [ ] Exactly one option is correct; the key was verified by solving it
- [ ] No two options are effectively the same
- [ ] Wording is unambiguous; no double negatives unless testing them
- [ ] Distractors reflect plausible mistakes (not silly)
- [ ] Topic/subtopic tag is correct for the syllabus
- [ ] Difficulty label is reasonable
- [ ] Explanation teaches (why correct; why the common wrong answer is wrong)
- [ ] Spelling/grammar clean; numbers and units consistent
- [ ] Source recorded; rights confirmed

## Question quality loop (after launch)

Students and teachers can flag a question (wrong answer, ambiguous, typo, off-syllabus, broken image). Flagged questions are pulled from rotation and shown in `/admin/review`. Later, use response data to detect questions that almost everyone gets wrong or right and re-review them (`docs/08`).

## Contribution agreement (for partner schools/teachers)

Have a lawyer draft a short agreement covering: who owns contributed questions, licence granted to Lumio, attribution if any, payment if any, right to remove content. Do not accept contributed content without it.

## Content operations roles (can be one person at the start)

Content creator → subject reviewer → content administrator (publishes). A person must not approve their own question.
