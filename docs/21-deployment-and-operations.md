# 21 — Deployment & Operations

> Goal: boring, repeatable releases and a system you can recover. Keep it simple; add tooling only when a real problem appears.

## Environments

| Env | Purpose | Data |
|---|---|---|
| local | developer machine, local Supabase (`supabase start`) | synthetic |
| staging | pre-release testing, mirrors production config | synthetic |
| production | real users | real |

Separate Supabase projects for staging and production. Separate API keys, payment keys (test vs live), email domains, and secrets per environment. Never point staging at production data.

## Hosting

- **Frontend:** Vercel (preview deployment per pull request; production from `main`).
- **Backend:** Supabase (database, auth, storage, edge functions).
- **Region:** choose the available Supabase and Vercel regions closest to Nigerian users and **measure latency from a Nigerian connection** before deciding. Verify current region options in the dashboards rather than assuming.

## Domains

- Marketing site and app on the product domain (e.g. `verity.<tld>`); app on `app.` subdomain optional.
- Email sending on a dedicated subdomain (e.g. `mail.`) with SPF, DKIM, DMARC configured.
- HTTPS enforced everywhere; HSTS on.

## Secrets

- Stored in Vercel/Supabase environment settings only; `.env*` git-ignored; `.env.example` committed with names, not values.
- Server-only keys (Supabase service role, payment secret, email API, AI key) never use the `NEXT_PUBLIC_` prefix.
- Rotate any key that is ever pasted into chat, logs or a commit. Assume exposed → rotate.

## Database migrations

- Every change is a file in `supabase/migrations/` (timestamped), reviewed in a PR.
- Apply to staging first, run the RLS suite, then production.
- Destructive changes (drop column/table) require a two-step release: stop using → later remove.
- Take a backup (or confirm automated backup is recent) immediately before any production migration.
- Never edit an applied migration; add a new one.

## Release process

1. PR opened → CI (lint, typecheck, unit, integration, RLS) + Vercel preview.
2. Review diff, test the preview on a phone.
3. Merge to `main` → deploy to staging; run E2E.
4. Promote to production (merge to `production` branch or Vercel promote).
5. Post-deploy smoke test: login, take a short assessment, view dashboard.
6. Tag the release (`v0.x.y`) and note it in `PROGRESS.md`.

**Rollback:** keep the previous Vercel deployment promotable; for database, roll forward with a corrective migration (restore from backup only for data-loss incidents).

## Backups and recovery

- Enable automated backups (and point-in-time recovery if the plan supports it).
- **Test a restore into a scratch project at least once before launch**, then quarterly. An untested backup is not a backup.
- Record: who can restore, how long it takes, how users are told.

## Monitoring

- **Errors:** Sentry (or equivalent) on frontend and server routes; alert on new error spikes.
- **Uptime:** a simple external ping on the landing page and a health route.
- **Business-critical alerts:** failed webhooks, failed submissions, failed notification deliveries, auth error spikes.
- **Logs:** structured, no passwords/tokens/payment data/raw student PII.
- Review a weekly digest: errors, slow queries, failed payments, sync failures.

## Performance budget (assessment path)

Taking-screen route: small JS payload, no blocking third-party scripts, fonts with `display=swap`. Test on a throttled "Slow 4G" profile and a low-end Android device. Dashboard queries paginated and indexed (`docs/05`).

## Cost watch

Track monthly: Supabase usage, Vercel bandwidth, email volume, AI calls. Set provider spend alerts. Keep AI calls server-side and rate-limited per user.

## Legal & compliance before real users

- Privacy policy and terms published (lawyer-reviewed).
- Review Nigerian data-protection obligations, especially for minors and institution-supplied student data; record institution consent/authorisation basis.
- Data-processing terms with each vendor you rely on.
- Data deletion/deactivation process documented (`docs/06`).

## Payments go-live checklist

- Company registered and business bank account in place (providers typically require this for live mode — confirm their current requirements).
- Test mode end-to-end passes (`docs/20`, billing suite).
- Live webhook URL configured with signature verification.
- Refund and dispute process written down.

## Incident response (minimal)

Detect → contain → assess impact → fix → tell affected users if needed → write a short post-mortem in `docs/23-decisions-log.md` or a `/docs/incidents/` file. Severity guide in `docs/06`.

## Pilot support

For the first pilot institutions: a shared WhatsApp/email support line, a weekly check-in, a simple issue log. Founder-led; record every complaint — it becomes the next roadmap.
