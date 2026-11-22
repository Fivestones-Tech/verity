"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { commitQuestionImport, previewQuestionImport, type CommitResult, type PreviewResult } from "./actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Label } from "@/components/ui/field";

export function ImportFlow() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [acceptTopics, setAcceptTopics] = useState(false);
  const [pending, start] = useTransition();

  function formWithFile() {
    const f = fileRef.current?.files?.[0];
    const fd = new FormData();
    if (f) fd.set("file", f);
    if (acceptTopics) fd.set("accept_new_topics", "on");
    return fd;
  }

  function onPreview() {
    setResult(null);
    setAcceptTopics(false);
    start(async () => setPreview(await previewQuestionImport(formWithFile())));
  }

  function onCommit() {
    start(async () => setResult(await commitQuestionImport(formWithFile())));
  }

  if (result?.ok) {
    return (
      <Card>
        <p className="eyebrow">Import complete</p>
        <p className="mt-2 font-serif text-2xl">
          <span className="num">{result.imported}</span> questions are waiting for review
        </p>
        <p className="mt-2 text-lo">
          A different teacher must approve each question before students can see it.
          {result.skipped > 0 && <> <span className="num">{result.skipped}</span> rows with problems were not imported.</>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/inst/questions/review">Go to review</ButtonLink>
          <ButtonLink href="/inst/questions/import" variant="ghost">Import another file</ButtonLink>
        </div>
      </Card>
    );
  }

  const p = preview?.ok ? preview : null;
  const blocked = p ? p.headerErrors.length > 0 || p.validCount === 0 || (p.newTopics.length > 0 && !acceptTopics) : true;

  return (
    <div className="space-y-6">
      <Card>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-lo">
          <li>
            Download the <a className="text-pine underline" href="/templates/verity-question-template.csv" download>question template</a> and fill one question per row.
          </li>
          <li>Save it as CSV (UTF-8) and choose it below.</li>
          <li>Check the preview. Nothing is saved until you press Import.</li>
        </ol>
        <div className="mt-4">
          <Label htmlFor="file">CSV file</Label>
          <input
            ref={fileRef}
            id="file"
            type="file"
            accept=".csv,text/csv"
            onChange={() => {
              setPreview(null);
              setResult(null);
            }}
            className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-paper-line file:bg-paper file:px-4 file:font-mono file:text-xs file:uppercase"
          />
        </div>
        <div className="mt-4">
          <Button type="button" variant="ghost" onClick={onPreview} disabled={pending}>
            {pending && !p ? "Checking…" : "Check file"}
          </Button>
        </div>
      </Card>

      {preview && !preview.ok && <Notice tone="error">{preview.message}</Notice>}
      {result && !result.ok && <Notice tone="error">{result.message}</Notice>}

      {p && (
        <>
          {p.headerErrors.map((e) => (
            <Notice key={e} tone="error">{e}</Notice>
          ))}

          <Card>
            <p className="eyebrow">Preview</p>
            <p className="mt-2 text-lg">
              <span className="num font-semibold">{p.validCount}</span> of <span className="num">{p.totalRows}</span> rows are ready to import.
              {p.invalid.length > 0 && <> <span className="num font-semibold">{p.invalid.length}</span> rows have problems and will be skipped.</>}
            </p>
            {p.bySubject.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="grid-table text-sm">
                  <thead>
                    <tr><th>Subject</th><th>Topic</th><th className="text-right">Questions</th></tr>
                  </thead>
                  <tbody>
                    {p.bySubject.map((g) => (
                      <tr key={g.subject + g.topic}><td>{g.subject}</td><td>{g.topic}</td><td className="n">{g.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {p.invalid.length > 0 && (
            <Card>
              <p className="eyebrow">Rows that will not be imported</p>
              <p className="mt-1 text-sm text-lo">Fix these in your spreadsheet and upload them again later. Row numbers match your spreadsheet.</p>
              <div className="mt-3 overflow-x-auto">
                <table className="grid-table text-sm">
                  <thead><tr><th>Row</th><th>Question</th><th>Problem</th></tr></thead>
                  <tbody>
                    {p.invalid.slice(0, 200).map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="n">{r.rowNumber}</td>
                        <td className="max-w-[14rem]">{r.preview || <span className="text-lo">(empty)</span>}</td>
                        <td><ul className="list-disc pl-4">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {p.warnings.length > 0 && (
            <details className="rounded-[3px] border border-paper-line bg-paper-soft p-4">
              <summary className="cursor-pointer text-sm"><span className="num">{p.warnings.length}</span> rows will import with a warning</summary>
              <ul className="mt-2 space-y-1 text-sm text-lo">
                {p.warnings.slice(0, 100).map((w) => (
                  <li key={w.rowNumber}>Row <span className="num">{w.rowNumber}</span>: {w.warnings.join("; ")}</li>
                ))}
              </ul>
            </details>
          )}

          {p.newTopics.length > 0 && (
            <Card>
              <p className="eyebrow">New topics</p>
              <p className="mt-1 text-sm text-lo">These topics are not in Verity yet. They will be added for your centre only and marked “to be checked against the syllabus”.</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {p.newTopics.map((t) => (
                  <li key={t.subject_name + t.parent + t.name}>
                    {t.subject_name}: {t.parent ? `${t.parent} › ` : ""}<strong>{t.name}</strong>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" className="h-5 w-5 accent-[var(--pine)]" checked={acceptTopics} onChange={(e) => setAcceptTopics(e.target.checked)} />
                Yes, add these {p.newTopics.length} topics
              </label>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onCommit} disabled={pending || blocked}>
              {pending ? "Importing…" : `Import ${p.validCount} questions`}
            </Button>
            <Link href="/inst/questions" className="text-sm text-lo underline">Cancel</Link>
          </div>
        </>
      )}
    </div>
  );
}
