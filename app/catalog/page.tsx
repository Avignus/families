import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { CatalogClient } from "@/components/catalog/catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await getSession();
  const currentUserId = (session?.user as { id?: string })?.id ?? null;

  const families = await prisma.family.findMany({
    where: { isPublic: true },
    include: {
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

  const items = await Promise.all(
    families.map(async (f) => {
      const memberCount = f._count.memberships;
      const covers = await Promise.all(
        f.wishlistItems.map((item) =>
          getAppDetails(item.steamAppId).then((d) => d?.headerImage ?? null)
        )
      );
      const myMembership = currentUserId && f.memberships?.length ? f.memberships[0] : null;
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        currency: f.currency,
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

  return <CatalogClient families={items} isLoggedIn={!!currentUserId} />;
}
