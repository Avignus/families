import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recommendGamesForFamily, recommendGamesForUser } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_ONDEMAND_LIMIT = 3;

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

async function getQuota(userId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.gameRecommendation.findMany({
    where: { userId, source: "ondemand", generatedAt: { gte: startOfDay } },
    select: { batchId: true },
  });
  const used = new Set(rows.map((r) => r.batchId).filter(Boolean)).size;
  const remaining = Math.max(0, DAILY_ONDEMAND_LIMIT - used);
  const resetsAt = new Date(startOfDay);
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);

  return { used, limit: DAILY_ONDEMAND_LIMIT, remaining, resetsAt };
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

  const recs = await prisma.gameRecommendation.findMany({
    where: { familyId: params.id, type: "family" },
    orderBy: [{ generatedAt: "desc" }, { rank: "asc" }],
  });

  const quota = await getQuota(user.id);
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

  const quota = await getQuota(user.id);
  if (quota.remaining === 0) {
    return err("QUOTA_EXCEEDED", `Limite diário de ${quota.limit} buscas atingido`, 429);
  }

  const batchId = crypto.randomUUID();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { steamId: true },
  });

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

  const [familyRecs, personalRecs] = await Promise.all([
    wishlistNames.length > 0
      ? recommendGamesForFamily(wishlistNames, existingFamilyNames)
      : Promise.resolve([]),
    Array.isArray(library) && library.length > 0
      ? recommendGamesForUser(library, existingPersonalNames)
      : Promise.resolve([]),
  ]);

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
    getQuota(user.id),
  ]);

  return ok({ family: enrichedFamily, personal: enrichedPersonal, quota: newQuota });
}
