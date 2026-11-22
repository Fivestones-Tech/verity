import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/auth/session";
import { loadMistakes } from "@/lib/student/results";
import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = { title: "Review mistakes" };

export default async function ReviewMistakesPage({ params }: PageProps<"/app/results/[attemptId]/review">) {
  const ctx = await requireStudentPage();
  const { attemptId } = await params;
  const m = await loadMistakes(ctx, attemptId);
  if (!m) notFound();
  const byTopic = new Map<string, typeof m.items>();
  for (const it of m.items) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">{m.name}</p>
      <h1 className="mb-5 font-serif text-3xl">Review your mistakes</h1>
      {m.items.length === 0 ? (
        <EmptyState title="No mistakes" body="You got every question right in this test." />
      ) : (
        [...byTopic.entries()].map(([topic, items]) => (
          <section key={topic} className="mb-8">
            <h2 className="eyebrow mb-2">{topic} · <span className="num">{items.length}</span> to review</h2>
            <ol className="space-y-4">
              {items.map((it) => (
                <li key={it.question_id} className="rounded-[3px] border border-paper-line bg-paper-soft p-4">
                  <p className="text-sm text-lo">Question <span className="num">{it.number}</span></p>
                  <p className="mt-1 whitespace-pre-wrap">{it.text}</p>
                  <ul className="mt-3 space-y-1.5">
                    {it.options.map((o) => {
                      const mine = o.id === it.selected;
                      return (
                        <li key={o.id} className={`flex gap-3 rounded-[3px] border px-3 py-2 text-sm ${o.is_correct ? "border-pine bg-paper" : mine ? "border-brick" : "border-paper-line"}`}>
                          <span className="num">{o.label}</span>
                          <span className="flex-1">{o.text}</span>
                          {o.is_correct && <span className="font-mono text-xs uppercase text-pine">Correct answer</span>}
                          {mine && !o.is_correct && <span className="font-mono text-xs uppercase text-brick">Your answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                  {!it.selected && <p className="mt-2 text-sm text-lo">You left this blank.</p>}
                  {it.explanation && (
                    <div className="mt-3">
                      <p className="eyebrow">Why</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{it.explanation}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
      <Link href={`/app/results/${attemptId}`} className="text-sm underline">Back to result</Link>
    </div>
  );
}
