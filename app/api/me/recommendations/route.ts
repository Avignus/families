import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const recs = await prisma.gameRecommendation.findMany({
    where: { userId: user.id, type: "individual" },
    orderBy: [{ generatedAt: "desc" }, { rank: "asc" }],
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
