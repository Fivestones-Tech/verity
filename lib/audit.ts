import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function audit(entry: {
  actorUserId: string | null;
  institutionId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    institution_id: entry.institutionId,
    action: entry.action,
    resource_type: entry.resourceType ?? null,
    resource_id: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) console.error("[audit] failed to write audit log", entry.action, error.message);
}
