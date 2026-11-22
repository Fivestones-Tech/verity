import type { NextRequest } from "next/server";
import { authorizeStudent } from "@/lib/auth/session";
import { handleRouteError, ok, fail } from "@/lib/api";
import { startAttempt } from "@/lib/attempts/service";
import { z } from "zod";

/** Start (or resume) the caller's attempt. Returns questions without the answer key. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/v1/assessments/[id]/start">) {
  try {
    const student = await authorizeStudent();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return fail("assessment_not_found", "We couldn't find this test.", 404);
    return ok(await startAttempt(student, id));
  } catch (e) {
    return handleRouteError(e);
  }
}
