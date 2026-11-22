# 20 — Testing Strategy

> Not everything needs high coverage. The **critical path does**. A feature that renders but leaks another school's data, mis-scores a student, or double-charges a payment is a failure regardless of how it looks.

## Tooling (recommended defaults)

- **Unit / integration:** Vitest
- **Component:** React Testing Library (light)
- **End-to-end:** Playwright (mobile viewport + desktop)
- **Database / RLS:** SQL tests against a local Supabase instance (pgTAP via `supabase test db`) or scripted tests using two real test users
- **Accessibility:** axe via Playwright on key screens

## Test pyramid for this project

| Layer | What | Volume |
|---|---|---|
| Unit | scoring math, readiness formula, mastery rules, recommendation rules, entitlement checks, validation schemas, CSV import validators | many, fast |
| Integration | submit → score → topic_performance → mastery → readiness → recommendation; webhook → subscription → entitlements | moderate |
| RLS | per-table isolation and role access | one suite, run in CI |
| E2E | the core loop and the money path | few, stable |

## Critical-path suites (must exist before pilot)

### 1. Institution isolation (RLS)
Setup: Institution A (admin, teacher, student) and Institution B (same). For **every institution-scoped table**:
- A-user cannot select, insert, update or delete B rows.
- B-user likewise.
- Independent student sees only own data.
- Teacher sees only assigned classes' students.
- Parent sees only linked students.
- Unauthenticated sees nothing.
Also test via search, export and storage paths. This suite fails the build if any check passes that should be blocked.

### 2. Scoring
- All correct, all wrong, partial, unanswered counted separately.
- Weighted points if present.
- Client-supplied score ignored.
- Answer for a question not in the attempt rejected.
- Answer after expiry rejected.

### 3. Submission idempotency
Double submit → one attempt, one result, same response. Concurrent submits → one wins, no duplicate topic_performance rows.

### 4. Readiness engine (`docs/07`)
Table-driven tests with fixed inputs and expected outputs for each component (recent, mastery, consistency, coverage, mock) and the weighted total; confidence levels; band boundaries (39/40, 59/60, 74/75, 89/90); "no evidence is not strong performance"; history rows are never overwritten; algorithm_version is stored.

### 5. Mastery & recommendations
Below-threshold evidence → "not enough evidence"; ≥ threshold + low mastery → high-priority recommendation; only one primary recommendation surfaced; declining trend rule; no-mock-near-exam rule.

### 6. Billing
Success webhook activates correct entitlements; invalid signature rejected; duplicate webhook is a no-op; failed payment grants nothing; expiry restricts premium but keeps history; Single Assessment grants exactly one attempt; client redirect alone never activates anything.

### 7. Offline/sync (`docs/17`)
Offline answer persistence, reconnect flush, no duplicates, clock tampering, logout wipe.

### 8. Auth & permissions
Each route/API: unauthenticated → 401; wrong role → 403; right role wrong institution → not found/forbidden; no information leak in error text.

## End-to-end scripts

**E2E-1 Core loop (must always pass):** register → onboarding → diagnostic → submit → result with topic breakdown → readiness with confidence + explanation → one recommendation → practice → reassess → readiness updates.

**E2E-2 Institution:** register institution (exam focus chosen) → import students → create class → build assessment → assign → student takes → teacher sees heatmap and attention list.

**E2E-3 Money:** pick plan → sandbox payment → webhook → entitlement unlocked → feature accessible; failed payment path.

Run on a mobile viewport (e.g. 375×667) and throttled network profile.

## Test data

- Seed script creates two institutions, users in each role, a small question set with known answers, and canned attempts with known expected readiness.
- Never use real student data in dev/test. Synthetic only.

## CI gates (on every pull request)

lint → typecheck → unit → integration → RLS suite → build. E2E runs on merge to main or nightly. A failing RLS suite blocks merge, no exceptions.

## What not to over-test in v1

Pixel-perfect UI, every component variant, third-party SDK internals. Smoke-test UI; spend effort on the suites above.
