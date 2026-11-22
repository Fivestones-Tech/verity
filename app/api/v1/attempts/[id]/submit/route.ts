import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeStudent } from "@/lib/auth/session";
import { fail, handleRouteError, ok } from "@/lib/api";
import { submitAttempt } from "@/lib/attempts/service";
import { submitSchema } from "@/lib/validation/attempts";

/** Idempotent submit: a retry returns the existing result and never re-scores. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/v1/attempts/[id]/submit">) {
  try {
    const student = await authorizeStudent();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return fail("attempt_not_found", "We couldn't find this test attempt.", 404);
    const body = submitSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return fail("invalid_request", "We couldn't read that submission. Please try again.", 400);
    return ok(await submitAttempt(student, id, body.data));
  } catch (e) {
    return handleRouteError(e);
  }
}
