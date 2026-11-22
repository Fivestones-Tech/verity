import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/session";

export type ApiError = { code: string; message: string };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

/** Map thrown errors to a safe envelope; log the real error server-side. */
export function handleRouteError(e: unknown) {
  if (e instanceof AuthError) {
    return fail(e.code, e.message, e.code === "unauthenticated" ? 401 : 403);
  }
  if (e instanceof DomainError) return fail(e.code, e.message, e.status);
  console.error("[api] unexpected error", e);
  return fail("internal_error", "Something went wrong on our side. Please try again.", 500);
}

/** An expected, user-facing failure with a stable code. */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
