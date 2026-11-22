# 14 — How to Instruct the Agent (Step-by-Step Build Guide)

> This file is for **you**, the person directing the AI tool — not primarily for the agent itself, though it's fine for the agent to read it too. It's the operating manual for actually running this build.

## The core principle

> Small task → plan → build → review → verify it actually works → commit → next task.

Never: "build the whole thing." Never even: "build all of Phase 1." One feature at a time, always.

## The workflow loop (repeat this for every single task)

1. **Give a small, scoped instruction** (see prompt templates below)
2. **Ask for a plan first** if the task touches more than one file or anything in `docs/06` (auth/security) or `docs/09` (billing) — read the plan before approving
3. **Let it build**
4. **Review the diff yourself** — even a rough read catches a lot; if something looks like it touches way more files than the task described, stop and ask why
5. **Test it yourself, in the actual browser/app** — don't take "it should work now" as confirmation. Click the button. Try to break it.
6. **Commit with a clear message**, only once it actually works
7. **Check off the relevant box in `docs/13-roadmap-and-phases.md`**
8. Move to the next task

Do not skip step 5. This is the single most common mistake — trusting that code compiling means the feature works.

---

## Session 1 — Orientation (do this first, before any code)

Paste this as your very first message in a new session:

```
Read AGENTS.md and every file in the docs/ folder in full before responding.

Then, without writing any code yet, give me:
1. A one-paragraph summary of what we're building, in your own words
2. Confirmation of the current phase per docs/13-roadmap-and-phases.md
3. A list of the first 5 concrete tasks you'd tackle to complete Phase 0 and start Phase 1,
   broken down small enough that each one is a single focused prompt
4. Any contradictions, gaps, or ambiguities you noticed in the docs that you'd want
   clarified before building

Do not start building. I want to review your understanding first.
```

**Why this matters:** if the agent misunderstood something in the docs, you find out now — in a paragraph you can read in 20 seconds — instead of after it's built three features on a wrong assumption.

Read its answer. If anything's off, correct it in the conversation before moving on.

---

## Session 2 onward — Phase 0 (Setup)

Once you're happy with its orientation summary, give the first real task:

```
Let's start Phase 0 from docs/13-roadmap-and-phases.md.

Task: Scaffold the Next.js + TypeScript + Tailwind project, connect it to a new
Supabase project, and set up the environment variable structure per
docs/11-coding-standards.md.

Give me a plan first — what you're going to create/run — before executing.
Keep this task to setup only. Don't start building any features yet.
```

After it plans and you approve: let it run, then **actually start the dev server yourself** and confirm it loads a blank page without errors before moving on.

---

## Phase 1 onward — the task-sizing rule

For every phase, break it into tasks roughly this small:

- ❌ Too big: "Build Phase 1 — Foundation"
- ✅ Right size: "Build authentication with Supabase Auth (email/password only). Give me a plan first."
- ✅ Right size: "Build the `institutions` and `institution_memberships` tables with RLS policies, following the pattern in docs/05-database-schema.md. Show me the migration file before applying it."
- ✅ Right size: "Build the institution registration form — name, type, exam focus selection. No styling polish yet, just working functionality wired to the database."

A good rule of thumb: **if you can't describe the task in one sentence, it's too big — split it.**

## Reusable task prompt template

Use this shape for basically every task, all the way through the project:

```
Task: [one clear sentence — what to build]

Relevant docs: [which file(s) in docs/ this should follow]

Before you build:
- Give me a short plan (what files you'll touch, what you'll create)
- Flag anything ambiguous instead of guessing

Scope: only this task. Don't refactor unrelated code or start the next task.

When done: tell me exactly what to click/test to verify it works myself.
```

That last line matters — it forces the agent to give you a concrete way to check its own work, rather than you just trusting a "done!" message.

---

## Checkpoint discipline between phases

Before moving from one phase to the next, literally paste the exit criteria from `docs/13-roadmap-and-phases.md` back to the agent:

```
Before we move to Phase 2, confirm each of these from docs/13 is actually true,
and tell me exactly how to verify each one myself:

[paste that phase's checklist and exit criteria here]
```

If it can't honestly confirm all of them, you're not done with that phase yet — regardless of how much code has been written.

---

## Specific tool behaviors worth using

- **Plan mode** (Claude Code, Cursor both support a planning step) — use it for anything touching auth, database schema, payments, or more than ~3 files. Skip it for genuinely trivial changes (copy tweaks, a single component style).
- **Ask it to write tests as part of the task**, not as an afterthought — per `docs/11-coding-standards.md`, the critical path (scoring, readiness calculation, permissions, payments) needs tests, not just working demos.
- **Don't auto-accept everything.** Read diffs that touch `docs/06` (security/permissions) or `docs/09` (billing) territory more carefully than a UI tweak — these are the two places where a subtle bug is expensive later, not just annoying.
- **Start a new session for each new major task** where practical. The docs are written to be re-read every session (see the first line of `AGENTS.md`) specifically so this doesn't cost you continuity.

## What to do when it gets something wrong

Don't just say "that's wrong, fix it." Give it the same precision you'd want from it:

```
This isn't right: [specific thing]
Expected behavior, per docs/[file]: [what should happen instead]
Please fix only this — don't touch anything else.
```

## Red flags that mean you should stop and review, not just keep going

- It touched significantly more files than the task described
- It says it "simplified" or "worked around" something in the security/auth docs
- It introduced a new library, color, or pattern not mentioned in `docs/10` or `docs/11`
- It's the second time in a row it's had to "fix" the same feature
- You genuinely don't understand what it just did well enough to explain it back in one sentence

Any of these — stop, ask it to explain plainly what changed and why, and don't move forward until you actually understand the answer.


---

## Claude Code shortcuts (slash commands included in this package)

If you use Claude Code, these live in `.claude/commands/` and save you retyping prompts:

| Command | Use it when |
|---|---|
| `/start-session` | Opening a new session — reads the docs and `PROGRESS.md`, reports state, proposes the next task, writes no code |
| `/plan-task <task>` | Before any non-trivial task — returns a plan, security check, tests, and how you verify it |
| `/new-migration <what>` | Any database change — enforces RLS and shows SQL before applying |
| `/security-review` | Before committing/merging — checks changes against `docs/06` |
| `/verify-phase <n>` | End of a phase — checks exit criteria with evidence |
| `/update-progress` | End of every session — records what was done in `PROGRESS.md` |

Cursor and Antigravity don't read these commands; for them, paste the same text from the files in `.claude/commands/` as a prompt.

Open founder decisions are tracked in `docs/23-decisions-log.md`. If the agent asks about one of them (payment provider, launch subjects, institutional pricing), that is a real decision for you, not something to tell it to "just pick".
