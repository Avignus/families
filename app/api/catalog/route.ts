import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { catalogLimiter, isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (await isRateLimited(catalogLimiter, `catalog:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getServerSession(authOptions);
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("q") ?? "").slice(0, 100);
  const freeOnly = searchParams.get("free") === "1";

  const families = await prisma.family.findMany({
    where: {
      isPublic: true,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(freeOnly ? { entryFeeCents: 0, spotPricingEnabled: false } : {}),
    },
    select: {
      id: true, name: true, description: true, currency: true, isPublic: true,
      entryFeeCents: true, maxMembers: true, spotPricingEnabled: true,
      chief: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
      _count: { select: { memberships: { where: { status: "active" } } } },
      wishlistItems: {
        where: { status: { not: "cancelled" } },
        select: { steamAppId: true },
        take: 4,
        orderBy: { createdAt: "desc" },
      },
      memberships: currentUserId
        ? { where: { userId: currentUserId }, select: { status: true } }
        : undefined,
    },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    families.map(async (f) => {
      const memberCount = f._count.memberships;
      const spotsLeft = f.maxMembers ? f.maxMembers - memberCount : null;
      const isFull = f.maxMembers ? memberCount >= f.maxMembers : false;

      const gameCovers = await Promise.all(
        f.wishlistItems.slice(0, 4).map((item) =>
          getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
        )
      );

      const myMembership = currentUserId && Array.isArray(f.memberships) && f.memberships.length > 0
        ? f.memberships[0]
        : null;

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        currency: f.currency,
        entryFeeCents: f.entryFeeCents,
        spotPricingEnabled: f.spotPricingEnabled,
        maxMembers: f.maxMembers,
        memberCount,
        spotsLeft,
        isFull,
        chief: f.chief,
        gameCovers: gameCovers.filter(Boolean),
        myStatus: myMembership?.status ?? null,
      };
    })
  );

  return NextResponse.json({ data: results });
}
