"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, authorizePlatformAdmin } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { grantCentrePasses } from "@/lib/billing/service";

export type GrantState = { error: string | null; done: string | null };

const schema = z.object({
  institution_id: z.uuid(),
  source: z.enum(["centre_cash", "free_pilot"]),
  scope: z.enum(["selected", "all_without"]),
  note: z.string().trim().max(200).optional(),
});

export async function grantPassesAction(_prev: GrantState, form: FormData): Promise<GrantState> {
  try {
    const me = await authorizePlatformAdmin();
    const p = schema.safeParse({
      institution_id: form.get("institution_id"),
      source: form.get("source"),
      scope: form.get("scope"),
      note: form.get("note") || undefined,
    });
    if (!p.success) return { error: "Please choose how the centre paid.", done: null };
    let ids = form.getAll("student_id").map(String).filter((v) => z.uuid().safeParse(v).success);
    if (p.data.scope === "all_without") {
      const { data } = await createSupabaseAdminClient().from("students").select("id").eq("institution_id", p.data.institution_id).eq("status", "active");
      ids = (data ?? []).map((s) => s.id);
    }
    if (ids.length === 0) return { error: "Tick at least one student.", done: null };
    const r = await grantCentrePasses(me.userId, { institutionId: p.data.institution_id, studentIds: ids, source: p.data.source, note: p.data.note });
    revalidatePath(`/admin/centres/${p.data.institution_id}`);
    return {
      error: null,
      done: r.granted === 0 ? "Those students already have a pass." : `Turned on ${r.granted} pass${r.granted === 1 ? "" : "es"}.${r.skipped ? ` ${r.skipped} already had one.` : ""}`,
    };
  } catch (e) {
    if (e instanceof AuthError || e instanceof DomainError) return { error: e.message, done: null };
    console.error("[admin] grant passes", e);
    return { error: "Something went wrong. Please try again.", done: null };
  }
}
