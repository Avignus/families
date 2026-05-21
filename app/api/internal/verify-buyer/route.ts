import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api";

export const dynamic = "force-dynamic";

function requireBotSecret(req: NextRequest): boolean {
  const secret = process.env.BOT_API_SECRET;
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  try {
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!requireBotSecret(req)) {
    return err("UNAUTHORIZED", "Invalid or missing bot secret", 401);
  }

  const steamId = req.nextUrl.searchParams.get("steamId");
  if (!steamId) return err("VALIDATION_ERROR", "steamId is required", 422);

  const user = await prisma.user.findUnique({
    where: { steamId },
    select: {
      steamId: true,
      personaName: true,
      memberships: {
        where: { status: "active" },
        select: { family: { select: { name: true } } },
      },
    },
  });

  if (!user) {
    return ok({ isBuyer: false, steamId, personaName: null, familyName: null });
  }

  const activeMembership = user.memberships[0];

  return ok({
    isBuyer: activeMembership !== undefined,
    steamId: user.steamId,
    personaName: user.personaName,
    familyName: activeMembership?.family.name ?? null,
  });
}
