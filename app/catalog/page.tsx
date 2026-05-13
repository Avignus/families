import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { CatalogClient } from "@/components/catalog/catalog-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const q = searchParams.q?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const skip = (page - 1) * PAGE_SIZE;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { id: q },
        ],
      }
    : {};

  const [families, total] = await Promise.all([
    prisma.family.findMany({
      where,
      include: {
        chief: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true } },
        _count: { select: { memberships: { where: { status: "active" } } } },
        wishlistItems: {
          where: { status: { not: "cancelled" } },
          select: { steamAppId: true },
          take: 4,
          orderBy: { createdAt: "desc" },
        },
        ...(currentUserId
          ? { memberships: { where: { userId: currentUserId }, select: { status: true } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.family.count({ where }),
  ]);

  const items = await Promise.all(
    families.map(async (f) => {
      const memberCount = f._count.memberships;
      const covers = await Promise.all(
        f.wishlistItems.map((item) =>
          getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
        )
      );
      const myMembership =
        currentUserId && "memberships" in f && Array.isArray((f as any).memberships) && (f as any).memberships.length
          ? (f as any).memberships[0]
          : null;

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        currency: f.currency,
        isPublic: f.isPublic,
        entryFeeCents: f.entryFeeCents,
        maxMembers: f.maxMembers,
        memberCount,
        spotsLeft: f.maxMembers ? f.maxMembers - memberCount : null,
        isFull: f.maxMembers ? memberCount >= f.maxMembers : false,
        chief: f.chief,
        gameCovers: covers.filter((c): c is string => Boolean(c)),
        myStatus: myMembership?.status ?? null,
      };
    })
  );

  return (
    <CatalogClient
      families={items}
      isLoggedIn={!!currentUserId}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      query={q}
    />
  );
}
