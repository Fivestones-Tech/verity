import * as store from "@/lib/offline/store";

/**
 * Sends answers saved on the device to the server, and the final submission once
 * every answer is confirmed (docs/17).
 *
 *  - Never claims "synced" before the server confirms.
 *  - Retries with backoff 1s, 2s, 5s, 10s, 30s, then every 30s while the screen is open.
 *  - Flushes immediately on the browser's `online` event and when the tab becomes visible.
 *  - Re-sending is safe: the server keeps the highest seq per question, and submit is idempotent.
 */

export type SyncState = "local" | "syncing" | "synced" | "offline" | "failed";

export type SyncSnapshot = {
  state: SyncState;
  pending: number;
  submitted: null | { status: string };
  lastError: string | null;
};

type Envelope<T> = { data: T | null; error: { code: string; message: string } | null };

export type Transport = {
  saveAnswers(attemptId: string, answers: AnswerPayload[]): Promise<Envelope<{ accepted: string[]; rejected: { question_id: string; reason: string }[] }>>;
  submit(attemptId: string, body: { submission_key: string; answers: AnswerPayload[]; reason: "student" | "timer" }): Promise<Envelope<{ status: string; already_submitted: boolean }>>;
  isOnline(): boolean;
};

export type AnswerPayload = { question_id: string; selected_option_id: string | null; seq: number; answered_at: string };

export const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

export class NetworkError extends Error {}

/** Default transport: same-origin fetch with cookies. */
export const httpTransport: Transport = {
  async saveAnswers(attemptId, answers) {
    return post(`/api/v1/attempts/${attemptId}/answers`, { answers });
  },
  async submit(attemptId, body) {
    return post(`/api/v1/attempts/${attemptId}/submit`, body);
  },
  isOnline() {
    return typeof navigator === "undefined" ? true : navigator.onLine;
  },
};

async function post<T>(url: string, body: unknown): Promise<Envelope<T>> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new NetworkError("network");
  }
  // 5xx and gateway errors are treated like a network drop: keep the data, retry later.
  if (res.status >= 500 || res.status === 429) throw new NetworkError(`http ${res.status}`);
  try {
    return (await res.json()) as Envelope<T>;
  } catch {
    throw new NetworkError("bad json");
  }
}

export class SyncEngine {
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private stopped = false;
  private snapshot: SyncSnapshot = { state: "synced", pending: 0, submitted: null, lastError: null };
  private listeners = new Set<(s: SyncSnapshot) => void>();

  constructor(
    private attemptId: string,
    private transport: Transport = httpTransport,
    private schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = (fn, ms) => setTimeout(fn, ms),
  ) {}

  subscribe(fn: (s: SyncSnapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot);
    return () => this.listeners.delete(fn);
  }

  private emit(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l(this.snapshot);
  }

  get current() {
    return this.snapshot;
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Called after every local save, on reconnect, and on a timer. */
  flush(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.running) {
      // a run is in progress: make it go round once more, and let callers await it
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.flushOnce();
        } while (this.again && !this.stopped);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  }

  private async pendingAnswers() {
    const answers = await store.getAnswers(this.attemptId);
    return answers.filter((a) => a.seq > a.syncedSeq);
  }

  private async flushOnce() {
    const pending = await this.pendingAnswers();
    const att = await store.getAttempt(this.attemptId);
    if (!att) return;
    const wantsSubmit = att.submitIntent !== null;

    if (pending.length === 0 && !wantsSubmit) {
      this.attempt = 0;
      this.emit({ state: "synced", pending: 0, lastError: null });
      return;
    }
    this.emit({ pending: pending.length });
    if (!this.transport.isOnline()) {
      this.emit({ state: "offline" });
      this.retryLater();
      return;
    }

    this.emit({ state: "syncing" });
    try {
      const payload: AnswerPayload[] = pending.map((a) => ({
        question_id: a.questionId,
        selected_option_id: a.selectedOptionId,
        seq: a.seq,
        answered_at: a.answeredAt,
      }));

      if (wantsSubmit) {
        // Send any remaining answers with the submission itself, in one request.
        const res = await this.transport.submit(this.attemptId, { submission_key: att.submitIntent!.key, answers: payload, reason: att.submitIntent!.reason });
        if (res.error) {
          this.emit({ state: "failed", lastError: res.error.message });
          // attempt_not_found etc. won't fix themselves; don't loop forever on a 4xx
          return;
        }
        await store.markSynced(this.attemptId, pending.map((a) => ({ questionId: a.questionId, seq: a.seq })));
        await store.putAttempt({ ...att, serverStatus: res.data!.status as store.LocalAttempt["serverStatus"] });
        this.attempt = 0;
        this.emit({ state: "synced", pending: 0, submitted: { status: res.data!.status }, lastError: null });
        return;
      }

      // chunk to keep requests small on weak networks
      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const res = await this.transport.saveAnswers(this.attemptId, chunk);
        if (res.error) {
          if (res.error.code === "attempt_closed") {
            // Already submitted elsewhere (or by the server). Nothing more to send.
            await store.markSynced(this.attemptId, chunk.map((a) => ({ questionId: a.question_id, seq: a.seq, rejected: "attempt_closed" })));
            await store.putAttempt({ ...att, serverStatus: "submitted" });
            this.emit({ state: "synced", pending: 0, submitted: { status: "submitted" }, lastError: null });
            return;
          }
          this.emit({ state: "failed", lastError: res.error.message });
          this.retryLater();
          return;
        }
        const rejected = new Map(res.data!.rejected.map((r) => [r.question_id, r.reason]));
        await store.markSynced(
          this.attemptId,
          chunk.map((a) => ({ questionId: a.question_id, seq: a.seq, rejected: rejected.get(a.question_id) })),
        );
      }
      this.attempt = 0;
      const left = await this.pendingAnswers();
      this.emit({ state: left.length ? "local" : "synced", pending: left.length, lastError: null });
      if (left.length) this.again = true;
    } catch (e) {
      if (e instanceof NetworkError) {
        this.emit({ state: this.transport.isOnline() ? "failed" : "offline" });
        this.retryLater();
        return;
      }
      throw e;
    }
  }

  private retryLater() {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    this.timer = this.schedule(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }

  /** Reconnect/visibility triggers reset the backoff and flush now. */
  nudge() {
    this.attempt = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.flush();
  }
}
