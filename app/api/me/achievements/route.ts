import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId: user.id },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });

  const allAchievements = await prisma.achievement.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

  return ok({
    unlocked: userAchievements.map((ua) => ({
      ...ua.achievement,
      unlockedAt: ua.unlockedAt,
    })),
    locked: allAchievements.filter((a) => !unlockedIds.has(a.id)),
    total: allAchievements.length,
    unlockedCount: userAchievements.length,
  });
}
