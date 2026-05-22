import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recommendGamesForFamily, recommendGamesForUser } from "@/lib/gemini";
import { getTier, TIER_WEEKLY_ONDEMAND_LIMIT } from "@/lib/reputation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveAppId(aiName: string, aiAppId: number): Promise<number> {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
  const normTarget = normalize(aiName);
  const searchTerm = aiName.replace(/[®™©]/g, "").split(":")[0].trim();

  for (const term of [searchTerm, searchTerm.split(" ").slice(0, 3).join(" ")]) {
    const rows = await prisma.steamAppCatalog.findMany({
      where: { name: { contains: term, mode: "insensitive" } },
      take: 10,
    });
    const exact = rows.find((r) => normalize(r.name) === normTarget);
    if (exact) return exact.appId;
    const words = normTarget.split(" ").filter((w) => w.length > 3);
    const close = rows.find((r) => words.every((w) => normalize(r.name).includes(w)));
    if (close) return close.appId;
  }

  try {
    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(searchTerm)}&l=english&cc=BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      const items: Array<{ id: number; name: string }> = data?.items ?? [];
      const exact = items.find((i) => normalize(i.name) === normTarget);
      if (exact) return exact.id;
      if (items[0] && normalize(items[0].name).includes(searchTerm.split(" ")[0].toLowerCase())) {
        return items[0].id;
      }
    }
  } catch { /* non-fatal */ }

  return aiAppId;
}

async function getQuota(userId: string, reputationScore: number) {
  const tier = getTier(reputationScore);
  // Dev override: RECOMMENDATION_DAILY_LIMIT env var bypasses tier limits
  const limit = process.env.RECOMMENDATION_DAILY_LIMIT
    ? parseInt(process.env.RECOMMENDATION_DAILY_LIMIT, 10)
    : TIER_WEEKLY_ONDEMAND_LIMIT[tier];

  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await prisma.gameRecommendation.findMany({
    where: { userId, source: "ondemand", generatedAt: { gte: windowStart } },
    select: { batchId: true, generatedAt: true },
  });

  const batches = rows.filter((r) => r.batchId);
  const used = new Set(batches.map((r) => r.batchId)).size;
  const remaining = Math.max(0, limit - used);

  // Earliest batch in window expires first → that's when a slot frees up
  const earliest = batches.reduce<Date | null>(
    (min, r) => (!min || r.generatedAt < min ? r.generatedAt : min),
    null
  );
  const resetsAt = earliest
    ? new Date(earliest.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  return { used, limit, remaining, tier, resetsAt };
}

async function enrichRecs(recs: Array<{ steamAppId: number } & Record<string, unknown>>) {
  if (recs.length === 0) return [];
  const appIds = recs.map((r) => r.steamAppId);
  const caches = await prisma.steamAppCache.findMany({
    where: { steamAppId: { in: appIds } },
    select: { steamAppId: true, payload: true },
  });
  const steamMap = new Map(caches.map((c) => [c.steamAppId, c.payload]));
  return recs.map((r) => ({ ...r, steamData: steamMap.get(r.steamAppId) ?? null }));
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member of this family", 403);
  }

  const [recs, dbUser] = await Promise.all([
    prisma.gameRecommendation.findMany({
      where: { familyId: params.id, type: "family" },
      orderBy: [{ generatedAt: "desc" }, { rank: "asc" }],
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { reputationScore: true } }),
  ]);

  const quota = await getQuota(user.id, dbUser?.reputationScore ?? 0);
  return ok({ recs: await enrichRecs(recs), quota });
}

type OwnedGame = { appId: number; name: string; playtimeMinutes: number };

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  if (!process.env.GOOGLE_API_KEY) {
    return err("AI_UNAVAILABLE", "Serviço de recomendações indisponível", 503);
  }

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Not an active member", 403);
  }

  const batchId = crypto.randomUUID();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { steamId: true, reputationScore: true },
  });

  const quota = await getQuota(user.id, dbUser?.reputationScore ?? 0);
  if (quota.remaining === 0) {
    return err("QUOTA_EXCEEDED", `Limite semanal de ${quota.limit} buscas atingido para o elo ${quota.tier}`, 429);
  }

  const [existingFamily, existingPersonal, userLibCache, family] = await Promise.all([
    prisma.gameRecommendation.findMany({
      where: { familyId: params.id, type: "family" },
      select: { gameName: true },
    }),
    prisma.gameRecommendation.findMany({
      where: { userId: user.id, type: "individual" },
      select: { gameName: true },
    }),
    dbUser?.steamId
      ? prisma.steamUserCache.findUnique({
          where: { userId_type: { userId: dbUser.steamId, type: "library" } },
          select: { payload: true },
        })
      : null,
    prisma.family.findUnique({
      where: { id: params.id },
      include: {
        wishlistItems: {
          where: { status: { not: "cancelled" } },
          select: { steamAppId: true },
        },
      },
    }),
  ]);

  const existingFamilyNames = existingFamily.map((r) => r.gameName);
  const existingPersonalNames = existingPersonal.map((r) => r.gameName);
  const library = (userLibCache?.payload as unknown as OwnedGame[]) ?? [];

  const wishlistAppIds = family?.wishlistItems.map((i) => i.steamAppId) ?? [];
  const wishlistCaches = wishlistAppIds.length > 0
    ? await prisma.steamAppCache.findMany({
        where: { steamAppId: { in: wishlistAppIds } },
        select: { payload: true },
      })
    : [];
  const wishlistNames = wishlistCaches
    .map((c) => (c.payload as { name?: string })?.name)
    .filter(Boolean) as string[];

  let familyRecs: Awaited<ReturnType<typeof recommendGamesForFamily>> = [];
  let personalRecs: Awaited<ReturnType<typeof recommendGamesForUser>> = [];

  try {
    [familyRecs, personalRecs] = await Promise.all([
      wishlistNames.length > 0
        ? recommendGamesForFamily(wishlistNames, existingFamilyNames)
        : Promise.resolve([]),
      Array.isArray(library) && library.length > 0
        ? recommendGamesForUser(library, existingPersonalNames)
        : Promise.resolve([]),
    ]);
  } catch (e) {
    console.error("[recommendations] Gemini error:", e);
    return err("AI_ERROR", "Erro ao gerar recomendações. Tente novamente.", 502);
  }

  const now = new Date();

  const [familyData, personalData] = await Promise.all([
    Promise.all(familyRecs.map(async (rec, i) => ({
      familyId: params.id,
      userId: user.id,
      type: "family",
      source: "ondemand",
      batchId,
      steamAppId: await resolveAppId(rec.name, rec.steamAppId),
      gameName: rec.name,
      reason: rec.reason,
      rank: i + 1,
      generatedAt: now,
    }))),
    Promise.all(personalRecs.map(async (rec, i) => ({
      userId: user.id,
      type: "individual",
      source: "ondemand",
      batchId,
      steamAppId: await resolveAppId(rec.name, rec.steamAppId),
      gameName: rec.name,
      reason: rec.reason,
      rank: i + 1,
      generatedAt: now,
    }))),
  ]);

  await prisma.gameRecommendation.createMany({
    data: [...familyData, ...personalData],
    skipDuplicates: true,
  });

  const [enrichedFamily, enrichedPersonal, newQuota] = await Promise.all([
    enrichRecs(familyData),
    enrichRecs(personalData),
    getQuota(user.id, dbUser?.reputationScore ?? 0),
  ]);

  return ok({ family: enrichedFamily, personal: enrichedPersonal, quota: newQuota });
}
