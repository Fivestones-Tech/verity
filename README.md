# Verity

Exam readiness for JAMB/UTME and WAEC/WASSCE students, and the centres that prepare them. A Lumio product.

This repository holds the app **and** its build brief: start with `CLAUDE.md` / `AGENTS.md`, then `PROGRESS.md` for where things stand, and `docs/` for the full spec.

## What works today (pilot slice)

- A tutorial centre registers, adds teachers, and imports students from a spreadsheet. Students get printable sign-in slips (centre code + student number + password).
- Teachers import questions from a spreadsheet (validated, previewed, never silently fixed) or add them one at a time. A second teacher reviews and publishes each one.
- Teachers build timed topic tests from published questions and open them to the whole centre or to classes.
- Students take tests on their phones. Every answer is saved on the device first, so a dropped connection (or a reload with no connection) loses nothing; answers sync when the connection returns.
- Scoring is done on the server. Students see their score, a breakdown by topic, one next step, and a review of their mistakes with explanations. Teachers see per-student results, topic averages, the most-missed questions, and a CSV download.

## Run it locally

Needs Node 22 and Docker.

```bash
npm install
npx supabase start          # local Postgres + Auth (first run downloads images)
npx supabase db reset       # apply migrations + reference data
cp .env.example .env.local  # then paste the URL/keys printed by `supabase start`
npm run dev                 # http://localhost:3000
```

Register a centre at `/register/institution`.

## Tests

```bash
npm test                    # unit tests (scoring, timing, import validation, offline sync)
npm run test:integration    # against local Supabase: tenant isolation (RLS), attempts, idempotent submit
npm run build && npx next start &  npm run test:e2e   # full pilot flow in a real browser, incl. going offline mid-test
```

Integration tests refuse to run against anything but a local database.
