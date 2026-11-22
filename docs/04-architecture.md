# 04 — Architecture

## Philosophy

> Simple first. Scalable by design. Build a modular monolith, not premature microservices.

Do not split into separate services until real scale or organizational complexity justifies it. A well-structured Next.js + Supabase application is the right size for v1 and well beyond it.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Backend:** Supabase — PostgreSQL, Auth, Storage, Edge Functions
- **Payments:** Paystack or Flutterwave
- **Hosting:** Vercel (frontend) + Supabase (backend)
- **AI:** external LLM provider, called only from server-side functions

## High-level flow

```
Users (student / teacher / admin)
        ↓
  Next.js App (frontend)
        ↓
  Authentication & Authorization
        ↓
  Application layer
   ├── Institution Management
   ├── Content / Question Bank
   ├── Assessment Engine
   ├── Results Engine
   ├── Readiness Engine
   ├── Recommendation Engine
   ├── Reporting
   ├── Billing / Entitlements
   └── Notifications
        ↓
  PostgreSQL (Supabase)
        ↓
  External services (payments, email, AI, storage)
```

## Frontend responsibility

UI, navigation, forms, assessment-taking interaction, dashboard rendering. **The frontend is never trusted for security decisions** — see `docs/06-auth-permissions-security.md`.

## Backend responsibility

Auth validation, authorization, data integrity, assessment scoring, subscription verification, payment confirmation, AI requests, audit logging. If a decision matters for security or money, it happens server-side, full stop.

## Module dependency order

Build in this order — later modules genuinely depend on earlier ones being correct:

```
Authentication
  → Institutions & Users/Roles
  → Students & Classes
  → Examinations / Subjects / Topics
  → Question Bank
  → Assessment Engine
  → Assessment Attempts
  → Results
  → Topic Mastery
  → Readiness Engine
  → Recommendation Engine
  → Reports
  → Subscriptions / Entitlements
  → Notifications
```

See `docs/13-roadmap-and-phases.md` for how this maps to actual build phases.

## Multi-tenant model

Every institution is a tenant. Core rule:

> An institution's data is fully isolated from every other institution's data — enforced by Row Level Security at the database level, never only by application-layer filtering.

A student is **not** owned by exactly one institution. The relationship is many-to-many via `institution_memberships` — a student can be independent, belong to one school, one tutorial centre, or both simultaneously, with each institution seeing only what it's authorized to see. See `docs/05-database-schema.md` and `docs/06-auth-permissions-security.md`.

## Why Supabase

Provides PostgreSQL + Auth + Storage + RLS + Edge Functions out of the box, letting the team move fast without building backend infrastructure from scratch. Treat it as an **implementation choice**, not the architecture itself — keep the application logically modular so a future infrastructure change wouldn't require a full rewrite.

## Assessment scoring — critical architectural rule

Scoring happens **server-side only**. The client may show a provisional/optimistic result for UX responsiveness, but the stored, official result is always calculated by server logic that re-validates responses against the correct answer key. Never trust a score value sent from the client.

## Offline resilience (v1 scope — see `docs/03-mvp-scope.md`)

v1 does not need a fully offline CBT engine. It does need:
- Answers saved locally the moment they're selected (before any network round-trip)
- Automatic sync + retry on reconnect
- Clear UI state: "Saved on this device, syncing..." vs. "Synced" — never falsely claim success before the server confirms it
- Idempotent submission (a retried sync must not create duplicate attempts or double-score)

## AI architecture

```
User → Application → Server Function → minimal context prepared → AI Provider → validated response → returned to user
```

Rules:
- AI never receives more data than the specific task needs (e.g., a "why is my Mathematics score X" request sends Mathematics performance only, not the full student record)
- AI output is treated as untrusted generated content and is validated/bounded before display
- AI never independently decides payment status, authorization, or official scores

## Environments

Minimum three: development, staging, production. Secrets are environment-specific and never shared across environments. Production database access is restricted and logged.

## What NOT to build into the architecture yet

See `docs/03-mvp-scope.md` "out of scope" — in particular: no microservice split, no separate search infrastructure, no queue system, no white-label multi-brand routing. Add these when real usage demands them, not preemptively.
