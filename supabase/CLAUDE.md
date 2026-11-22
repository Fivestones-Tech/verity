# supabase/ — database rules

Read `docs/05-database-schema.md`, `docs/06-auth-permissions-security.md`, `docs/21-deployment-and-operations.md` before changing anything here.

- All schema changes are **new timestamped files** in `migrations/`. Never edit an applied migration.
- Every table: RLS enabled + policies in the same migration. Derive scope from `auth.uid()` and membership tables; never trust a client-supplied `institution_id`.
- snake_case; uuid primary keys; `created_at`; money as integer kobo; index foreign keys.
- `readiness_scores` is append-only. Never UPDATE or DELETE historical rows.
- Never expose the service role key to client code. Edge Functions that use it must verify the caller first.
- Show SQL to the founder before applying. Run the RLS test suite after every migration (`docs/20`).
- Use `/new-migration` for new changes.
