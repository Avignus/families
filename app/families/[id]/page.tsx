import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FamilyPageClient } from "@/components/family/family-page-client";

export const dynamic = "force-dynamic";

export default async function FamilyPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) redirect("/");

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
      totalPendingRequests={pendingCount}
      creditsCents={dbUser?.creditsCents ?? 0}
      monthlyBudgetCents={userMembership?.monthlyBudgetCents ?? 0}
      autoDistributeEnabled={userMembership?.autoDistributeEnabled ?? false}
    />
  );
}
