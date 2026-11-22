import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeStudent } from "@/lib/auth/session";
import { fail, handleRouteError, ok } from "@/lib/api";
import { saveAnswers } from "@/lib/attempts/service";
import { saveAnswersSchema } from "@/lib/validation/attempts";

/** Batch upsert of answers. Safe to retry: the server keeps the highest seq per question. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/attempts/[id]/answers">) {
  try {
    const student = await authorizeStudent();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return fail("attempt_not_found", "We couldn't find this test attempt.", 404);
    const body = saveAnswersSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("invalid_request", "Those answers could not be read. Please try again.", 400);
    return ok(await saveAnswers(student, id, body.data.answers));
  } catch (e) {
    return handleRouteError(e);
  }
}
