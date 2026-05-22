import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Grants every cosmetic and achievement to a user for visual testing.
// TEMPORARY — remove after testing.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.RESET_TEMP_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { steamId } = await req.json().catch(() => ({}));
  const user = steamId
    ? await prisma.user.findUnique({ where: { steamId: String(steamId) }, select: { id: true } })
    : null;
  if (!user) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

  const [allCosmetics, allAchievements] = await Promise.all([
    prisma.cosmetic.findMany(),
    prisma.achievement.findMany(),
  ]);

  await prisma.$transaction([
    // Grant all cosmetics
    ...allCosmetics.map((c) =>
      prisma.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId: user.id, cosmeticId: c.id } },
        update: {},
        create: { userId: user.id, cosmeticId: c.id, source: "admin-unlock" },
      })
    ),
    // Grant all achievements
    ...allAchievements.map((a) =>
      prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: user.id, achievementId: a.id } },
        update: {},
        create: { userId: user.id, achievementId: a.id },
      })
    ),
  ]);

  return NextResponse.json({
    ok: true,
    cosmeticsGranted: allCosmetics.length,
    achievementsGranted: allAchievements.length,
  });
}
