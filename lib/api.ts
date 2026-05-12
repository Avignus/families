import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { ZodSchema } from "zod";

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
