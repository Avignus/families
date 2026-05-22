import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const [owned, equipped] = await Promise.all([
    prisma.userCosmetic.findMany({
      where: { userId: user.id },
      include: { cosmetic: true },
      orderBy: { unlockedAt: "desc" },
    }),
    prisma.equippedCosmetics.findUnique({
      where: { userId: user.id },
      include: {
        avatarFrame: true,
        profileBg: true,
        nameTag: true,
        cardEffect: true,
      },
    }),
  ]);

  return ok({
    owned: owned.map((uc) => ({ ...uc.cosmetic, source: uc.source, unlockedAt: uc.unlockedAt })),
    equipped: {
      avatarFrame: equipped?.avatarFrame ?? null,
      profileBg: equipped?.profileBg ?? null,
      nameTag: equipped?.nameTag ?? null,
      cardEffect: equipped?.cardEffect ?? null,
    },
  });
}
