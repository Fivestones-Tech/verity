import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import * as store from "@/lib/offline/store";
import { NetworkError, SyncEngine, type AnswerPayload, type Transport } from "@/lib/offline/sync-engine";

/** In-memory server that mimics the real one: highest seq wins, submit is idempotent. */
function fakeServer() {
  const answers = new Map<string, { opt: string | null; seq: number }>();
  let status = "in_progress";
  let online = true;
  let submits = 0;
  const apply = (list: AnswerPayload[]) => {
    for (const a of list) {
      const prev = answers.get(a.question_id);
      if (!prev || prev.seq < a.seq) answers.set(a.question_id, { opt: a.selected_option_id, seq: a.seq });
    }
  };
  const transport: Transport = {
    async saveAnswers(_id, list) {
      if (!online) throw new NetworkError("offline");
      if (status !== "in_progress") return { data: null, error: { code: "attempt_closed", message: "closed" } };
      apply(list);
      return { data: { accepted: list.map((a) => a.question_id), rejected: [] }, error: null };
    },
    async submit(_id, body) {
      if (!online) throw new NetworkError("offline");
      submits++;
      if (status === "in_progress") {
        apply(body.answers);
        status = body.reason === "timer" ? "auto_submitted" : "submitted";
        return { data: { status, already_submitted: false }, error: null };
      }
      return { data: { status, already_submitted: true }, error: null };
    },
    isOnline: () => online,
  };
  return { transport, answers, setOnline: (v: boolean) => (online = v), get submits() { return submits; }, get status() { return status; } };
}

const ATT = "att-1";
async function seedAttempt() {
  await store.putAttempt({
    attemptId: ATT, assessmentId: "as-1", assessmentName: "T", subjectName: "Maths",
    expiresAt: new Date(Date.now() + 600_000).toISOString(), startedAt: new Date().toISOString(),
    clockOffsetMs: 0, seq: 0, currentIndex: 0, marked: [], submitIntent: null, serverStatus: "in_progress", savedAt: Date.now(),
  });
}

const noTimers = () => 0 as unknown as ReturnType<typeof setTimeout>;

describe("SyncEngine", () => {
  beforeEach(async () => {
    await store.wipeAll();
    await seedAttempt();
  });

  it("saves locally while offline, then syncs everything on reconnect with no duplicates", async () => {
    const srv = fakeServer();
    srv.setOnline(false);
    const engine = new SyncEngine(ATT, srv.transport, noTimers);
    await store.recordAnswer(ATT, "q1", "o1", new Date().toISOString());
    await store.recordAnswer(ATT, "q2", "o5", new Date().toISOString());
    await store.recordAnswer(ATT, "q1", "o2", new Date().toISOString()); // changed mind
    await engine.flush();
    expect(engine.current.state).toBe("offline");
    expect(engine.current.pending).toBe(2);
    expect(srv.answers.size).toBe(0);

    srv.setOnline(true);
    engine.nudge();
    await engine.flush();
    expect(engine.current.state).toBe("synced");
    expect(srv.answers.get("q1")).toEqual({ opt: "o2", seq: 3 });
    expect(srv.answers.get("q2")).toEqual({ opt: "o5", seq: 2 });
    // nothing left to send
    expect((await store.getAnswers(ATT)).every((a) => a.syncedSeq === a.seq)).toBe(true);
  });

  it("never reports synced before the server confirms", async () => {
    const srv = fakeServer();
    const states: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: Transport = { ...srv.transport, saveAnswers: async (id, a) => { await gate; return srv.transport.saveAnswers(id, a); } };
    const engine = new SyncEngine(ATT, slow, noTimers);
    engine.subscribe((s) => states.push(s.state));
    await store.recordAnswer(ATT, "q1", "o1", new Date().toISOString());
    const p = engine.flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(engine.current.state).toBe("syncing");
    release();
    await p;
    expect(states.at(-1)).toBe("synced");
  });

  it("queues the final submit offline and sends it once on reconnect", async () => {
    const srv = fakeServer();
    const engine = new SyncEngine(ATT, srv.transport, noTimers);
    srv.setOnline(false);
    await store.recordAnswer(ATT, "q1", "o1", new Date().toISOString());
    const att = (await store.getAttempt(ATT))!;
    await store.putAttempt({ ...att, submitIntent: { key: "k-123456789", reason: "timer" } });
    await engine.flush();
    expect(engine.current.submitted).toBeNull();
    expect(engine.current.state).toBe("offline");

    srv.setOnline(true);
    engine.nudge();
    await engine.flush();
    expect(engine.current.submitted).toEqual({ status: "auto_submitted" });
    expect(srv.answers.get("q1")?.opt).toBe("o1");
    // a retried submit doesn't change the result
    await srv.transport.submit(ATT, { submission_key: "k-123456789", answers: [], reason: "student" });
    expect(srv.status).toBe("auto_submitted");
  });

  it("local answers survive a reload (new engine, same device)", async () => {
    await store.recordAnswer(ATT, "q7", "o9", new Date().toISOString());
    const answers = await store.getAnswers(ATT);
    expect(answers.find((a) => a.questionId === "q7")?.selectedOptionId).toBe("o9");
    expect((await store.getAttempt(ATT))!.seq).toBe(1);
  });

  it("sign-out wipes the device", async () => {
    await store.recordAnswer(ATT, "q1", "o1", new Date().toISOString());
    await store.wipeAll();
    expect(await store.getAttempt(ATT)).toBeUndefined();
  });
});
