import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

// Vercel Cron calls with Authorization: Bearer <CRON_SECRET>
function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const MIN_PERCENT = 20;   // only notify when item is at least 20% funded
const COOLDOWN_DAYS = 3;  // don't re-notify the same user+item within 3 days

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

  // Fetch all open items with at least one pledge
  const items = await prisma.wishlistItem.findMany({
    where: {
      status: "open",
      targetPriceCents: { gt: 0 },
      pledges: { some: { status: "active" } },
    },
    include: {
      family: {
        include: {
          memberships: { where: { status: "active" }, select: { userId: true } },
        },
      },
      pledges: {
        where: { status: "active" },
        select: { pledgerUserId: true, amountCents: true },
      },
    },
  });

  let sent = 0;

  for (const item of items) {
    const pledgedCents = item.pledges.reduce((s, p) => s + p.amountCents, 0);
    const percent = Math.round((pledgedCents / item.targetPriceCents) * 100);

    if (percent < MIN_PERCENT) continue;

    const remainingCents = item.targetPriceCents - pledgedCents;
    const pledgerIds = new Set(item.pledges.map((p) => p.pledgerUserId));
    const unpledgedMembers = item.family.memberships
      .map((m) => m.userId)
      .filter((uid) => !pledgerIds.has(uid));

    if (unpledgedMembers.length === 0) continue;

    // Load Steam name for the game
    const cache = await prisma.steamAppCache.findUnique({
      where: { steamAppId: item.steamAppId },
      select: { payload: true },
    });
    const gameName = (cache?.payload as { name?: string } | null)?.name ?? `App #${item.steamAppId}`;

    // Check who was already notified recently for this item
    const recentlyNotified = await prisma.notification.findMany({
      where: {
        recipientUserId: { in: unpledgedMembers },
        type: "OPPORTUNITY",
        createdAt: { gte: cooldownDate },
        payload: { path: ["itemId"], equals: item.id },
      },
      select: { recipientUserId: true },
    });
    const recentIds = new Set(recentlyNotified.map((n) => n.recipientUserId));

    const targets = unpledgedMembers.filter((uid) => !recentIds.has(uid));
    if (targets.length === 0) continue;

    const payload = {
      itemId: item.id,
      familyId: item.familyId,
      familyName: item.family.name,
      gameName,
      pledgerCount: String(pledgerIds.size),
      remainingFormatted: formatCurrency(remainingCents, item.currency),
      remainingPercent: String(100 - percent),
    };

    await prisma.notification.createMany({
      data: targets.map((uid) => ({
        recipientUserId: uid,
        type: "OPPORTUNITY" as const,
        payload,
      })),
    });

    sent += targets.length;
  }

  return NextResponse.json({ ok: true, sent });
}
