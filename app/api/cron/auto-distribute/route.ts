import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/notifications/templates";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";


const MIN_PLEDGE_CENTS = 100; // R$1 minimum per pledge

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) return NextResponse.json({ ok: false }, { status: 401 });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Memberships with budget set and not yet distributed this month
  const memberships = await prisma.familyMembership.findMany({
    where: {
      status: "active",
      monthlyBudgetCents: { gt: 0 },
      OR: [
        { lastAutoDistributedAt: null },
        { lastAutoDistributedAt: { lt: startOfMonth } },
      ],
    },
    include: {
      user: { select: { id: true, personaName: true } },
      family: {
        include: {
          wishlistItems: {
            where: { status: "open", targetPriceCents: { gt: 0 } },
            include: {
              pledges: { where: { status: "active" }, select: { pledgerUserId: true, amountCents: true } },
            },
          },
        },
      },
    },
  });

  const log: Array<{ user: string; family: string; game: string; amountCents: number }> = [];
  let totalDistributed = 0;

  for (const membership of memberships) {
    const userId = membership.userId;
    let budget = membership.monthlyBudgetCents;

    // Items sorted by % funded DESC (closest to complete first)
    // Exclude items owned by this user and already fully pledged
    const candidates = membership.family.wishlistItems
      .map((item) => {
        const pledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
        const remaining = item.targetPriceCents - pledged;
        const percent = Math.round((pledged / item.targetPriceCents) * 100);
        const alreadyPledged = item.pledges.some((p) => p.pledgerUserId === userId);
        return { item, remaining, percent, alreadyPledged };
      })
      .filter((c) => c.remaining > 0 && !c.alreadyPledged && c.item.ownerUserId !== userId)
      .sort((a, b) => b.percent - a.percent || a.remaining - b.remaining);

    if (candidates.length === 0) continue;

    const pledgesCreated: Array<{ itemId: string; amountCents: number; gameName: string }> = [];

    for (const { item, remaining } of candidates) {
      if (budget < MIN_PLEDGE_CENTS) break;
      const allocate = Math.min(budget, remaining);
      if (allocate < MIN_PLEDGE_CENTS) continue;

      // Check item is still open (race condition guard)
      const freshItem = await prisma.wishlistItem.findUnique({
        where: { id: item.id },
        select: { status: true },
      });
      if (freshItem?.status !== "open") continue;

      const pledge = await prisma.pledge.create({
        data: {
          wishlistItemId: item.id,
          pledgerUserId: userId,
          amountCents: allocate,
          status: "active",
          mpStatus: "pending",
        },
      });

      // Check if now funded
      const aggregate = await prisma.pledge.aggregate({
        where: { wishlistItemId: item.id, status: "active" },
        _sum: { amountCents: true },
      });
      const newTotal = aggregate._sum.amountCents ?? 0;
      if (newTotal >= item.targetPriceCents) {
        await prisma.wishlistItem.update({ where: { id: item.id }, data: { status: "funded" } });
      }

      const cache = await prisma.steamAppCache.findUnique({
        where: { steamAppId: item.steamAppId },
        select: { payload: true },
      });
      const gameName = (cache?.payload as { name?: string } | null)?.name ?? `App #${item.steamAppId}`;

      pledgesCreated.push({ itemId: pledge.id, amountCents: allocate, gameName });
      log.push({
        user: membership.user.personaName,
        family: membership.family.name,
        game: gameName,
        amountCents: allocate,
      });
      budget -= allocate;
      totalDistributed++;
    }

    if (pledgesCreated.length === 0) continue;

    const totalAllocated = pledgesCreated.reduce((s, p) => s + p.amountCents, 0);

    // Update lastAutoDistributedAt
    await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { lastAutoDistributedAt: new Date() },
    });

    // Notify user
    await prisma.$transaction(async (tx) => {
      await createNotification(tx, {
        recipientUserId: userId,
        type: "AUTO_PLEDGED",
        payload: {
          familyId: membership.familyId,
          familyName: membership.family.name,
          pledgeCount: String(pledgesCreated.length),
          totalFormatted: formatCurrency(totalAllocated, membership.family.currency),
          games: pledgesCreated.map((p) => p.gameName).join(", "),
        },
      });
    });
  }

  return NextResponse.json({ ok: true, distributed: totalDistributed, log });
}
