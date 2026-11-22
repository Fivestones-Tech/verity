import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * On-device storage for an in-progress test (docs/17). IndexedDB, never
 * localStorage. Holds only what the screen needs: question text and options.
 * The answer key is never sent to the device.
 *
 * Stores:
 *  - attempts:  one record per attempt (timer data, sequence counter, submit intent)
 *  - questions: question text + options, keyed `${attemptId}:${questionId}`
 *  - answers:   the student's choice per question with its seq and the highest
 *               seq the server has confirmed. An answer with seq > syncedSeq is
 *               pending: together these act as the outbox.
 */

export const DB_NAME = "verity";
const DB_VERSION = 1;
/** Local copies are deleted after this long, synced or not (docs/17). */
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type LocalAttempt = {
  attemptId: string;
  assessmentId: string;
  assessmentName: string;
  subjectName: string;
  expiresAt: string; // server time
  startedAt: string;
  /** serverTime - deviceTime, estimated when the attempt was loaded */
  clockOffsetMs: number;
  seq: number;
  currentIndex: number;
  marked: string[];
  submitIntent: { key: string; reason: "student" | "timer" } | null;
  serverStatus: "in_progress" | "submitted" | "auto_submitted" | "abandoned";
  savedAt: number;
};

export type LocalQuestion = {
  key: string;
  attemptId: string;
  questionId: string;
  number: number;
  text: string;
  options: { id: string; label: "A" | "B" | "C" | "D"; text: string }[];
};

export type LocalAnswer = {
  key: string;
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
  seq: number;
  syncedSeq: number;
  answeredAt: string; // estimated server time
  rejected?: string;
};

interface VerityDB extends DBSchema {
  attempts: { key: string; value: LocalAttempt; indexes: { byAssessment: string } };
  questions: { key: string; value: LocalQuestion; indexes: { byAttempt: string } };
  answers: { key: string; value: LocalAnswer; indexes: { byAttempt: string } };
}

let dbPromise: Promise<IDBPDatabase<VerityDB>> | null = null;

export function db() {
  if (!dbPromise) {
    dbPromise = openDB<VerityDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        const a = d.createObjectStore("attempts", { keyPath: "attemptId" });
        a.createIndex("byAssessment", "assessmentId");
        const q = d.createObjectStore("questions", { keyPath: "key" });
        q.createIndex("byAttempt", "attemptId");
        const an = d.createObjectStore("answers", { keyPath: "key" });
        an.createIndex("byAttempt", "attemptId");
      },
      blocking() {
        // another tab wants to upgrade/delete: let it
        dbPromise?.then((x) => x.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

export const qKey = (attemptId: string, questionId: string) => `${attemptId}:${questionId}`;

export async function findAttemptForAssessment(assessmentId: string): Promise<LocalAttempt | undefined> {
  const all = await (await db()).getAllFromIndex("attempts", "byAssessment", assessmentId);
  return all.sort((a, b) => b.savedAt - a.savedAt)[0];
}

export async function getAttempt(attemptId: string) {
  return (await db()).get("attempts", attemptId);
}

export async function putAttempt(a: LocalAttempt) {
  await (await db()).put("attempts", { ...a, savedAt: Date.now() });
}

export async function getQuestions(attemptId: string): Promise<LocalQuestion[]> {
  const list = await (await db()).getAllFromIndex("questions", "byAttempt", attemptId);
  return list.sort((a, b) => a.number - b.number);
}

export async function putQuestions(list: LocalQuestion[]) {
  const tx = (await db()).transaction("questions", "readwrite");
  await Promise.all([...list.map((q) => tx.store.put(q)), tx.done]);
}

export async function getAnswers(attemptId: string): Promise<LocalAnswer[]> {
  return (await db()).getAllFromIndex("answers", "byAttempt", attemptId);
}

/**
 * Record a choice. Runs in one transaction so the sequence number and the answer
 * are written together: a crash can't leave a seq that was never used.
 */
export async function recordAnswer(attemptId: string, questionId: string, selectedOptionId: string | null, answeredAt: string) {
  const d = await db();
  const tx = d.transaction(["attempts", "answers"], "readwrite");
  const att = await tx.objectStore("attempts").get(attemptId);
  if (!att) throw new Error("attempt missing");
  const seq = att.seq + 1;
  await tx.objectStore("attempts").put({ ...att, seq, savedAt: Date.now() });
  const key = qKey(attemptId, questionId);
  const prev = await tx.objectStore("answers").get(key);
  const ans: LocalAnswer = { key, attemptId, questionId, selectedOptionId, seq, syncedSeq: prev?.syncedSeq ?? 0, answeredAt };
  await tx.objectStore("answers").put(ans);
  await tx.done;
  return ans;
}

/** Merge answers the server already holds (e.g. from another session) without losing newer local ones. */
export async function mergeServerAnswers(attemptId: string, saved: { question_id: string; selected_option_id: string | null; seq: number }[]) {
  const d = await db();
  const tx = d.transaction(["attempts", "answers"], "readwrite");
  const att = await tx.objectStore("attempts").get(attemptId);
  let maxSeq = att?.seq ?? 0;
  for (const s of saved) {
    const key = qKey(attemptId, s.question_id);
    const local = await tx.objectStore("answers").get(key);
    if (!local || local.seq <= s.seq) {
      await tx.objectStore("answers").put({
        key, attemptId, questionId: s.question_id, selectedOptionId: s.selected_option_id,
        seq: s.seq, syncedSeq: s.seq, answeredAt: local?.answeredAt ?? new Date().toISOString(),
      });
    }
    maxSeq = Math.max(maxSeq, s.seq);
  }
  if (att) await tx.objectStore("attempts").put({ ...att, seq: maxSeq });
  await tx.done;
}

export async function markSynced(attemptId: string, results: { questionId: string; seq: number; rejected?: string }[]) {
  const d = await db();
  const tx = d.transaction("answers", "readwrite");
  for (const r of results) {
    const key = qKey(attemptId, r.questionId);
    const a = await tx.store.get(key);
    if (a) await tx.store.put({ ...a, syncedSeq: Math.max(a.syncedSeq, r.seq), rejected: r.rejected });
  }
  await tx.done;
}

export async function deleteAttemptData(attemptId: string) {
  const d = await db();
  const tx = d.transaction(["attempts", "questions", "answers"], "readwrite");
  await tx.objectStore("attempts").delete(attemptId);
  for (const store of ["questions", "answers"] as const) {
    const keys = await tx.objectStore(store).index("byAttempt").getAllKeys(attemptId);
    for (const k of keys) await tx.objectStore(store).delete(k);
  }
  await tx.done;
}

/** Remove local copies older than MAX_AGE_MS. */
export async function pruneOld(now = Date.now()) {
  const all = await (await db()).getAll("attempts");
  for (const a of all) if (now - a.savedAt > MAX_AGE_MS) await deleteAttemptData(a.attemptId);
}

/** Sign-out on a shared device wipes everything (docs/17). */
export async function wipeAll() {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB(DB_NAME);
}
