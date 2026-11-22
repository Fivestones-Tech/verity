# Verity — Agent Build Guide

> Read this file first, every session. It is the map to everything else.
> If you are Claude Code: this file is duplicated as `CLAUDE.md` at the repo root — you don't need to do anything extra.

---

## What we're building

**Verity** (a product by **Lumio**) is an Exam Readiness & Assessment OS for Nigerian students preparing for **JAMB/UTME** and **WAEC/WASSCE**, and for the schools and tutorial centres preparing them.

The product does not stop at a score. Every assessment produces **evidence** — topic mastery, consistency, timing, syllabus coverage — which feeds a **Readiness Engine** that tells the student what to do next. Schools and tutorial centres get the same intelligence at cohort level, so teachers know exactly who needs help and with what, before results day.

The core loop, referenced constantly throughout these docs:

```
Assess → Understand → Practice → Reassess → Measure Improvement
```

Read `docs/01-product-vision.md` for the full "why." Everything else in this repo exists to serve that loop.

---

## Before you write any code

1. Read `docs/03-mvp-scope.md` — know what's in v1 and what is explicitly **not**. Scope creep is the single biggest risk on a project this size.
2. Read the doc relevant to your specific task (index below). Don't guess at conventions that are already documented.
3. Check `docs/13-roadmap-and-phases.md` for the current phase. Don't build Phase 4 work while Phase 1 is incomplete — later phases depend on earlier ones being solid.
4. If a task touches **auth, money, or scoring**, read `docs/06-auth-permissions-security.md` in full before touching it. No exceptions, no shortcuts.

---

## Document index

| File | Read this when you're working on... |
|---|---|
| `docs/01-product-vision.md` | Anything — the "why" behind every decision |
| `docs/02-users-and-journeys.md` | Any user-facing flow or screen |
| `docs/03-mvp-scope.md` | Deciding whether a feature belongs in v1 |
| `docs/04-architecture.md` | Backend structure, tech stack, module boundaries |
| `docs/05-database-schema.md` | Any table, migration, or query |
| `docs/06-auth-permissions-security.md` | Auth, roles, RLS, multi-tenant isolation |
| `docs/07-readiness-engine.md` | Scoring, mastery, readiness, recommendations |
| `docs/08-assessment-content-engine.md` | Question bank, assessments, CBT delivery |
| `docs/09-pricing-billing-entitlements.md` | Plans, payments, feature gating |
| `docs/10-design-system.md` | Any UI you're building — must match this exactly |
| `docs/11-coding-standards.md` | Folder structure, naming, git, testing |
| `docs/12-api-reference.md` | Any endpoint, route, or Supabase call |
| `docs/13-roadmap-and-phases.md` | Build order and current milestone |
| `docs/14-how-to-instruct-the-agent.md` | (For the human operator) How to run this build session by session |
| `docs/15-task-prompt-playbook.md` | (For the human operator) Every task prompt, all 8 phases, ready to paste in order |
| `docs/16-screen-specs.md` | Any screen or UI flow — routes, layouts, states |
| `docs/17-offline-and-sync.md` | The assessment-taking flow, local save, sync, timer |
| `docs/18-content-and-question-sourcing.md` | Questions, syllabus topics, import template, content rules |
| `docs/19-notifications.md` | In-app and email notifications |
| `docs/20-testing-strategy.md` | What to test, critical-path suites, CI gates |
| `docs/21-deployment-and-operations.md` | Environments, releases, backups, monitoring, go-live |
| `docs/22-glossary.md` | Any term you are unsure about |
| `docs/23-decisions-log.md` | Settled decisions and OPEN founder decisions — check before deciding anything |

---

## Session workflow

- Start of session: read `PROGRESS.md` (current state and next task). In Claude Code you can run `/start-session`.
- Before coding: `/plan-task <task>` and wait for approval on anything touching more than ~3 files, auth, schema, scoring, or payments.
- Schema changes: `/new-migration <what>`.
- Before merging: `/security-review`. Between phases: `/verify-phase <n>`.
- End of session: `/update-progress` so the next session knows where things stand.
- Open founder decisions are listed in `docs/23-decisions-log.md` — never decide those silently; ask.
- Folder-level rules live in `supabase/CLAUDE.md`, `components/CLAUDE.md`, `lib/CLAUDE.md`.

