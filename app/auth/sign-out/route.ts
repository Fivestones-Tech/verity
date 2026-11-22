import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // ?cleared=1 tells the login page to wipe any test answers stored on this device (docs/17).
  return NextResponse.redirect(new URL("/login?signed_out=1", request.url), { status: 303 });
}
