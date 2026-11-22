import { NextResponse, type NextRequest } from "next/server";
import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { loadAssessmentResults } from "@/lib/assessments/results";
import { attemptStatusLabel } from "@/lib/format";

function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Prevent spreadsheet formula injection from names typed by users
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/inst/assessments/[id]/export">) {
  try {
    await authorizeStaff();
  } catch (e) {
    return new NextResponse(e instanceof AuthError ? e.message : "Not allowed", { status: 403 });
  }
  const { id } = await ctx.params;
  // Same RLS-scoped loader as the page: an export never shows more than the screen.
  const r = await loadAssessmentResults(id);
  if (!r) return new NextResponse("Not found", { status: 404 });
  const lines = [
    ["student_name", "student_number", "class", "status", "score", "max_score", "percentage", "correct", "incorrect", "unanswered", "time_used_seconds", "submitted_at", ...(r.isSitting ? ["jamb_total", "jamb_subjects"] : [])].join(","),
    ...r.rows.map(({ student: s, attempt: a, jamb }) =>
      [
        s.full_name, s.student_number, s.class_name, attemptStatusLabel(a?.status, a?.synced_late),
        a?.score, a?.max_score, a?.percentage, a?.correct_count, a?.incorrect_count, a?.unanswered_count, a?.time_used_seconds, a?.submitted_at,
        ...(r.isSitting ? [jamb?.total, jamb?.subjects.map((x) => `${x.name} ${x.score}`).join("; ")] : []),
      ].map(csvCell).join(","),
    ),
  ];
  const filename = `${r.assessment.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
