---
description: Produce a plan for a task before any code is written
argument-hint: <task description or task id from docs/15>
---
Plan this task: $ARGUMENTS

Read the relevant docs first (state which). Then give me, without writing code:

1. **Goal** in one sentence and what is explicitly out of scope.
2. **Files** you will create or change.
3. **Data/migrations** involved (tables, RLS) and whether a migration is needed.
4. **Security check** — does this touch auth, institution isolation, scoring or payments? If yes, how it stays safe (`docs/06`).
5. **Tests** you will add (`docs/20`).
6. **Assumptions or questions** — anything ambiguous or a founder decision (`docs/23`). Ask instead of guessing.
7. **How I verify it myself** — exact clicks/commands.

Wait for my approval before implementing.
