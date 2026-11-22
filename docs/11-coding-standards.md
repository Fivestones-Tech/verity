# 11 — Coding Standards

> This is how a disciplined engineering team runs this codebase day to day. Agents should follow these conventions by default, without being re-told on every task.

## Folder structure (Next.js App Router)

```
/app
  /(marketing)          -- public landing/marketing pages
  /(auth)                -- login, register, password reset
  /(student)              -- student-facing app, behind auth
    /dashboard
    /assessments
    /assessments/[id]/take
    /progress
  /(institution)          -- teacher/admin app, behind auth + institution membership
    /dashboard
    /students
    /classes
    /assessments
    /reports
  /(platform-admin)       -- internal tooling, behind platform_admin role
  /api                    -- server routes (webhooks, privileged operations)
/components
  /ui                     -- primitive, design-system-level components (Button, Card, Badge, ReadinessCard...)
  /student
  /institution
  /shared
/lib
  /supabase               -- client setup, typed helpers
  /readiness              -- readiness engine calculation logic (server-only)
  /entitlements            -- entitlement-check helpers
  /validation              -- shared zod schemas
/types                     -- shared TypeScript types, generated Supabase types
/supabase
  /migrations               -- versioned SQL migrations
  /functions                -- edge functions
/docs                       -- this documentation set
```

## Naming conventions

- Files: `kebab-case.tsx` (e.g., `readiness-card.tsx`)
- React components: `PascalCase` (e.g., `ReadinessCard`)
- Hooks: `useCamelCase` (e.g., `useStudentReadiness`)
- Database tables/columns: `snake_case` (matches `docs/05-database-schema.md` exactly — don't let TypeScript camelCase leak into raw SQL/migration files)
- API routes: `kebab-case`, versioned (see `docs/12-api-reference.md`)
- Boolean variables/props: prefixed `is`/`has`/`can` (`isSubmitting`, `hasEntitlement`, `canEditAssessment`)

## TypeScript discipline

- `strict: true` in `tsconfig.json` — no exceptions
- No `any` without an explicit comment explaining why it's unavoidable
- Generate types from the Supabase schema (`supabase gen types typescript`) rather than hand-maintaining duplicate type definitions
- Shared validation schemas (zod or equivalent) live in `/lib/validation` and are used on both client (form validation) and server (request validation) — don't validate only on one side

## Error handling pattern

```
User-facing error → short, honest, non-technical, tells them what to do next
Internal error → logged with full context, never shown raw to the user
```

Example, matching the product's tone principle (see `docs/02-users-and-journeys.md`):
- Bad: `Error 500: Internal Server Error`
- Bad: raw stack trace shown in a toast
- Good: "We couldn't submit your assessment. Your answers have been saved — please try again."

Never let a caught error silently disappear — log it server-side even when showing a friendly message to the user.

## Server vs. client responsibility (ties to `docs/04-architecture.md`)

Use a Supabase client-side call (protected by RLS) for:
- Simple reads where RLS alone is sufficient protection

Use a server route / Edge Function for:
- Assessment scoring
- Payment processing and webhook handling
- AI provider calls
- Any operation requiring the service role key
- Anything the security rules in `docs/06-auth-permissions-security.md` flag as server-only

If you're unsure which one a task needs, default to server-side. It's the safer default.

## Git workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- One logical change per commit — don't bundle an unrelated refactor into a feature commit
- Branch naming: `feature/short-description`, `fix/short-description`
- No direct commits to `main`/`production` — PRs required, even solo
- PR description should state: what changed, why, and which doc(s) in this set it implements (e.g., "Implements assessment submission pipeline per docs/08")

## Testing expectations

Not everything needs 100% coverage, but the **critical path is non-negotiable**:

| Must have tests | Priority |
|---|---|
| Assessment scoring logic | Critical |
| Readiness calculation | Critical |
| RLS / institution isolation | Critical — test this explicitly with two fake institutions and confirm cross-access fails |
| Payment webhook handling + idempotency | Critical |
| Auth/role permission checks | Critical |
| Assessment submission idempotency | Critical |
| UI components | Light — smoke tests are enough for v1 |

Testing layers:
- **Unit tests** — individual functions (readiness formula, entitlement checks, validation schemas)
- **Integration tests** — module interactions (submit assessment → score → mastery update → readiness update)
- **A minimum end-to-end test** covering: register → take diagnostic → submit → see result → see readiness → see recommendation. This flow is the entire product's value proposition — it must always work.

## Environment variables

- Never committed, ever — verify `.env*` is git-ignored before the first commit
- `.env.example` maintained with variable names (no real values) so a new environment can be set up without guessing
- Separate values per environment (dev/staging/production) — no shared secrets across environments
- Service role keys, payment secrets, and AI provider keys are server-only — never exposed to `NEXT_PUBLIC_*`

## Definition of done

See `AGENTS.md` root file — the same checklist applies to every PR, not just "big" features.

## Documentation discipline

When you build something that changes an assumption in these docs (e.g., you decide institutional pricing should vary by exam scope after all), **update the relevant doc in the same PR.** Don't let the docs and the codebase drift apart — a stale spec is actively worse than no spec, because the next agent session will trust it.
