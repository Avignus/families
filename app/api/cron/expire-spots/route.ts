import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

const WARN_DAYS = [7, 3, 1];


export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) return NextResponse.json({ ok: false }, { status: 401 });

  const now = new Date();

  // 1. Expire memberships past their lease end
  const expired = await prisma.familyMembership.findMany({
    where: { status: "active", spotExpiresAt: { lte: now } },
    include: { family: { select: { id: true, name: true } } },
  });

  const expiredResults: string[] = [];
  for (const m of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.familyMembership.update({
        where: { id: m.id },
        data: { status: "removed" },
      });
      await createNotification(tx, {
        recipientUserId: m.userId,
        type: "SPOT_EXPIRED",
        payload: { familyId: m.family.id, familyName: m.family.name },
      });
    });
    expiredResults.push(m.id);
  }

  // 2. Warn members whose spot expires in WARN_DAYS days
  const warnResults: Array<{ membershipId: string; daysLeft: number }> = [];
  for (const daysLeft of WARN_DAYS) {
    const windowStart = new Date(now.getTime() + daysLeft * 86_400_000);
    const windowEnd = new Date(windowStart.getTime() + 86_400_000);

    const expiringSoon = await prisma.familyMembership.findMany({
      where: {
        status: "active",
        spotExpiresAt: { gte: windowStart, lt: windowEnd },
      },
      include: { family: { select: { id: true, name: true } } },
    });

    for (const m of expiringSoon) {
      await createNotification(prisma, {
        recipientUserId: m.userId,
        type: "SPOT_EXPIRING_SOON",
        payload: { familyId: m.family.id, familyName: m.family.name, daysLeft: String(daysLeft) },
      });
      warnResults.push({ membershipId: m.id, daysLeft });
    }
  }

  return NextResponse.json({
    ok: true,
    expired: expiredResults.length,
    warned: warnResults.length,
    details: { expired: expiredResults, warned: warnResults },
  });
}