---

## Non-negotiable rules

These override convenience, speed, and "just to make it work." If following a rule below would require breaking it to finish a task, **stop and ask instead of proceeding.**

1. **Never trust the client.** Scores, permissions, payment status, and institution membership are always verified server-side — never taken from a request body, query param, or local state.
2. **Institution isolation is absolute.** A user from School A must never be able to read, list, search, export, or even infer the existence of School B's data — via UI, API, or direct database query. This is enforced with Row Level Security, not just hidden in the UI.
3. **Never weaken auth, RLS, or validation to unblock yourself.** If a feature seems to require it, the feature's design is wrong — redesign it, don't remove the guardrail.
4. **Payments are verified server-side via webhook**, never activated by a client-side "success" callback alone.
5. **No secrets in code, ever.** API keys, service role keys, and payment secrets live in environment variables only, and are never committed to version control.
6. **Inspect before you modify.** Before changing existing schema, auth logic, or shared components, read what's actually there — don't assume based on the docs alone, the code is the source of truth once it exists.
7. **Database changes go through versioned migrations.** No manual, undocumented production schema edits.
8. **Don't invent scope.** If a feature isn't in `docs/03-mvp-scope.md`, don't build it without checking — flag it instead of quietly adding it.
9. **AI/LLM features never control deterministic logic.** Scores, entitlements, and readiness numbers are computed by application code, using rules defined in `docs/07-readiness-engine.md`. AI may explain results in natural language — it never calculates them.
10. **Brand and design tokens come from `docs/10-design-system.md` exactly.** Don't introduce new colors, fonts, or spacing values ad hoc, even if they "look fine."

---

## Definition of done

A feature is not done when the UI renders correctly. It's done when:

- [ ] Backend logic is correct and matches the relevant spec doc
- [ ] Authorization is enforced server-side (not just hidden/disabled in the UI)
- [ ] RLS policies exist and are tested for any new table
- [ ] Errors are handled with a user-facing message that doesn't leak internals (see `docs/12-api-reference.md`)
- [ ] Mobile-responsive — this product is mobile-first (see `docs/02-users-and-journeys.md`)
- [ ] If it touches the assessment-taking flow, it survives a simulated network drop without losing the student's answers
- [ ] Tests exist for the critical path (see `docs/11-coding-standards.md`)
- [ ] No secrets, no hardcoded config that belongs in `docs/09-pricing-billing-entitlements.md` or environment variables

---

## Tech stack (decided — don't re-litigate without an explicit reason)

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Payments:** Paystack or Flutterwave (Nigerian gateway — see `docs/09-pricing-billing-entitlements.md`)
- **Hosting:** Vercel (frontend) + Supabase (backend), or an equivalent pairing
- **AI provider:** called only from server-side functions, never directly from the client

If you believe a different tool is genuinely better for a specific piece (e.g., a queue system, a search service), propose it — don't silently swap the core stack.

---

## Current phase

See `docs/13-roadmap-and-phases.md` for the authoritative status. Keep that file's "current phase" marker updated as milestones complete — a stale roadmap is worse than no roadmap, because agents will trust it.

---

## Company / product naming

- **Company:** Lumio
- **Product:** Verity (a Lumio product)
- Use **"Verity"** in all user-facing UI copy, error messages, emails, and receipts.
- **"Lumio"** appears only in legal text, footer copyright lines, and company-facing contexts (invoices, terms of service).
- See `docs/10-design-system.md` for the exact lockup and usage pattern already established on the marketing site.

---

## When you're unsure

Prefer asking a clarifying question over guessing on anything that is:
- expensive to reverse (schema design, auth model, pricing logic)
- a real business decision, not an implementation detail (see flagged items in `docs/07` and `docs/09`)

For everything else — implementation details, component structure, naming within an established pattern — make a reasonable decision, note the assumption in your PR/commit description, and keep moving.
