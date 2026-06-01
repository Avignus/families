import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FamilyPageClient } from "@/components/family/family-page-client";
import { FamilyGuestView } from "@/components/family/family-guest-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  { params, searchParams }: { params: { id: string }; searchParams?: Record<string, string | string[] | undefined> }
): Promise<Metadata> {
  const family = await prisma.family.findUnique({
    where: { id: params.id },
    select: { name: true, description: true },
  });

  const pledgeId = typeof searchParams?.pledge === "string" ? searchParams.pledge : null;
  const pct = typeof searchParams?.pct === "string" ? Number(searchParams.pct) : 50;

  if (pledgeId) {
    const item = await prisma.wishlistItem.findUnique({
      where: { id: pledgeId },
      select: { steamAppId: true, owner: { select: { personaName: true } } },
    });

    if (item) {
      const cache = await prisma.steamAppCache.findUnique({ where: { steamAppId: item.steamAppId } });
      const steamData = cache?.payload as { name?: string; headerImage?: string } | null;
      const gameName = steamData?.name ?? `App #${item.steamAppId}`;
      const ownerName = item.owner?.personaName ?? "Alguém";
      const ogImage = steamData?.headerImage
        ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.steamAppId}/header.jpg`;

      const shareTitle = `${ownerName} quer sua ajuda para comprar ${gameName}!`;
      const shareDesc = `Contribua com ${pct}% do valor de ${gameName} na Steam. Junte-se à família ${family?.name ?? ""} no Families!`;

      return {
        title: `${shareTitle} — Families`,
        description: shareDesc,
        openGraph: {
          type: "website",
          url: `${process.env.APP_BASE_URL ?? ""}/families/${params.id}?pledge=${pledgeId}&pct=${pct}`,
          title: shareTitle,
          description: shareDesc,
          images: [{ url: ogImage, width: 460, height: 215 }],
        },
        twitter: {
          card: "summary_large_image",
          title: shareTitle,
          description: shareDesc,
          images: [ogImage],
        },
      };
    }
  }

  const title = family ? `${family.name} — Families` : "Families — Steam Gift Pooling";
  const description = family?.description ?? "Ganhe dinheiro compartilhando seus jogos";

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: `${process.env.APP_BASE_URL ?? ""}/families/${params.id}`,
      title,
      description,
      images: [{ url: "/images/thumb-sharing-image.jpg", width: 1200, height: 630, type: "image/jpeg" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/thumb-sharing-image.jpg"],
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
