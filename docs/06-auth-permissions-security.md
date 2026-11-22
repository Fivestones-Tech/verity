# 06 — Auth, Permissions & Security

## The one rule that matters most

> **Authenticate → Authorize → Scope → Act → Audit.**
> Who are you? What are you allowed to do? What resources are within your scope? What are you trying to do? Should this be logged?

Every sensitive operation should be traceable through those five steps. If any step is skipped, the design is wrong.

## Authentication

- Supabase Auth (email/password minimum for v1)
- Passwords never stored or logged in plaintext (Supabase handles this — don't build a parallel credential store)
- Session expiry and secure token handling via Supabase defaults; don't roll custom session logic
- Account recovery must not leak whether an email/account exists (avoid "no account found" vs "wrong password" distinctions in error messages)

## Roles (v1 fixed set — see `docs/03-mvp-scope.md` on why custom roles are out of scope)

| Role | Scope |
|---|---|
| `student` | Own data only |
| `parent` | Only student(s) they are explicitly linked to via `parent_links` |
| `teacher` / `tutor` | Their assigned classes/students within one institution |
| `institution_admin` | Their institution's full data |
| `institution_owner` | Same as admin + billing/staff management |
| `platform_admin` | Platform-level, logged access |

A single `profiles` row can hold different roles in different institutions simultaneously (e.g., teacher at School A, tutor at Tutorial Centre B) via separate `institution_memberships` rows — never model this as a single flat `role` column on the user.

## Permission matrix (v1)

| Action | Student | Teacher | Institution Admin | Platform Admin |
|---|---|---|---|---|
| Take assessment | ✓ | — | — | — |
| View own results | ✓ | — | — | — |
| View assigned students' results | — | ✓ (own classes only) | ✓ (institution-wide) | ✓ (logged) |
| Create assessment | — | ✓ | ✓ | ✓ |
| Manage students | — | limited | ✓ | ✓ |
| Manage staff | — | — | ✓ | ✓ |
| Manage billing | — | — | ✓ (if owner) | ✓ |
| Manage platform content | — | — | — | ✓ |

## Institution isolation — the core multi-tenant rule

> A user from Institution A must never read, list, search, export, or infer the existence of Institution B's data, through any surface — UI, API, direct database query, search, or export.

Enforcement:
1. **Row Level Security is the enforcement layer**, not application-level filtering. See `docs/05-database-schema.md` for the concrete policy pattern.
2. Never accept a client-supplied `institution_id` as authoritative. Always derive institutional scope server-side from `auth.uid()` via `institution_memberships`.
3. Search, export, and reporting features must inherit the same RLS-backed scope as the underlying dashboard — a teacher who can't see a student in the UI must not be able to export that student's data either.
4. File storage (Supabase Storage) needs the same discipline — a signed URL or bucket path must not allow guessing into another institution's files.

## Assessment & result integrity

- **Scores are always calculated server-side.** The client never sends a "final score" that gets trusted.
- Once an assessment is submitted, the original attempt record is immutable. If a correction is genuinely needed (e.g., a bad question is fixed), it's represented as an explicit, logged correction — never a silent overwrite of history.
- Duplicate/retried submissions must be idempotent — a network retry must never create two attempts or double-score one.

## Payment integrity

- Payment status is confirmed via **server-side webhook verification** with the payment provider, never by trusting a client-side "payment succeeded" redirect alone.
- Webhook endpoints verify provider signatures to prevent forged payment-success calls.
- `payments.provider_reference` is unique — this is the idempotency key preventing duplicate subscription activation from a retried webhook.

## AI-specific security rules

- AI providers receive the minimum context needed for the specific task (e.g., a "why is my Mathematics score X" explanation gets Mathematics performance data only — not the student's full profile, payment history, or unrelated institution data).
- AI never determines: entitlement status, official scores, or account/institution identity.
- AI-generated content (explanations, recommendations, summaries) is clearly distinguishable from platform-verified data, and is validated before being shown or stored.

## Audit logging — minimum events to log (v1)

- Assessment created / edited / published
- Result modified (with reason)
- Student added / removed from institution
- Staff role changed
- Subscription/payment status changed
- Question answer key changed

Each log row: actor, action, resource, timestamp, and relevant before/after context (see `audit_logs` in `docs/05-database-schema.md`).

## Minors / child-safety data handling

The primary user base is secondary school students, many of whom are minors. Practical implications for build decisions:
- Collect the minimum data necessary — no unnecessary personal fields
- Parent/guardian linking requires an explicit verification step, not just a self-reported claim
- No unsolicited marketing communication to student accounts
- Avoid any feature that could enable an unrelated adult to directly message a student account (no open messaging/chat in v1 — see `docs/03-mvp-scope.md`)

## Security checklist before any real user data is collected

- [ ] RLS enabled and tested on every table in `docs/05-database-schema.md`
- [ ] HTTPS enforced everywhere
- [ ] Secrets in environment variables only, verified not committed to git
- [ ] Payment webhook signature verification implemented and tested
- [ ] Automated backups configured and a restoration process has actually been tested once (not just assumed to work)
- [ ] Rate limiting on login, password recovery, and payment endpoints
- [ ] Privacy policy and terms of service published
- [ ] Cross-institution access attempted and confirmed blocked in a real test (not just code review)

## What agents must never do to "make something work"

- Disable or bypass an RLS policy to fix a bug — fix the policy or the query, not the guardrail
- Hardcode a test institution's UUID as a fallback in production code paths
- Trust a `role` or `institution_id` value passed in from the client without server-side verification
- Log full request bodies containing passwords, tokens, or payment details
- Use production data in a development/test environment
