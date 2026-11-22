# Verity — Build Documentation

This folder is a complete brief for building Verity (a Lumio product) with an AI coding agent. It's written to be handed to **Claude Code**, **Cursor**, or **Google Antigravity** — or a human engineer, for that matter.

## Copy it correctly (important)

Copy the **contents** of this folder into the root of your project repository — including the hidden `.claude/` folder (it will not show in many file browsers; on Mac press Cmd+Shift+. to reveal hidden files, on Windows enable "Hidden items"). If `.claude/` is missing, the slash commands will not exist. Also make sure `PROGRESS.md`, `AGENTS.md`, `CLAUDE.md` and the `docs/` folder sit at the repo root.

## Quick start — the actual sequence

1. Load this folder into your tool (see "How to use this with each tool" below)
2. Run the orientation prompt at the top of `docs/14-how-to-instruct-the-agent.md` — first, before any code
3. Then work through `docs/15-task-prompt-playbook.md` **in order, one task at a time**, testing each one yourself before moving to the next
4. Track progress against `docs/13-roadmap-and-phases.md` as you go

That's the whole operating model. Everything else in this folder is reference material the tasks in step 3 will point you back to as needed.

## How to use this with each tool

### Claude Code
Drop this entire folder's contents at the root of your project repository. Claude Code automatically reads `CLAUDE.md` at the start of every session — no extra setup needed. `CLAUDE.md` and `AGENTS.md` are identical; the duplicate exists purely because different tools look for different filenames.

### Cursor
Place `AGENTS.md` at the project root (Cursor supports this convention directly). You can also copy relevant sections into `.cursor/rules/*.mdc` files if you want more granular, always-on rule injection — but `AGENTS.md` alone is enough to start.

### Google Antigravity
Place `AGENTS.md` at the project root. Reference the `/docs` folder explicitly in your first prompt if the agent doesn't pick it up automatically, e.g.: *"Read AGENTS.md and the docs/ folder before starting."*

### Any other tool, or a human developer
Start with `AGENTS.md` — it's the index for everything else. Read `docs/01` through `docs/13` in order the first time; after that, treat them as reference material to consult per task.

## What's in here

```
AGENTS.md                                 — start here, every session
CLAUDE.md                                 — identical copy, for Claude Code
docs/
  01-product-vision.md                    — why this exists
  02-users-and-journeys.md                — who it's for, how they use it
  03-mvp-scope.md                         — what's in v1, what isn't (read this second)
  04-architecture.md                      — tech stack, module structure
  05-database-schema.md                   — real table definitions + RLS patterns
  06-auth-permissions-security.md         — roles, tenant isolation, security rules
  07-readiness-engine.md                  — the actual scoring formula to implement
  08-assessment-content-engine.md         — questions, assessments, CBT delivery
  09-pricing-billing-entitlements.md      — real pricing, entitlement keys
  10-design-system.md                     — exact tokens from the live landing page
  11-coding-standards.md                  — folder structure, naming, git, testing
  12-api-reference.md                     — endpoint and response conventions
  13-roadmap-and-phases.md                — build order, current milestone
  14-how-to-instruct-the-agent.md         — how to actually run this build, session by session
  15-task-prompt-playbook.md              — every task prompt, all 8 phases, ready to paste in order
  16-screen-specs.md                      — every screen: routes, layouts, states
  17-offline-and-sync.md                  — answer-saving through network drops, timer, resume
  18-content-and-question-sourcing.md     — where questions come from, rules, import template
  19-notifications.md                     — in-app + email notifications
  20-testing-strategy.md                  — critical-path tests and CI gates
  21-deployment-and-operations.md         — environments, releases, backups, monitoring, go-live
  22-glossary.md                          — plain-language definitions
  23-decisions-log.md                     — settled decisions + OPEN questions for the founder
PROGRESS.md                               — memory between sessions (agent updates it)
.claude/commands/                         — Claude Code slash commands (/start-session, /plan-task,
                                            /verify-phase, /security-review, /new-migration, /update-progress)
.claude/settings.json                     — blocks the agent from reading real .env files
supabase/CLAUDE.md, components/CLAUDE.md, lib/CLAUDE.md — folder-level rules
```

## Two things flagged for you specifically, not the agent

These are real business decisions I made a reasonable default on, not the agent's call:

1. **`docs/07-readiness-engine.md`** — your original research contained two different readiness-score weighting formulas in different places. I picked one canonical version (documented, with the reasoning) so the agent isn't fed contradictions. Change the weights there if you disagree.

2. **`docs/09-pricing-billing-entitlements.md`** — institutional pricing (Starter/Growth/Pro) is currently flat per student regardless of WAEC/JAMB scope, while individual student pricing does vary by exam scope. That asymmetry was never explicitly confirmed by you — it's flagged at the top of that file.

## Keeping this current

This documentation is meant to be a living reference, not a one-time brief. When a real build decision changes something documented here (pricing, schema, scope), update the relevant file in the same commit/PR that makes the change — see the "Documentation discipline" note in `docs/11-coding-standards.md`. A stale doc is worse than no doc, because the next agent session will trust it.
