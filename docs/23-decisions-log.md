# 23 — Decisions Log

> Short records of decisions that shape the build. Agents: read before proposing a change to anything listed here. Add a new entry whenever a decision is made or reversed. Format: Decision · Why · Status · Date.

## Settled

| # | Decision | Why | Status |
|---|---|---|---|
| D1 | Product name Verity; company Lumio | Evidence/truth meaning matches positioning; Lumio as maker | Settled |
| D2 | Stack: Next.js (App Router) + TypeScript + Tailwind + Supabase | Fast, one team can run it, RLS built in | Settled |
| D3 | Modular monolith, not microservices | Right size for v1 | Settled |
| D4 | Multi-tenant via `institution_id` + RLS; students linked to institutions via memberships (many-to-many) | A student can be independent or in several institutions | Settled |
| D5 | Scoring and readiness are server-side and deterministic; AI never calculates them | Trust and auditability | Settled |
| D6 | v1 recommendations are rule-based | Cheap, explainable | Settled |
| D7 | `readiness_scores` is append-only with `algorithm_version` | History must never be rewritten | Settled |
| D8 | Multiple choice only in v1 | Scope control | Settled |
| D9 | Channels in v1: in-app + email only | Scope and cost | Settled |
| D10 | Individual pricing ladder: Free, ₦300 single assessment (one-time), ₦1,500 single subject/yr, ₦3,500 JAMB/yr, ₦3,500 WAEC/yr, ₦5,000 JAMB+WAEC/yr | Pay-for-what-you-need | Settled (launch pricing, subject to review) |
| D11 | Institutional plans: Starter ₦3,000, Growth ₦5,000, Pro ₦8,000 per student/year | Simple per-student model | Settled (launch pricing) |
| D12 | Institutions choose exam focus at registration (WAEC only / JAMB only / both) | Most schools do WAEC; most tutorial centres do JAMB | Settled |
| D13 | Payments confirmed only by verified server webhook | Security | Settled |
| D14 | Design system as in `docs/10` (ink/paper/pine/gold/brick; Newsreader/Archivo/IBM Plex Mono) | Brand distinctness; matches landing page | Settled |
| D17 | Students sign in with centre code + student number + password; the centre creates their accounts and prints sign-in slips | Many pilot students have no email; no email provider chosen yet (O5) | Settled for pilot 2026-11-22 (assumption, founder may revisit) |
| D18 | Pilot review step: a second teacher's "Approve" publishes the question (approved+published in one step); nobody can approve their own question | Small centre, speed to 440 questions by Jan 11 | Settled for pilot 2026-11-22 (assumption) |
| D19 | Answers chosen before time ran out but synced up to 6 h late still count; the attempt is flagged "synced late" for teachers | Network drops must never cost answers (docs/17), but late sync is visible | Settled for pilot 2026-11-22 (assumption) |
| D20 | Topics a centre adds during import are private to that centre and marked pending syllabus verification | docs/18 forbids invented platform topics; isolation rule | Settled 2026-11-22 |
| D21 | Topic results roll subtopics up into their main topic | A 20-question test split across many subtopics gives no usable signal | Settled 2026-11-22 |
| D22 | Mocks come in two forms: one-subject mocks and a full JAMB sitting (English + the student's 3 subjects, 60 + 3×40 questions, 2 hours) | Founder chose "both" | Settled 2026-11-22 |
| D23 | Each student's 3 JAMB subjects are set by the centre (spreadsheet "subjects" column or the Students page); English is always included | Founder chose "add to student spreadsheet"; centres know combinations from registration | Settled 2026-11-22 |
| D24 | A full sitting is scored JAMB-style: each subject out of 100, total out of 400. A subject without enough published questions is left out, and students taking it can't sit that mock | Matches how students read UTME scores; lets science students sit while arts questions are still being written | Settled 2026-11-22 (assumption, easy to change) |
| D16 | v1 subjects (supersedes O3 default): English, Mathematics, Physics, Chemistry, Biology, Economics, Government, Commerce, Principles of Accounts / Financial Accounting, Literature in English, CRS. Covers Science, Commercial and Arts students; Nigerian market only for now | Pilot centre has mixed streams | Settled 2026-11-22 |
| D15 | No equity fundraising for now; support via loan, grant/donation, early institutional commitment, or non-financial help | Founder decision | Settled |

## Open — founder must decide (agents: do not decide these silently)

| # | Question | Current default | Where it matters |
|---|---|---|---|
| O1 | Should institutional pricing vary by exam focus (like the student ladder)? | Flat per student regardless of focus | `docs/09`, `plans` table |
| O2 | Are the v1 readiness weights acceptable? | 30/30/15/10/15 (recent/mastery/consistency/coverage/mock) | `docs/07` |
| O3 | Which subject combinations launch first? (subjects answered by D16) | See D16 | `docs/18`, Phase 2 seed |
| O4 | Payment provider: Paystack or Flutterwave? | Undecided | Phase 6 |
| O5 | Email provider for transactional mail | Undecided (Resend/Postmark/Brevo) | `docs/19` |
| O6 | Free-tier limits (daily questions, which sample assessment) | Undecided | `docs/09` entitlements |
| O7 | Exact institutional trial length and limits | Undecided | `docs/09` |
| O8 | Question sourcing mix and who writes the first set | Undecided | `docs/18` |
| O9 | Parent experience depth in v1 | Minimal read-only | `docs/03` |

## Reversal rule

If a settled decision must change, add a new row stating what changed and why, mark the old one "Superseded by Dn", and update every doc it touches in the same PR.
