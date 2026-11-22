# 12 — API Conventions

## When to use what

| Situation | Use |
|---|---|
| Simple authenticated read, RLS is sufficient protection | Supabase client directly (`supabase.from(...)`) |
| Write that needs privileged logic (scoring, payments, AI) | Server route (`/app/api/...`) or Supabase Edge Function |
| Scheduled/background work (recalculating readiness in bulk, sending digest notifications) | Edge Function on a schedule, or a queued job |

Default to a server route whenever unsure — see `docs/11-coding-standards.md`.

## Route structure

```
/api/v1/{resource}/{action}
```

Examples:
```
POST   /api/v1/assessments/[id]/submit
POST   /api/v1/payments/webhook
GET    /api/v1/students/[id]/readiness
POST   /api/v1/institutions/[id]/students/import
```

Version the API (`/v1/`) from day one — cheap now, expensive to retrofit later.

## Response envelope (standard shape)

Success:
```json
{
  "data": { ... },
  "error": null
}
```

Error:
```json
{
  "data": null,
  "error": {
    "code": "assessment_already_submitted",
    "message": "This assessment has already been submitted."
  }
}
```

- `code` is a stable, machine-readable string the frontend can branch on
- `message` is safe to show the user directly (see error-handling tone rules in `docs/11-coding-standards.md`) — never put a raw exception message here
- Never include stack traces, internal IDs unrelated to the request, or database error text in the response body

## Pagination convention

```json
{
  "data": [...],
  "meta": { "page": 1, "per_page": 25, "total": 340 },
  "error": null
}
```

Any list endpoint returning institution-scale data (students, assessments, attempts) must be paginated by default — never return an unbounded list.

## Auth

- Supabase session token passed automatically via cookies/client for client-initiated calls
- Server-to-server or webhook calls (payment provider → our webhook) verified via provider signature, not session auth — see `docs/06-auth-permissions-security.md`

## Idempotency

Any endpoint that creates a record with real-world consequence (assessment submission, payment confirmation) must accept and honor an idempotency key, or otherwise be naturally idempotent (e.g., checking `attempt.status` before allowing a second submit). See `docs/06` and `docs/08` for the specific idempotency rules on submission and payments.

## Rate limiting

Apply rate limits to: login, password recovery, assessment submission, and payment-related endpoints at minimum. Exact limits are an infrastructure decision at deployment time, not something to hardcode arbitrarily during feature development — but every route in this list needs *some* limit before real users touch it.

## What every endpoint must check, in order

1. Is the request authenticated?
2. Does the authenticated user hold a role permitted to perform this action? (`docs/06`)
3. Is the target resource within their authorized scope (own data / their institution)? (`docs/06`)
4. Is the request payload valid? (shared zod schema — `docs/11`)
5. Only then: perform the action, and log it if it's audit-worthy (`docs/06`)

Skipping any of these steps "to save time" is exactly the kind of shortcut `AGENTS.md`'s non-negotiable rules exist to prevent.
