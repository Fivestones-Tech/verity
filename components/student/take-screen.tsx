"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as store from "@/lib/offline/store";
import { SyncEngine, type SyncSnapshot } from "@/lib/offline/sync-engine";
import { prepareOfflineShell } from "@/lib/offline/app-shell";
import { Button, buttonClass } from "@/components/ui/button";

type Payload = {
  attempt_id: string;
  assessment_id: string;
  assessment_name: string;
  subject_name: string;
  status: store.LocalAttempt["serverStatus"];
  started_at: string;
  expires_at: string;
  server_now: string;
  questions: { id: string; number: number; subject?: string; text: string; options: store.LocalQuestion["options"] }[];
  saved: { question_id: string; selected_option_id: string | null; seq: number }[];
};

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string; needsPass?: boolean }
  | { kind: "taking" };

const SYNC_TEXT: Record<SyncSnapshot["state"], string> = {
  local: "Saved on this device",
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline — your answers are safe on this device",
  failed: "Couldn't sync yet — we'll keep trying",
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "same-origin", ...init });
  const body = await res.json().catch(() => null);
  return { status: res.status, body: body as { data: Payload | null; error: { code: string; message: string } | null } | null };
}

export function TakeScreen({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState<store.LocalAttempt | null>(null);
  const [questions, setQuestions] = useState<store.LocalQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, string | null>>(new Map());
  const [index, setIndex] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [sync, setSync] = useState<SyncSnapshot>({ state: "synced", pending: 0, submitted: null, lastError: null });
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const engineRef = useRef<SyncEngine | null>(null);
  const clockRef = useRef<{ baseServer: number; basePerf: number } | null>(null);
  const warnedRef = useRef<{ five: boolean; one: boolean }>({ five: false, one: false });
  const expiredRef = useRef(false);

  /** Server time, advanced by the monotonic clock so changing the device clock can't add time. */
  const serverNow = useCallback(() => {
    const c = clockRef.current;
    if (!c) return Date.now();
    return c.baseServer + (performance.now() - c.basePerf);
  }, []);

  // ---------- load: local copy first (works offline), then refresh from server ----------
  useEffect(() => {
    let cancelled = false;
    async function adopt(local: store.LocalAttempt) {
      const qs = await store.getQuestions(local.attemptId);
      const ans = await store.getAnswers(local.attemptId);
      if (cancelled) return;
      clockRef.current = { baseServer: Date.now() + local.clockOffsetMs, basePerf: performance.now() };
      setAttempt(local);
      setQuestions(qs);
      setAnswers(new Map(ans.map((a) => [a.questionId, a.selectedOptionId])));
      setIndex(Math.min(local.currentIndex, Math.max(0, qs.length - 1)));
      setMarked(new Set(local.marked));
      const engine = new SyncEngine(local.attemptId);
      engineRef.current?.stop();
      engineRef.current = engine;
      engine.subscribe((s) => !cancelled && setSync(s));
      setPhase({ kind: "taking" });
      void engine.flush();
      if (navigator.onLine) void prepareOfflineShell();
    }

    async function fromServer(): Promise<store.LocalAttempt | null> {
      const sent = Date.now();
      const r = await fetchJson(`/api/v1/assessments/${assessmentId}/start`, { method: "POST" });
      const received = Date.now();
      if (!r.body?.data) {
        if (r.body?.error?.code === "attempt_limit_reached") {
          setPhase({ kind: "error", message: "You have already taken this test." });
        } else {
          const code = r.body?.error?.code;
          setPhase({
            kind: "error",
            message: r.body?.error?.message ?? "We couldn't open the test. Check your connection and try again.",
            needsPass: code === "pass_required" || code === "trial_single_subject_only",
          });
        }
        return null;
      }
      const p = r.body.data;
      const offset = new Date(p.server_now).getTime() - (sent + received) / 2;
      const existing = await store.getAttempt(p.attempt_id);
      const local: store.LocalAttempt = {
        attemptId: p.attempt_id,
        assessmentId: p.assessment_id,
        assessmentName: p.assessment_name,
        subjectName: p.subject_name,
        expiresAt: p.expires_at,
        startedAt: p.started_at,
        clockOffsetMs: offset,
        seq: existing?.seq ?? 0,
        currentIndex: existing?.currentIndex ?? 0,
        marked: existing?.marked ?? [],
        submitIntent: existing?.submitIntent ?? null,
        serverStatus: p.status,
        savedAt: Date.now(),
      };
      await store.putAttempt(local);
      await store.putQuestions(
        p.questions.map((q) => ({ key: store.qKey(p.attempt_id, q.id), attemptId: p.attempt_id, questionId: q.id, number: q.number, subject: q.subject, text: q.text, options: q.options })),
      );
      await store.mergeServerAnswers(p.attempt_id, p.saved);
      return (await store.getAttempt(p.attempt_id)) ?? local;
    }

    (async () => {
      try {
        await store.pruneOld();
        const local = await store.findAttemptForAssessment(assessmentId);
        if (local && local.serverStatus === "in_progress") {
          await adopt(local);
          // refresh timer offset and merge server-side answers when we can
          if (navigator.onLine) {
            const fresh = await fromServer().catch(() => null);
            if (fresh && !cancelled) await adopt(fresh);
          }
          return;
        }
        if (!navigator.onLine) {
          setPhase({ kind: "error", message: "You're offline. Connect to the internet to start this test. Once it has started, your answers are saved on this device even if the connection drops." });
          return;
        }
        const fresh = await fromServer();
        if (fresh && !cancelled) await adopt(fresh);
      } catch (e) {
        console.error(e);
        if (!cancelled) setPhase({ kind: "error", message: "We couldn't open the test on this device. Please refresh the page." });
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.stop();
    };
  }, [assessmentId]);

  // ---------- reconnect / visibility triggers ----------
  useEffect(() => {
    const nudge = () => engineRef.current?.nudge();
    const vis = () => document.visibilityState === "visible" && nudge();
    window.addEventListener("online", nudge);
    window.addEventListener("offline", nudge);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("online", nudge);
      window.removeEventListener("offline", nudge);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  // ---------- finished: server confirmed the submission ----------
  useEffect(() => {
    if (!sync.submitted || !attempt) return;
    const id = attempt.attemptId;
    engineRef.current?.stop();
    void store.deleteAttemptData(id).finally(() => router.replace(`/app/results/${id}`));
  }, [sync.submitted, attempt, router]);

  const requestSubmit = useCallback(
    async (reason: "student" | "timer") => {
      if (!attempt) return;
      const current = (await store.getAttempt(attempt.attemptId)) ?? attempt;
      if (!current.submitIntent) {
        const next = { ...current, submitIntent: { key: newKey(), reason } };
        await store.putAttempt(next);
        setAttempt(next);
      }
      setConfirming(false);
      engineRef.current?.nudge();
    },
    [attempt],
  );

  // ---------- timer ----------
  useEffect(() => {
    if (phase.kind !== "taking" || !attempt) return;
    const exp = new Date(attempt.expiresAt).getTime();
    const tick = () => {
      const left = exp - serverNow();
      setRemainingMs(Math.max(0, left));
      if (left <= 5 * 60_000 && !warnedRef.current.five && left > 60_000) {
        warnedRef.current.five = true;
        setAnnounce("5 minutes left.");
      }
      if (left <= 60_000 && !warnedRef.current.one && left > 0) {
        warnedRef.current.one = true;
        setAnnounce("1 minute left.");
      }
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        setAnnounce("Time's up. Submitting your answers.");
        void requestSubmit("timer");
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [phase.kind, attempt, serverNow, requestSubmit]);

  const locked = Boolean(attempt?.submitIntent) || (remainingMs !== null && remainingMs <= 0);
  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => answers.get(x.questionId)).length, [questions, answers]);

  const choose = useCallback(
    async (optionId: string) => {
      if (!attempt || !q || locked) return;
      // 1. on the device first, before any network call
      setAnswers((m) => new Map(m).set(q.questionId, optionId));
      await store.recordAnswer(attempt.attemptId, q.questionId, optionId, new Date(serverNow()).toISOString());
      // 2. then sync
      void engineRef.current?.flush();
    },
    [attempt, q, locked, serverNow],
  );

  const go = useCallback(
    (i: number) => {
      if (!attempt) return;
      const next = Math.max(0, Math.min(questions.length - 1, i));
      setIndex(next);
      void store.getAttempt(attempt.attemptId).then((a) => a && store.putAttempt({ ...a, currentIndex: next }));
    },
    [attempt, questions.length],
  );

  const toggleMark = useCallback(() => {
    if (!attempt || !q) return;
    const s = new Set(marked);
    if (s.has(q.questionId)) s.delete(q.questionId);
    else s.add(q.questionId);
    setMarked(s);
    void store.getAttempt(attempt.attemptId).then((a) => a && store.putAttempt({ ...a, marked: [...s] }));
  }, [attempt, q, marked]);

  // ---------- keyboard: 1-4 / A-D choose, N/P next/prev ----------
  useEffect(() => {
    if (phase.kind !== "taking") return;
    const onKey = (e: KeyboardEvent) => {
      if (confirming || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      const idx = ["1", "2", "3", "4"].indexOf(k) >= 0 ? Number(k) - 1 : ["a", "b", "c", "d"].indexOf(k);
      if (idx >= 0 && q?.options[idx]) {
        e.preventDefault();
        void choose(q.options[idx].id);
      } else if (k === "n" || e.key === "ArrowRight") go(index + 1);
      else if (k === "p" || e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, confirming, q, choose, go, index]);

  // ---------- render ----------
  if (phase.kind === "loading") {
    return (
      <Shell>
        <p className="eyebrow">Preparing…</p>
        <div className="skeleton mt-4 h-6 w-2/3" />
        <div className="skeleton mt-3 h-24 w-full" />
        <p className="mt-4 text-sm text-lo">Saving the questions on this device so your test keeps working if the connection drops.</p>
      </Shell>
    );
  }
  if (phase.kind === "error") {
    return (
      <Shell>
        <h1 className="font-serif text-2xl">We couldn’t open this test</h1>
        <p className="mt-2 text-lo">{phase.message}</p>
        <div className="mt-5 flex gap-3">
          {phase.needsPass ? (
            <a href="/app/pass" className={buttonClass("gold")}>Get the pass</a>
          ) : (
            <Button onClick={() => window.location.reload()} variant="ghost">Try again</Button>
          )}
          <a href="/app" className="inline-flex min-h-11 items-center text-sm underline">Back to my tests</a>
        </div>
      </Shell>
    );
  }
  if (sync.submitted) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl">{sync.submitted.status === "auto_submitted" ? "Time's up — your answers were submitted." : "Submitted"}</h1>
        <p className="mt-2 text-lo">Opening your result…</p>
      </Shell>
    );
  }
  if (!attempt || !q) return null;

  // A full JAMB sitting has one paper per subject: show tabs to jump between them.
  const papers: { name: string; first: number; count: number; answered: number }[] = [];
  questions.forEach((x, i) => {
    const name = x.subject ?? "";
    const last = papers[papers.length - 1];
    const done = answers.get(x.questionId) ? 1 : 0;
    if (last && last.name === name) { last.count++; last.answered += done; }
    else papers.push({ name, first: i, count: 1, answered: done });
  });
  const multiPaper = papers.length > 1;
  const paperOf = (i: number) => papers.findLast((p) => p.first <= i) ?? papers[0];

  const mins = remainingMs == null ? "--" : String(Math.floor(remainingMs / 60000)).padStart(2, "0");
  const secs = remainingMs == null ? "--" : String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0");
  const warn = remainingMs !== null && remainingMs <= 5 * 60_000;
  const selected = answers.get(q.questionId) ?? null;
  const syncLabel = locked && sync.state !== "synced"
    ? sync.state === "offline"
      ? "Saved on this device. We'll submit as soon as you're back online."
      : "Submitting…"
    : SYNC_TEXT[sync.state];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-6">
      <p aria-live="assertive" className="sr-only">{announce}</p>
      <header className="sticky top-0 z-10 -mx-4 border-b border-paper-line bg-paper px-4 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-medium">{attempt.assessmentName}</p>
          <p
            className={`num shrink-0 rounded-[3px] border px-2 py-0.5 text-lg ${warn ? "border-brick text-brick" : "border-transparent"}`}
            aria-label={`Time left ${mins} minutes ${secs} seconds`}
            role="timer"
          >
            ⏱ {mins}:{secs}
          </p>
        </div>
        {multiPaper && (
          <nav aria-label="Subjects" className="mt-2 flex flex-wrap gap-1.5 pb-1">
            {papers.map((p) => {
              const here = paperOf(index).first === p.first;
              return (
                <button
                  key={p.first}
                  type="button"
                  onClick={() => go(p.first)}
                  aria-current={here ? "true" : undefined}
                  className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${here ? "border-pine bg-pine text-ink-hi" : "border-paper-line"}`}
                >
                  {p.name} <span className="num">{p.answered}/{p.count}</span>
                </button>
              );
            })}
          </nav>
        )}
        <div className="mt-1 flex items-center justify-between gap-3 text-sm">
          <span className="num">{multiPaper ? <>{paperOf(index).name} · Q {index - paperOf(index).first + 1} / {paperOf(index).count}</> : <>Q {index + 1} / {questions.length}</>}</span>
          <span data-testid="sync-state" data-state={sync.state} className="flex items-center gap-1.5 text-right text-lo">
            <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${sync.state === "synced" ? "bg-pine" : sync.state === "syncing" ? "bg-gold" : "border border-lo"}`} />
            {syncLabel}
          </span>
        </div>
      </header>

      <main className="flex-1 pt-5">
        <p className="whitespace-pre-wrap text-lg leading-relaxed" id="question-text">{q.text}</p>
        <fieldset className="mt-5 space-y-2" aria-labelledby="question-text" disabled={locked}>
          {q.options.map((o) => {
            const on = selected === o.id;
            return (
              <label
                key={o.id}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[3px] border px-3 py-3 ${on ? "border-pine bg-paper-soft" : "border-paper-line"} ${locked ? "cursor-not-allowed opacity-70" : ""}`}
              >
                <input type="radio" name={`q-${q.questionId}`} value={o.id} checked={on} onChange={() => void choose(o.id)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--pine)]" />
                <span className="num w-5 shrink-0">{o.label}</span>
                <span className="flex-1">{o.text}</span>
              </label>
            );
          })}
        </fieldset>
        <button type="button" onClick={toggleMark} aria-pressed={marked.has(q.questionId)} className={`mt-4 min-h-11 rounded-full border px-4 text-sm ${marked.has(q.questionId) ? "border-gold text-gold" : "border-paper-line text-lo"}`}>
          ⚑ {marked.has(q.questionId) ? "Marked for review" : "Mark for review"}
        </button>
      </main>

      <footer className="sticky bottom-0 -mx-4 border-t border-paper-line bg-paper px-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>← Prev</Button>
          <Button variant="ghost" onClick={() => go(index + 1)} disabled={index === questions.length - 1}>Next →</Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 pb-2">
          <button type="button" onClick={() => setGridOpen((v) => !v)} aria-expanded={gridOpen} className="min-h-11 text-sm underline">
            Question grid · <span className="num">{answeredCount}/{questions.length}</span> answered
          </button>
          <Button onClick={() => setConfirming(true)} disabled={locked}>{locked ? "Submitting…" : "Submit"}</Button>
        </div>
        {gridOpen && papers.map((p) => (
          <div key={p.first} className="pb-3">
          {multiPaper && <p className="eyebrow mb-1.5">{p.name}</p>}
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {questions.slice(p.first, p.first + p.count).map((x, j) => {
              const i = p.first + j;
              const done = Boolean(answers.get(x.questionId));
              return (
                <button
                  key={x.questionId}
                  type="button"
                  onClick={() => { go(i); setGridOpen(false); }}
                  aria-label={`${multiPaper ? `${p.name} question ${j + 1}` : `Question ${i + 1}`}${done ? ", answered" : ", not answered"}${marked.has(x.questionId) ? ", marked" : ""}`}
                  className={`num relative h-10 rounded-[3px] border text-sm ${done ? "border-pine bg-pine text-ink-hi" : "border-paper-line"} ${i === index ? "ring-2 ring-gold" : ""}`}
                >
                  {multiPaper ? j + 1 : i + 1}
                  {marked.has(x.questionId) && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-gold" />}
                </button>
              );
            })}
          </div>
          </div>
        ))}
      </footer>

      {confirming && (
        <ConfirmSubmit answered={answeredCount} total={questions.length} onCancel={() => setConfirming(false)} onConfirm={() => void requestSubmit("student")} />
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-2xl px-4 py-10">{children}</div>;
}

function ConfirmSubmit({ answered, total, onCancel, onConfirm }: { answered: number; total: number; onCancel: () => void; onConfirm: () => void }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCancel]);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-20 flex items-end justify-center bg-ink/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-[3px] border border-paper-line bg-paper p-5">
        <h2 id="confirm-title" className="font-serif text-xl">
          You answered <span className="num">{answered}</span> of <span className="num">{total}</span>. Submit?
        </h2>
        {answered < total && <p className="mt-2 text-sm text-lo">Unanswered questions score zero.</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button ref={backRef} type="button" onClick={onCancel} className="inline-flex min-h-11 items-center rounded-full border border-paper-line px-5 font-mono text-xs uppercase">Go back</button>
          <Button onClick={onConfirm}>Submit</Button>
        </div>
      </div>
    </div>
  );
}
