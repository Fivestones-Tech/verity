# 17 — Offline Resilience & Sync (v1)

> Product promise: **a network drop must never cost a student their answers.** This is a stated differentiator. v1 does NOT need a fully offline exam engine (see `docs/03-mvp-scope.md`) — it needs a reliable local-first answer pipeline during an assessment.

## Scope

**In v1:** local persistence of an in-progress attempt, queued sync with retry, honest UI state, resume after refresh/crash, server-validated timing, idempotent submission.
**Not in v1:** downloading assessments days ahead for fully offline sitting, local-network gateways, offline scoring as the official result.

## Storage

Use **IndexedDB** (via a small wrapper such as `idb`) — not `localStorage` (size/sync limits, blocks the main thread). One database `verity`, stores:

| Store | Key | Holds |
|---|---|---|
| `attempts` | `attemptId` | metadata: assessmentId, studentId, startedAt, serverStartedAt, durationSeconds, status, lastSyncedAt |
| `questions` | `attemptId:questionId` | question text, options (NO correct-answer flag) |
| `answers` | `attemptId:questionId` | selectedOptionId, answeredAt, timeSpentSeconds, seq, syncState |
| `outbox` | auto-increment | pending sync operations |

**Security rule:** the correct answer is never sent to the client during an assessment. The client stores only what it needs to display and to record choices. Scoring is server-side only (`docs/08`).

Cached assessment data expires: delete local copies after the attempt is confirmed synced, or after a max age (e.g. 24 h) — whichever first. Clear on logout. Shared devices: logging out wipes the IndexedDB stores for that user.

## Answer pipeline

```
Student selects option
  1. write to IndexedDB `answers` (syncState = 'local')      ← instant, no network
  2. update UI: "Saved on this device"
  3. enqueue in `outbox`
  4. if online: send batch → server upsert (idempotent) → on 2xx mark 'synced'
  5. if offline / fails: keep in outbox, retry with backoff
  6. on `online` event or visibility change: flush outbox
```

- Every answer carries a monotonically increasing `seq` per attempt. Server keeps the highest `seq` per question — last-write-wins by `seq`, not by timestamp (client clocks are unreliable).
- Batch sends (e.g. every answer, but coalesced within ~1 s) keep requests small on weak networks.
- Retry backoff: 1s, 2s, 5s, 10s, 30s, then every 30s while the screen is open. Never give up silently.

## Sync states shown to the student

| State | Text | Meaning |
|---|---|---|
| local | "Saved on this device" | in IndexedDB, not yet confirmed by server |
| syncing | "Syncing…" | request in flight |
| synced | "Synced" | server confirmed |
| offline | "Offline — your answers are safe on this device" | no connection |
| failed | "Couldn't sync yet — we'll keep trying" | retries ongoing |

**Never display "Submitted" or "Synced" before the server confirms.** On the final submit, if offline: show "Saved on this device. We'll submit as soon as you're back online." and keep the attempt open locally.

## Timer

- The attempt is created **server-side** at start; the server records `started_at` and computes `expires_at = started_at + duration`.
- The client counts down from `expires_at − serverNow`, where `serverNow` is estimated at start as `serverTime + (localNow − requestSentAt)/2`. Store the offset; do not re-read the device clock to extend time.
- On reconnect/submit, the server validates: submission time ≤ `expires_at + grace` (grace small, e.g. 60 s, covers sync delay). Answers with `answered_at` after expiry are rejected.
- If the device clock is changed mid-attempt, the countdown (based on elapsed monotonic time via `performance.now()`) is unaffected.
- On expiry while offline: lock the UI, mark `auto_submitted` locally, queue the final submit.

## Resume

On app load, if an `attempts` record has status `in_progress` and `expires_at` is in the future: show "Resume assessment" on the dashboard and open at the last question. If expired: lock, submit what exists, show result when synced.

## Idempotent submission

`POST /api/v1/assessments/[id]/submit` accepts the attempt id and a client-generated `submissionKey`. Server logic: if the attempt is already `submitted` or `auto_submitted`, return the existing result (200) — never create a second attempt or re-score. See `docs/08`.

## Conflicts

- Same answer from two devices: higher `seq` wins; surface no UI. Prefer single active session per attempt: when a second device opens an in-progress attempt, show "This assessment is open on another device — continue here?" and bind the attempt to the newest session.
- Server rejects answers for a question not in the attempt (tamper guard).

## Weak-network optimisation

- Send question payloads as plain text JSON, gzip/brotli on the wire; images lazily and optional with text fallback.
- Prefetch all questions for the attempt at start (single request) so the sitting does not depend on per-question fetches.
- Keep the taking screen JS bundle small; no heavy libraries on that route.

## PWA (light touch in v1)

Add a web manifest and a service worker that caches the app shell and static assets so the taking screen loads on a flaky connection. Do not cache authenticated API responses in the service worker. Offline fallback page for non-assessment routes.

## Required tests (see `docs/20-testing-strategy.md`)

1. Answer saved locally with network disabled; survives page refresh.
2. Reconnect flushes outbox; server has all answers; no duplicates.
3. Duplicate submit returns the same result, one attempt row.
4. Clock tampering does not extend time.
5. Logout clears local stores.
6. Two-device open shows the takeover prompt.
