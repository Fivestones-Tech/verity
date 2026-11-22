# 19 — Notifications (v1)

> v1 channels: **in-app + email only.** No SMS or WhatsApp in v1 (`docs/03-mvp-scope.md`). Principle: send fewer, better messages. Every notification answers four questions — who needs it, what is it, why does it matter, what do they do next. If it cannot answer the last one, do not send it.

## Events that create notifications

| Event | Recipient | In-app | Email | Deep link |
|---|---|---|---|---|
| Assessment assigned | Student | ✓ | ✓ | /app/assessments/[id] |
| Assessment due soon (24 h) | Student, only if not started | ✓ | ✓ | /app/assessments/[id] |
| Result ready | Student | ✓ | — | /app/results/[attemptId] |
| New top recommendation | Student | ✓ | — | /app |
| Class assessment closed | Teacher | ✓ | — | /inst/assessments/[id] |
| Intervention alert (several students weak in a topic) | Teacher | ✓ | — | /inst/classes/[id] |
| Staff invited | Invitee | — | ✓ | /join/[code] |
| Payment confirmed | Payer | ✓ | ✓ (receipt) | /app/upgrade or /inst/billing |
| Payment failed | Payer | ✓ | ✓ | same |
| Subscription expiring (7 days) | Payer | ✓ | ✓ | same |
| Password reset | User | — | ✓ | /reset-password |

Transactional emails (receipts, invites, password reset) are always sent. Everything else respects user preferences.

## Rules

- **Consolidate.** One assessment completion must not trigger five messages. Combine "result ready" + "new recommendation" into one in-app item when they arise together.
- **No false alarms.** Intervention alerts only fire when there is enough evidence (minimum evidence rules in `docs/07`) and are phrased "needs attention", never "will fail".
- **Quiet defaults.** Max one non-transactional email per student per day. No marketing messages to student accounts (minors) in v1.
- **Deep links** go straight to the relevant screen, not the dashboard.
- **Language:** plain, kind, specific. Example: "Your Mathematics result is ready. Algebra needs attention — a 15-question practice set is waiting."
- Sender name "Verity"; footer line "Verity is a Lumio product".

## Data model

Use `notifications` from `docs/05-database-schema.md`. Add:

```sql
notification_preferences
  user_id        uuid primary key references profiles(id)
  email_assignments  boolean default true
  email_reminders    boolean default true
  email_billing      boolean default true   -- receipts always sent regardless
  created_at, updated_at

notification_deliveries
  id              uuid primary key
  notification_id uuid references notifications(id)
  channel         text  -- 'email'
  status          text  -- 'queued' | 'sent' | 'failed'
  provider_message_id text
  dedupe_key      text unique   -- prevents duplicate sends on retry
  attempts        integer default 0
  created_at, sent_at
```

## Architecture

```
Domain event (e.g. attempt scored)
  → insert row into `notifications` (in-app)  [same transaction as the event]
  → insert `notification_deliveries` rows for email (status queued, dedupe_key)
  → background worker / Edge Function sends queued emails, updates status, retries with backoff
```

- `dedupe_key` pattern: `{event_type}:{resource_id}:{user_id}` so a retried event cannot double-send.
- Never block the user action on email delivery.
- Failed deliveries: retry up to 3 times, then mark `failed` and log; surface a count in platform-admin monitoring.

## Email provider

Transactional provider callable from server functions (e.g. Resend, Postmark, or Brevo). Choose one, keep the sender behind a small `sendEmail()` interface so it can be swapped. Configure SPF, DKIM, DMARC on the sending domain before launch. Keep API keys server-side only.

## Templates (v1 set)

`assessment_assigned`, `assessment_due_soon`, `staff_invite`, `payment_receipt`, `payment_failed`, `subscription_expiring`, `password_reset` (provided by Supabase Auth — style it to match the brand). Plain, light HTML, mono numbers, pine accent, no images required. Include plain-text part.

## In-app notification centre

Bell icon in app header with unread count; list newest first; mark read on open; "Mark all read". Empty state: "Nothing new. We'll tell you when there's something to do."

## Tests

Duplicate event → one email. Preference off → no email (but receipt still sends). Deep link opens the right screen. Failed send retries then stops.
