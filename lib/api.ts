import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { ZodSchema } from "zod";
import { timingSafeEqual } from "crypto";

export type ApiUser = {
  id: string;
  steamId: string;
  personaName: string;
  avatarUrl: string;
  avatarMedium: string;
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireSession(): Promise<ApiUser | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return err("UNAUTHORIZED", "Authentication required", 401);
  }
  const u = session.user as ApiUser & { id?: string };
  return {
    id: u.id ?? "",
    steamId: u.steamId,
    personaName: u.personaName,
    avatarUrl: u.avatarUrl,
    avatarMedium: u.avatarMedium,
  };
}

export function isApiError(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

/**
 * Timing-safe bearer token check for cron/admin routes.
 * Prevents secret enumeration via response-time side channel.
 * Pass requireVercelCron=true for endpoints that must only run via Vercel Cron scheduler.
 */
export function isCronAuthorized(req: NextRequest, secret: string | undefined, requireVercelCron = false): boolean {
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  let valid = false;
  try {
    const a = Buffer.from(auth.padEnd(expected.length, "\0"));
    const b = Buffer.from(expected.padEnd(auth.length, "\0"));
    valid = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
  if (!valid) return false;
  if (requireVercelCron && process.env.NODE_ENV === "production" && !req.headers.get("x-vercel-cron")) return false;
  return true;
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T | NextResponse> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return err("VALIDATION_ERROR", result.error.errors.map((e) => e.message).join("; "), 422);
    }
    return result.data;
  } catch {
    return err("INVALID_JSON", "Request body must be valid JSON", 400);
  }
}
