"use client";

import { useRef, useState, useTransition } from "react";
import { commitStudentImport, previewStudentImport } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Label } from "@/components/ui/field";
import { LoginSlips, type Slip } from "@/components/institution/login-slips";
import type { StudentPreview } from "@/lib/students/import-validation";

export function StudentImportFlow({ centreCode, centreName }: { centreCode: string; centreName: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StudentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slips: Slip[]; failed: string[]; skipped: number } | null>(null);
  const [pending, start] = useTransition();

  const fd = () => {
    const f = fileRef.current?.files?.[0];
    const d = new FormData();
    if (f) d.set("file", f);
    return d;
  };

  if (done) {
    return (
      <div className="space-y-4">
        <Notice tone="success">
          Added <span className="num">{done.slips.length}</span> students.
          {done.skipped > 0 && <> <span className="num">{done.skipped}</span> rows with problems were skipped.</>}
          {done.failed.length > 0 && <> We couldn’t create accounts for: <span className="num">{done.failed.join(", ")}</span>. Try adding them again.</>}
        </Notice>
        <LoginSlips slips={done.slips} centreCode={centreCode} centreName={centreName} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-sm text-lo">
          Use the <a className="text-pine underline" href="/templates/verity-student-template.csv" download>student template</a>: full_name, student_number and (optional) class. Verity creates a password for each student and gives you printable sign-in slips.
        </p>
        <div className="mt-4">
          <Label htmlFor="file">CSV file</Label>
          <input ref={fileRef} id="file" type="file" accept=".csv,text/csv" onChange={() => setPreview(null)} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-paper-line file:bg-paper file:px-4 file:font-mono file:text-xs file:uppercase" />
        </div>
        <Button type="button" variant="ghost" className="mt-4" disabled={pending} onClick={() => start(async () => {
          setError(null);
          const r = await previewStudentImport(fd());
          if (r.ok) setPreview(r.preview); else setError(r.message);
        })}>Check file</Button>
      </Card>
      {error && <Notice tone="error">{error}</Notice>}
      {preview && (
        <>
          {preview.headerErrors.map((e) => <Notice key={e} tone="error">{e}</Notice>)}
          <Card>
            <p className="text-lg"><span className="num font-semibold">{preview.valid.length}</span> of <span className="num">{preview.totalRows}</span> students are ready to add.</p>
            {preview.newClasses.length > 0 && <p className="mt-1 text-sm text-lo">New classes will be created: {preview.newClasses.join(", ")}</p>}
            {preview.invalid.length > 0 && (
              <table className="grid-table mt-3 text-sm">
                <thead><tr><th>Row</th><th>Student</th><th>Problem</th></tr></thead>
                <tbody>
                  {preview.invalid.map((r) => (
                    <tr key={r.rowNumber}><td className="n">{r.rowNumber}</td><td>{r.preview}</td><td>{r.errors.join("; ")}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Button type="button" disabled={pending || preview.valid.length === 0 || preview.headerErrors.length > 0} onClick={() => start(async () => {
            const r = await commitStudentImport(fd());
            if (r.ok) setDone({ slips: r.slips, failed: r.failed, skipped: r.skipped }); else setError(r.message);
          })}>{pending ? "Adding students…" : `Add ${preview.valid.length} students`}</Button>
        </>
      )}
    </div>
  );
}
