import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normaliseCentreCode } from "@/lib/auth/student-login";

/**
 * Students who join Verity on their own belong to Verity's own "online centre"
 * (founder decision D26). It is an ordinary institution, registered like any centre;
 * ONLINE_CENTRE_CODE names it. Verity's team posts its tests.
 */
export function onlineCentreCode(): string | null {
  const raw = process.env.ONLINE_CENTRE_CODE;
  return raw ? normaliseCentreCode(raw) : null;
}

export async function loadOnlineCentre(): Promise<{ id: string; name: string; code: string } | null> {
  const code = onlineCentreCode();
  if (!code) return null;
  const { data } = await createSupabaseAdminClient()
    .from("institutions")
    .select("id, name, code, status")
    .eq("code", code)
    .maybeSingle();
  if (!data || ["suspended", "cancelled"].includes(data.status)) return null;
  return { id: data.id, name: data.name, code: data.code };
}

export async function isOnlineCentre(institutionId: string | null): Promise<boolean> {
  if (!institutionId) return false;
  const centre = await loadOnlineCentre();
  return centre?.id === institutionId;
}
