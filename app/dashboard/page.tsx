import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import Link from "next/link";
import { Users, AlertTriangle, Gamepad2, Heart, Library, Share2 } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateFamilyDialog } from "@/components/family/create-family-dialog";
import { JoinFamilyDialog } from "@/components/family/join-family-dialog";
import { FamilyCoverArt } from "@/components/family-cover-art";
import { getServerTranslations } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const userId = (session.user as { id?: string }).id ?? "";
  const currentSteamId = (session.user as { steamId?: string }).steamId ?? "";

  const memberships = await prisma.familyMembership.findMany({
    where: { userId, status: "active" },
    include: {
      family: {
        include: {
          _count: {
            select: {
              memberships: { where: { status: "active" } },
              wishlistItems: { where: { status: { not: "cancelled" } } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const totalPendingRequests = await prisma.familyMembership.count({
    where: { family: { chiefId: userId }, status: "pending" },
  });

  const pendingRows = await prisma.familyMembership.groupBy({
    by: ["familyId"],
    where: { family: { chiefId: userId }, status: "pending" },
    _count: { id: true },
  });
  const pendingMap = new Map(pendingRows.map((p) => [p.familyId, p._count.id]));

  const familyIds = memberships.map((m) => m.family.id);

  // Batch-load all active member steamIds across all families
  const allMemberships = await prisma.familyMembership.findMany({
    where: { familyId: { in: familyIds }, status: "active" },
    select: { familyId: true, user: { select: { steamId: true } } },
  });

  // Batch-load all Steam library caches
  const allSteamIds = [...new Set(allMemberships.map((m) => m.user.steamId))];
  const libraryCaches = await prisma.steamUserCache.findMany({
    where: { userId: { in: allSteamIds }, type: "library" },
    select: { userId: true, payload: true },
  });

  const steamLibMap = new Map<string, Set<number>>();
  for (const cache of libraryCaches) {
    const games = cache.payload as Array<{ appId: number }>;
    const ids = new Set<number>();
    if (Array.isArray(games)) games.forEach((g) => ids.add(g.appId));
    steamLibMap.set(cache.userId, ids);
  }

  // Per-family: library appIds + game count
  const familyLibIds = new Map<string, Set<number>>();
  for (const m of allMemberships) {
    const set = familyLibIds.get(m.familyId) ?? new Set<number>();
    steamLibMap.get(m.user.steamId)?.forEach((id) => set.add(id));
    familyLibIds.set(m.familyId, set);
  }

  const libraryCounts = memberships.map((m) => familyLibIds.get(m.family.id)?.size ?? 0);

  // Total accessible games: union of user's own library + all family libraries
  const ownGameIds = steamLibMap.get(currentSteamId) ?? new Set<number>();
  const allAccessibleIds = new Set<number>(ownGameIds);
  for (const ids of familyLibIds.values()) {
    ids.forEach((id) => allAccessibleIds.add(id));
  }
  const totalAccessible = allAccessibleIds.size;
  const ownGames = ownGameIds.size;
  const viaFamilies = totalAccessible - ownGames;
  const { t } = getServerTranslations();

  // Compute covers per family: wishlist first → library fill → client falls back to SVG
  const coversByFamily = await Promise.all(
    memberships.map(async ({ family }) => {
      const wishlistItems = await prisma.wishlistItem.findMany({
        where: { familyId: family.id, status: { not: "cancelled" } },
        select: { steamAppId: true },
        take: 4,
        orderBy: { createdAt: "desc" },
      });
      const wishlistCovers = (
        await Promise.all(
          wishlistItems.map((item) =>
            getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
          )
        )
      ).filter(Boolean) as string[];

      let covers = wishlistCovers;

      if (covers.length < 4) {
        const libIds = familyLibIds.get(family.id);
        if (libIds && libIds.size > 0) {
          const libArr = [...libIds];
          let h = 5381;
          for (let i = 0; i < family.id.length; i++)
            h = (((h << 5) + h) ^ family.id.charCodeAt(i)) >>> 0;
          const offset = h % libArr.length;
          const sampleIds = [
            ...libArr.slice(offset, offset + 200),
            ...libArr.slice(0, Math.max(0, offset + 200 - libArr.length)),
          ].slice(0, 200);
          const wishlistAppIds = new Set(wishlistItems.map((w) => w.steamAppId));
          const cached = await prisma.steamAppCache.findMany({
            where: { steamAppId: { in: sampleIds, notIn: [...wishlistAppIds] } },
            select: { payload: true },
            take: 4 - covers.length,
          });
          const libCovers = cached
            .map((c) => (c.payload as Record<string, unknown>)?.headerImage as string | undefined ?? "")
            .filter(Boolean);
          covers = [...covers, ...libCovers];
        }
      }

      return covers;
    })
  );

  return (
    <div className="container py-8 space-y-6">
      {totalPendingRequests > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: t.dashboard.pendingAlert(totalPendingRequests).replace(String(totalPendingRequests), `<strong>${totalPendingRequests}</strong>`) }} />
        </div>
      )}

      {totalAccessible > 0 && (
        <Card className="border-primary/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row items-stretch">
              {/* Main stat */}
              <div className="flex items-center gap-4 px-6 py-5 flex-1"
                style={{ background: "linear-gradient(135deg, hsl(258 82% 60% / 0.12), hsl(258 82% 60% / 0.04))" }}>
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(258 82% 60% / 0.18)", border: "1px solid hsl(258 82% 60% / 0.3)" }}>
                  <Library className="h-5 w-5" style={{ color: "hsl(258 82% 66%)" }} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                    {totalAccessible.toLocaleString(t.dateLocale)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{t.dashboard.totalGames}</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="flex sm:flex-col justify-around sm:justify-center gap-0 sm:min-w-[180px] border-t sm:border-t-0 sm:border-l border-border/60 px-6 py-4 sm:py-5 bg-card/40">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-semibold">{ownGames.toLocaleString(t.dateLocale)}</span>
                  <span className="text-xs text-muted-foreground">{t.dashboard.yours}</span>
                </div>
                <div className="hidden sm:block h-px bg-border/60 my-2.5" />
                <div className="flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(258 82% 66%)" }} />
                  <span className="text-sm font-semibold" style={{ color: "hsl(258 82% 66%)" }}>
                    {viaFamilies.toLocaleString(t.dateLocale)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.dashboard.viaFamilies}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.dashboard.title}</h1>
        <div className="flex gap-2">
          <JoinFamilyDialog />
          <CreateFamilyDialog />
        </div>
      </div>

      {memberships.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{ background: "hsl(258 82% 60% / 0.12)", border: "1px solid hsl(258 82% 60% / 0.25)" }}>
              <Users className="h-8 w-8" style={{ color: "hsl(258 82% 66%)" }} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-base">{t.dashboard.noFamilies}</p>
              <p className="text-sm text-muted-foreground">
                {t.dashboard.noFamiliesHint}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <JoinFamilyDialog />
              <CreateFamilyDialog />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ family }, i) => {
            const isChief = family.chiefId === userId;
            const libraryCount = libraryCounts[i];
            const wishlistCount = family._count.wishlistItems;
            const pendingCount = pendingMap.get(family.id) ?? 0;
            const gameCovers = coversByFamily[i];
            return (
              <Link key={family.id} href={`/families/${family.id}`}>
                <Card className={`hover:border-primary/50 transition-all cursor-pointer h-full overflow-hidden group ${pendingCount > 0 ? "border-amber-500/40" : ""}`}>
                  {/* Cover art banner */}
                  <div className="relative h-28 overflow-hidden">
                    <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
                      {family.coverImageUrl ? (
                        <img src={family.coverImageUrl} alt={family.name} className="w-full h-full object-cover" />
                      ) : gameCovers.length > 0 ? (
                        <div className="flex h-full">
                          {gameCovers.map((src, j) => (
                            <img key={j} src={src} alt="" className="h-full object-cover flex-1 min-w-0" />
                          ))}
                        </div>
                      ) : (
                        <FamilyCoverArt familyId={family.id} />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 flex items-end justify-between gap-2">
                      <CardTitle className="text-base leading-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {family.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            {t.dashboard.pending(pendingCount)}
                          </span>
                        )}
                        {isChief && (
                          <Badge variant="secondary" className="text-xs">{t.dashboard.chief}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CardContent className="pt-3 pb-4 space-y-1.5">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t.dashboard.members(family._count.memberships)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Gamepad2 className="h-3.5 w-3.5" />
                        {t.dashboard.playable(libraryCount)}
                      </span>
                      {wishlistCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5" />
                          {t.dashboard.wishlist(wishlistCount)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
