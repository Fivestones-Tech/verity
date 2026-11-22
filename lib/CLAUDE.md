# lib/ — logic rules

- `lib/readiness/` is **server-only** and deterministic. Follow `docs/07-readiness-engine.md` exactly. Weights live in a config table keyed by `algorithm_version`, not constants. Pure functions where possible; table-driven tests required.
- `lib/entitlements/` — check entitlement keys from `docs/09`; never check plan names or payment status in feature code.
- `lib/validation/` — shared zod schemas used on both client and server.
- `lib/supabase/` — keep a browser client (anon key, RLS-protected) and a server client separate. The service-role client may only be imported from server files, never from anything a client component imports.
- No AI-provider call may decide a score, entitlement, or permission (`AGENTS.md` rule 9).
- Log errors with context server-side; return safe messages to the user (`docs/12`).
