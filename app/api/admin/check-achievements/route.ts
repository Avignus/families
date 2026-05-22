import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { checkAchievements } from "@/lib/achievements";

export const dynamic = "force-dynamic";

// Runs the full achievement check for all triggers on a specific user.
// Protected by RESET_TEMP_SECRET. Dev/debug only — not a security boundary.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { steamId, userId: bodyUserId } = await req.json().catch(() => ({}));

  let userId = bodyUserId as string | undefined;

  if (!userId && steamId) {
    const user = await prisma.user.findUnique({
      where: { steamId: String(steamId) },
      select: { id: true },
    });
    userId = user?.id;
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId or steamId required" }, { status: 400 });
  }

  const before = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
  });

  // Fire all trigger types so every condition is evaluated
  const triggers = [
    { type: "pledge_paid" as const, pledgeId: "admin-check" },
    { type: "wishlist_added" as const, itemId: "admin-check" },
    { type: "family_created" as const, familyId: "admin-check" },
    { type: "membership_active" as const, familyId: "admin-check" },
    { type: "pix_paid_at_night" as const },
    { type: "spot_bought" as const },
  ];

  for (const trigger of triggers) {
    await checkAchievements(userId, trigger).catch((e) =>
      console.error(`[admin-check-achievements] trigger ${trigger.type}:`, e)
    );
  }

  const after = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });

  const newlyUnlocked = after.filter(
    (a) => !before.some((b) => b.achievementId === a.achievementId)
  );

  return NextResponse.json({
    ok: true,
    userId,
    before: before.length,
    after: after.length,
    newlyUnlocked: newlyUnlocked.map((u) => ({
      slug: u.achievement.slug,
      title: u.achievement.title,
      rarity: u.achievement.rarity,
    })),
    allUnlocked: after.map((u) => u.achievement.slug),
  });
}
