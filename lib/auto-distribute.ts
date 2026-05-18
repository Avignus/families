import { prisma } from "@/lib/prisma";
import { debitWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";
import { maybeDisburseFunds } from "@/lib/disbursement";

const MIN_PLEDGE_CENTS = 100;

/**
 * Distributes up to `budgetCents` from the user's wallet to open wishlist items
 * in their active family, prioritising items closest to funded.
 * Pledges are created and immediately marked as paid (debited from wallet).
 *
 * Returns the total cents actually distributed.
 */
export async function autoDistributeCredits(userId: string, budgetCents: number): Promise<number> {
  if (budgetCents < MIN_PLEDGE_CENTS) return 0;

  const membership = await prisma.familyMembership.findFirst({
    where: { userId, status: "active" },
    include: {
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

  if (!membership) return 0;

  const candidates = membership.family.wishlistItems
    .map((item) => {
      const pledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
      const remaining = item.targetPriceCents - pledged;
      const percent = Math.round((pledged / item.targetPriceCents) * 100);
      const alreadyPledged = item.pledges.some((p) => p.pledgerUserId === userId);
      return { item, remaining, percent, alreadyPledged };
    })
    .filter((c) => c.remaining > 0 && !c.alreadyPledged && c.item.ownerUserId !== userId)
    .sort((a, b) => b.percent - a.percent);

  if (candidates.length === 0) return 0;

  const pledgesCreated: Array<{ amountCents: number; gameName: string }> = [];
  let budget = budgetCents;

  for (const { item, remaining } of candidates) {
    if (budget < MIN_PLEDGE_CENTS) break;

    const freshItem = await prisma.wishlistItem.findUnique({
      where: { id: item.id },
      select: { status: true },
    });
    if (freshItem?.status !== "open") continue;

    const allocate = Math.min(budget, remaining);
    if (allocate < MIN_PLEDGE_CENTS) continue;

    await prisma.$transaction(async (tx) => {
      const pledge = await tx.pledge.create({
        data: {
          wishlistItemId: item.id,
          pledgerUserId: userId,
          amountCents: allocate,
          status: "active",
          mpStatus: "approved",
          creditsCentsUsed: allocate,
          paidAt: new Date(),
        },
      });

      await debitWallet(tx, userId, allocate, "auto_distribute", pledge.id);

      const aggregate = await tx.pledge.aggregate({
        where: { wishlistItemId: item.id, status: "active" },
        _sum: { amountCents: true },
      });
      if ((aggregate._sum.amountCents ?? 0) >= item.targetPriceCents) {
        await tx.wishlistItem.update({ where: { id: item.id }, data: { status: "funded" } });
      }

      const cache = await prisma.steamAppCache.findUnique({
        where: { steamAppId: item.steamAppId },
        select: { payload: true },
      });
      const gameName = (cache?.payload as { name?: string } | null)?.name ?? `App #${item.steamAppId}`;
      pledgesCreated.push({ amountCents: allocate, gameName });
    });

    await maybeDisburseFunds(item.id).catch(() => {});
    budget -= allocate;
  }

  if (pledgesCreated.length === 0) return 0;

  const totalDistributed = budgetCents - budget;

  await prisma.$transaction(async (tx) => {
    await createNotification(tx, {
      recipientUserId: userId,
      type: "AUTO_PLEDGED",
      payload: {
        familyId: membership.familyId,
        familyName: membership.family.name,
        pledgeCount: String(pledgesCreated.length),
        totalFormatted: formatCurrency(totalDistributed, membership.family.currency),
        games: pledgesCreated.map((p) => p.gameName).join(", "),
      },
    });
  });

  return totalDistributed;
}
