---
description: Create a database migration the safe way
argument-hint: <what the migration does>
---
Create a migration for: $ARGUMENTS

Rules (`docs/05`, `docs/21`):
1. Check existing files in `supabase/migrations/` first; never edit an applied migration.
2. Follow table/column conventions in `docs/05-database-schema.md` (snake_case, uuid keys, `created_at`, money as integer kobo).
3. Include RLS: `enable row level security` plus select/insert/update/delete policies using the patterns in `docs/05`. A table without policies is not finished.
4. Add indexes for foreign keys and common filters.
5. Avoid destructive changes; if unavoidable, say so and propose the two-step approach.
6. Show me the full SQL **before** applying. After I approve: apply locally, run the RLS test suite, regenerate TypeScript types, and note it in `PROGRESS.md`.
