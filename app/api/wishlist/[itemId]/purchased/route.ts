import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";
import { formatCurrency } from "@/lib/notifications/templates";

function getSurplusFeeBps(): number {
  const bps = parseInt(process.env.PLATFORM_SURPLUS_FEE_BPS ?? "1000", 10);
  return isNaN(bps) || bps < 0 || bps > 10000 ? 1000 : bps;
}

export async function POST(_req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return err("UNAUTHORIZED", "Unauthorized", 401);

  const item = await prisma.wishlistItem.findUnique({
    where: { id: params.itemId },
    include: {
      family: true,
      pledges: {
        where: { status: "active" },
        select: { id: true, pledgerUserId: true, amountCents: true, paidAt: true },
      },
    },
  });

  if (!item) return err("NOT_FOUND", "Wishlist item not found", 404);

  const isOwner = item.ownerUserId === user.id;
  const isChief = item.family.chiefId === user.id;
  if (!isOwner && !isChief) {
    return err("FORBIDDEN", "Only the item owner or family chief can mark as purchased", 403);
  }

  if (item.status === "purchased") return err("ALREADY_PURCHASED", "Item is already marked as purchased");

  const steamData = await getAppDetails(item.steamAppId);
  const gameName = steamData?.name ?? `App #${item.steamAppId}`;
  const currency = item.currency;
  const familyId = item.familyId;
  const familyName = item.family.name;

  // Cashback: compare total paid pledges vs current target price
  // Surplus can exist if price dropped intraday (between cron runs)
  const paidPledges = item.pledges.filter((p) => p.paidAt !== null);
  const totalPaidCents = paidPledges.reduce((s, p) => s + p.amountCents, 0);
  const effectivePrice = Math.min(
    item.targetPriceCents,
    steamData && steamData.priceCents > 0 ? steamData.priceCents : item.targetPriceCents
  );
  const rawSurplus = Math.max(0, totalPaidCents - effectivePrice);
  const feeBps = getSurplusFeeBps();
  const platformFee = rawSurplus > 0 ? Math.floor(rawSurplus * feeBps / 10000) : 0;
  const distributableSurplus = rawSurplus - platformFee;

  const pledgerIds = [...new Set(item.pledges.map((p) => p.pledgerUserId))];

  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.update({
      where: { id: params.itemId },
      data: { status: "purchased" },
    });

    await tx.pledge.updateMany({
      where: { wishlistItemId: params.itemId, status: "active" },
      data: { status: "settled" },
    });

    // Distribute surplus as cashback to paid pledgers (proportional to their paid amount)
    if (distributableSurplus > 0 && totalPaidCents > 0) {
      let distributed = 0;
      for (const pledge of paidPledges) {
        const share = Math.floor(distributableSurplus * pledge.amountCents / totalPaidCents);
        distributed += share;
        if (share > 0) {
          await creditWallet(tx, pledge.pledgerUserId, share, "price_dropped", item.id);
        }
      }
      // Rounding remainder → platform
      const remainder = distributableSurplus - distributed;
      if (remainder > 0) {
        await tx.platformRevenue.create({
          data: {
            amountCents: remainder,
            reason: "surplus_fee",
            metadata: { itemId: item.id, gameName, note: "rounding_remainder_on_purchase" },
          },
        });
      }
      if (platformFee > 0) {
        await tx.platformRevenue.create({
          data: {
            amountCents: platformFee,
            reason: "surplus_fee",
            metadata: { itemId: item.id, gameName, effectivePrice, rawSurplus, feeBps },
          },
        });
      }
    }

    // Notify all pledgers + owner
    const notifyIds = new Set([...pledgerIds]);
    if (item.ownerUserId && item.ownerUserId !== user.id) notifyIds.add(item.ownerUserId);

    for (const recipientId of notifyIds) {
      const cashback = distributableSurplus > 0
        ? paidPledges.find((p) => p.pledgerUserId === recipientId)
          ? Math.floor(distributableSurplus * (paidPledges.find((p) => p.pledgerUserId === recipientId)!.amountCents) / totalPaidCents)
          : 0
        : 0;

      await createNotification(tx, {
        recipientUserId: recipientId,
        type: "ITEM_PURCHASED",
        payload: {
          itemId: params.itemId,
          familyId,
          familyName,
          ownerUserId: item.ownerUserId,
          gameName,
          currency,
          ...(cashback > 0 ? { cashbackFormatted: formatCurrency(cashback, currency) } : {}),
        },
      });
    }
  });

  return ok({ message: "Item marked as purchased", surplus: rawSurplus, cashback: distributableSurplus });
}
