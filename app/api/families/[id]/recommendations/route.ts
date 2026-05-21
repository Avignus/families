import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member of this family", 403);
  }

  const recs = await prisma.gameRecommendation.findMany({
    where: { familyId: params.id, type: "family" },
    orderBy: { rank: "asc" },
  });

  const appIds = recs.map((r) => r.steamAppId);
  const caches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: appIds } },
    select: { steamAppId: true, payload: true },
  });
  const steamMap = new Map(caches.map((c) => [c.steamAppId, c.payload]));

  const enriched = recs.map((r) => ({
    ...r,
    steamData: steamMap.get(r.steamAppId) ?? null,
  }));

  return ok(enriched);
}
