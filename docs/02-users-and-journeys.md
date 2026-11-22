# 02 — Users, Personas & Journeys

## User types (v1)

| Role | Belongs to | Primary need |
|---|---|---|
| Student | Independent, or a school/tutorial centre | "What should I study next?" |
| Teacher / Tutor | One institution | "Which students need help, with what?" |
| Institution Admin | One institution (school or tutorial centre) | "Is my cohort actually improving?" |
| Platform Admin | Lumio (internal) | Operate and moderate the platform |

Parents are a **read-only, secondary v1 feature** — see `docs/03-mvp-scope.md`. Design the data model to support them (they're in the schema) but don't over-invest in the parent UI in v1.

## Critical design fact: students are not owned by institutions

A student can:
- Register independently (no institution), **or**
- Belong to a school, **or**
- Belong to a tutorial centre, **or**
- Belong to both a school AND a tutorial centre simultaneously

This must be a many-to-many relationship (`institution_memberships`), not a foreign key on the student record. See `docs/05-database-schema.md`. Getting this wrong early is expensive to fix later — do not take a shortcut here.

## Student persona (representative, for UX decisions)

**Daniel, 17, SS3.** Doesn't know his true academic level. Studies inconsistently, using different resources from different places. Doesn't know which topics matter most. Becomes anxious as exams approach. Wants to know: *"If I wrote the exam today, how prepared would I be?"* and *"What should I study today?"*

Design implication: every dashboard visit should answer both questions within one screen, no scrolling required to find the answer.

## Student jobs-to-be-done

1. Test myself — "What do I currently understand?"
2. Find my weaknesses — "Where exactly am I losing marks?"
3. Practice intelligently — not randomly
4. Track improvement — "Is my studying actually working?"
5. Simulate the real exam — get comfortable with CBT conditions before exam day
6. Understand my readiness — with evidence, not just a score
7. Know what to do next — never left wondering after a result

## Student journey (v1)

```
Register → Choose exam(s) (JAMB / WAEC / Both) → Select subjects
  → Diagnostic assessment → Readiness profile
  → Personalized recommendation → Practice
  → Progress assessment → Full mock
  → Readiness update → Targeted improvement → Reassessment
```

Onboarding must be short. Collect only: name, email/phone, password, examination(s), subjects. Everything else can be collected later, contextually.

## Student dashboard — must answer 5 questions immediately, no scrolling

1. How am I doing? (current performance)
2. How ready am I? (readiness indicator)
3. Where am I weak? (weak topics)
4. Am I improving? (trend)
5. What should I do next? (single, clear recommendation — not a list of ten)

## Institution (school / tutorial centre) journey

```
Register institution → Add staff → Import students (bulk CSV supported)
  → Create classes/cohorts → Select examination focus (WAEC-only / JAMB-only / Both)
  → Create or assign assessment → Students complete it
  → Automatic scoring → Teacher/admin views analytics
  → Weak areas surfaced → Intervention assigned → Students reassessed
  → Improvement measured
```

**Important:** most schools prepare for WAEC only; most tutorial centres focus on JAMB only. This must be a real registration choice, not an assumption baked into the UI. See `docs/09-pricing-billing-entitlements.md`.

## Institution admin dashboard — must answer immediately

- How many students are active?
- What's the average readiness / performance?
- Which topic is the biggest weakness right now?
- How many students need attention?
- What changed since last time I looked? (trend, not just a snapshot)

## Teacher dashboard — must answer immediately

- My assigned classes and students
- Class-wide weak topics (a heatmap, not a wall of individual scores)
- Which specific students need attention, and with what
- One-click path to assign an intervention

## Key UX principle across every role

> The system should never leave a user with a number and nothing to do about it.

Every score, every dashboard, every report ends in a recommended next action — even if that action is simply "no action needed, keep going."

## Tone principle

The product should never make a student feel judged. Communicate:
> "This assessment is helping you discover what to improve" — not "You failed."

This applies to copy, color choices for "weak" indicators (never alarmist red), and notification language (see `docs/10-design-system.md` for the actual brick/red usage rule — sparing, never shame-based).

## Access control summary (full detail in `docs/06-auth-permissions-security.md`)

| Role | Sees |
|---|---|
| Student | Own data only |
| Parent | Only the specific student(s) they're linked to |
| Teacher | Only their assigned classes/students within their institution |
| Institution Admin | Their institution only |
| Platform Admin | Platform-level data, with logged access to anything sensitive |

No role sees another institution's data under any circumstance. This is enforced at the database level, not just the UI — see `docs/06-auth-permissions-security.md`.
