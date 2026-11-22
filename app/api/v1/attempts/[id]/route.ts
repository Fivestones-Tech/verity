import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeStudent } from "@/lib/auth/session";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getAttemptPayload } from "@/lib/attempts/service";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/v1/attempts/[id]">) {
  try {
    const student = await authorizeStudent();
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return fail("attempt_not_found", "We couldn't find this test attempt.", 404);
    return ok(await getAttemptPayload(student, id));
  } catch (e) {
    return handleRouteError(e);
  }
}
