import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FamilyPageClient } from "@/components/family/family-page-client";
import { FamilyGuestView } from "@/components/family/family-guest-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { name: true, description: true },
  });

  const title = family ? `${family.name} — Families` : "Families — Steam Gift Pooling";
  const description = family?.description ?? "Una-se com amigos para financiar jogos na lista de desejos da Steam";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/images/thumb-sharing-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/thumb-sharing-image.png"],
    },
  };
}

export default async function FamilyPage({ params }: { params: { id: string } }) {
  const session = await getSession();

  if (!session?.user) {
    const family = await prisma.family.findUnique({
      where: { id: params.id },
      select: { name: true, description: true, coverImageUrl: true },
    });
    return <FamilyGuestView family={family} />;
  }

  const userId = (session.user as { id?: string }).id ?? "";
  const currentSteamId = (session.user as { steamId?: string }).steamId ?? "";
  const familyId = params.id;

  // Compute accessible game stats for the current user across all their families
  const allMemberships = await prisma.familyMembership.findMany({
    where: { familyId, status: "active" },
    select: { user: { select: { steamId: true } } },
  });

  const steamIds = allMemberships.map((m) => m.user.steamId);
  const libraryCaches = await prisma.steamUserCache.findMany({
    where: { userId: { in: steamIds }, type: "library" },
    select: { userId: true, payload: true },
  });

  const steamLibMap = new Map<string, Set<number>>();
  for (const cache of libraryCaches) {
    const games = cache.payload as Array<{ appId: number }>;
    const ids = new Set<number>();
    if (Array.isArray(games)) games.forEach((g) => ids.add(g.appId));
    steamLibMap.set(cache.userId, ids);
  }

  const allAccessibleIds = new Set<number>();
  for (const [, ids] of steamLibMap) ids.forEach((id) => allAccessibleIds.add(id));
  const ownGameIds = steamLibMap.get(currentSteamId) ?? new Set<number>();
  const totalAccessible = allAccessibleIds.size;
  const ownGames = ownGameIds.size;
  const viaFamilies = totalAccessible - ownGames;

  // Sample up to 40 appIds for the mosaic background on the stats card
  const allAccessibleArr = Array.from(allAccessibleIds);
  const mosaicAppIds = allAccessibleArr.length <= 40
    ? allAccessibleArr
    : Array.from({ length: 40 }, (_, i) => allAccessibleArr[Math.floor(i * allAccessibleArr.length / 40)]);

  // Pending join requests (only relevant if user is chief of this family)
  const pendingCount = await prisma.familyMembership.count({
    where: { familyId, family: { chiefId: userId }, status: "pending" },
  });

  // User credits and monthly budget for on-demand distribution button
  const [dbUser, userMembership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { creditsCents: true } }),
    prisma.familyMembership.findFirst({
      where: { userId, familyId, status: "active" },
      select: { monthlyBudgetCents: true, autoDistributeEnabled: true },
    }),
  ]);

  return (
    <FamilyPageClient
      familyId={familyId}
      gameStats={totalAccessible > 0 ? { total: totalAccessible, own: ownGames, viaFamilies } : null}
      mosaicAppIds={mosaicAppIds}
      totalPendingRequests={pendingCount}
      creditsCents={dbUser?.creditsCents ?? 0}
      monthlyBudgetCents={userMembership?.monthlyBudgetCents ?? 0}
      autoDistributeEnabled={userMembership?.autoDistributeEnabled ?? false}
    />
  );
}
