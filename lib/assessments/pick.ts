/**
 * Filtered random pull for a topic test (docs/08 "blueprint-lite").
 * Spreads questions as evenly as possible across the chosen topics, honouring an
 * optional difficulty filter. Pure: the random function is injectable for tests.
 */
export type PoolQuestion = { id: string; topic_id: string; difficulty: "easy" | "moderate" | "difficult" };

export type PickResult = { ids: string[]; shortBy: number; perTopic: Record<string, number> };

export function pickQuestions(
  pool: PoolQuestion[],
  opts: { topicIds: string[]; count: number; difficulties?: PoolQuestion["difficulty"][] },
  rand: () => number = Math.random,
): PickResult {
  const allowed = new Set(opts.difficulties?.length ? opts.difficulties : ["easy", "moderate", "difficult"]);
  const byTopic = new Map<string, PoolQuestion[]>();
  for (const t of opts.topicIds) byTopic.set(t, []);
  for (const q of pool) {
    if (byTopic.has(q.topic_id) && allowed.has(q.difficulty)) byTopic.get(q.topic_id)!.push(q);
  }
  // shuffle each topic's pool
  for (const list of byTopic.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  // round-robin across topics so each gets a fair share
  const ids: string[] = [];
  const perTopic: Record<string, number> = {};
  const queues = [...byTopic.entries()];
  let progressed = true;
  while (ids.length < opts.count && progressed) {
    progressed = false;
    for (const [topic, list] of queues) {
      if (ids.length >= opts.count) break;
      const q = list.shift();
      if (q) {
        ids.push(q.id);
        perTopic[topic] = (perTopic[topic] ?? 0) + 1;
        progressed = true;
      }
    }
  }
  return { ids, shortBy: Math.max(0, opts.count - ids.length), perTopic };
}
