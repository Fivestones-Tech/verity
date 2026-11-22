---
description: Review current changes against Verity's security rules
---
Review the current uncommitted changes (and any new tables/routes) against `docs/06-auth-permissions-security.md` and the non-negotiable rules in `AGENTS.md`.

Check and report on each:
1. Every new table has RLS enabled with policies derived from `auth.uid()` and membership tables — never a client-supplied `institution_id`.
2. No server-only key (service role, payment, AI, email) is reachable from client code or `NEXT_PUBLIC_*`.
3. Every route checks: authenticated → role → resource scope → validated input → then acts.
4. Scores, entitlements and payment status are computed/verified server-side only.
5. Payment webhooks verify signatures and are idempotent.
6. No secrets, tokens or student PII in logs or committed files.
7. Error messages leak nothing internal.
8. Correct answers are never sent to the client during an assessment.

List findings by severity (Blocker / Should fix / Note) with file and line. Do not fix anything until I confirm.
