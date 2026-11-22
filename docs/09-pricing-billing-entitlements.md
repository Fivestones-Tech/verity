# 09 — Pricing, Billing & Entitlements

> ⚠️ **Open decision, flagged for the founder, not the agent:** institutional pricing below is currently **flat per student regardless of exam-board scope** (WAEC-only / JAMB-only / Both all cost the same per student). Individual student pricing, by contrast, DOES vary by exam scope. This asymmetry was an explicit default chosen during planning, not a confirmed final decision — if you want institutional pricing to also vary by scope (mirroring the individual ladder), update the `plans` table accordingly before launch. Don't let an agent quietly "fix" this asymmetry either direction without asking.

## Individual student pricing (confirmed)

A pay-as-you-need ladder — students are never forced into a bigger commitment than they want.

| Step | Plan | Price | Access |
|---|---|---|---|
| 1 | Free | ₦0 | Sample practice, limited assessment |
| 2 | Single Assessment | ₦300 one-time | One full assessment attempt, one subject |
| 3 | Single Subject | ₦1,500/year | Full-year prep, one subject |
| 4 | JAMB | ₦3,500/year | Full JAMB/UTME prep, all relevant subjects |
| 5 | WAEC | ₦3,500/year | Full WAEC/WASSCE prep, all relevant subjects |
| 6 | JAMB + WAEC | ₦5,000/year | Both — priced below buying JAMB and WAEC separately (₦7,000) |

Key distinction to enforce in the data model: **Single Assessment (₦300) is a one-time purchase**, not a subscription — it grants exactly one attempt, not a year of access. Single Subject and above are annual subscriptions. Don't conflate these in the `plans`/`subscriptions` schema — see `plans.billing_interval` in `docs/05-database-schema.md`.

## Institutional pricing (confirmed base rates)

| Plan | Price | Included |
|---|---|---|
| Starter | ₦3,000/student/year | Student management, assessments, automatic marking, basic analytics |
| Growth | ₦5,000/student/year | + advanced analytics, teacher intervention tools, parent reports |
| Pro | ₦8,000/student/year | + cohort benchmarking, multiple branches/batches, priority support |

## Exam-board scope at registration (confirmed requirement)

Every institution selects its examination focus at registration:

```
exam_focus: 'waec_only' | 'jamb_only' | 'both'
```

This reflects real-world behavior: **most schools only prepare students for WAEC**, and **most tutorial centres focus on JAMB only.** The registration flow must make this an explicit, easy choice — not an assumption baked into onboarding copy or content access. This field lives on `institutions` (see `docs/05-database-schema.md`) and scopes which content/assessment types are surfaced to that institution's students by default (an institution can still be given access to both if they choose "both").

## Entitlement system — separate from billing logic

Never scatter `if (plan === 'premium')` checks through the codebase. Use a dedicated entitlement layer:

```
feature_entitlements
  plan_id
  feature_key
  enabled
  limit_value (nullable, for capped features)
```

### Canonical v1 entitlement keys

| Key | Meaning |
|---|---|
| `assessments.diagnostic` | Access to diagnostic assessments |
| `assessments.practice.daily_limit` | Capped daily practice questions (Free tier) |
| `assessments.mock.unlimited` | Unlimited full mocks |
| `content.subjects` | Which subject(s) are unlocked |
| `content.exam_scope` | `jamb` / `waec` / `both` |
| `analytics.basic` | Score + topic breakdown |
| `analytics.advanced` | Trends, confidence, full readiness explanation |
| `institution.student_management` | Bulk import, class management |
| `institution.intervention_tools` | Teacher intervention/assignment workflow (Growth+) |
| `institution.benchmarking` | Cohort benchmarking (Pro only) |
| `institution.multi_branch` | Multiple branches/batches (Pro only) |

A feature check in code should always read as: *"does this account currently hold this entitlement?"* — never *"did this account pay?"* The entitlement table is the single source of truth; billing status is what keeps it updated, not what application code checks directly.

## Payment flow (server-verified, no exceptions)

```
User selects plan
  → payment initialized (client calls provider SDK/checkout)
  → payment provider processes transaction
  → provider sends server-side webhook
  → server verifies webhook signature
  → server confirms payment status with provider (don't trust webhook payload alone if the provider offers a verification endpoint)
  → subscription activated
  → entitlements updated
  → receipt/confirmation sent
```

The client-side "payment successful" redirect is a UX convenience only — it never itself activates a subscription. See `docs/06-auth-permissions-security.md`.

## Subscription lifecycle

| Status | Meaning |
|---|---|
| `trial` | Institution trial period (time-limited, not a paid plan) |
| `active` | Paid and current |
| `payment_pending` | Awaiting confirmation |
| `payment_failed` | Failed — entitlements not activated |
| `expired` | Lapsed — historical data preserved, premium features restricted |
| `cancelled` | User-cancelled |

On expiry: **restrict premium features, never delete historical data.** A student or institution that lapses should still see their past results and progress — they just lose access to premium-gated features going forward.

## What NOT to build in v1 billing

- Multiple currencies
- Complex coupon/affiliate systems
- Marketplace commissions
- More than the three institutional tiers above
- Per-feature à la carte purchasing beyond the individual ladder already defined

See `docs/03-mvp-scope.md`.

## Payment provider

Paystack or Flutterwave (Nigerian gateways, both support webhook verification and are well-documented for Supabase/Next.js integration). Do not store raw card data — the provider handles PCI-sensitive data; the platform stores only transaction references and status.
