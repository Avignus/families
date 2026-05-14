import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

// Minimum relative price change to trigger a sync (2%)
const THRESHOLD = 0.02;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const items = await prisma.wishlistItem.findMany({
    where: { status: { in: ["open", "funded"] } },
    include: {
      family: { select: { id: true, name: true, currency: true } },
      pledges: {
        where: { status: "active" },
        select: { id: true, pledgerUserId: true, amountCents: true, paidAt: true },
      },
    },
  });

  const log: string[] = [];

  for (const item of items) {
    const steamData = await getAppDetails(item.steamAppId);
    if (!steamData) continue;

    const oldPrice = item.targetPriceCents;
    const newPrice = steamData.priceCents;
    const currency = item.family.currency;
    const gameName = steamData.name;
    const familyId = item.family.id;
    const familyName = item.family.name;

    const totalPledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);

    // ── Game went free ──────────────────────────────────────────────────────
    if (steamData.isFree && oldPrice > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({ where: { id: item.id }, data: { status: "cancelled" } });

        for (const pledge of item.pledges) {
          const refundAmount = pledge.paidAt ? pledge.amountCents : 0;
          await tx.pledge.update({ where: { id: pledge.id }, data: { status: "withdrawn" } });
          if (refundAmount > 0) {
            await creditWallet(tx, pledge.pledgerUserId, refundAmount, "item_cancelled", pledge.id);
          }
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "ITEM_GONE_FREE",
            payload: {
              gameName,
              familyId,
              familyName,
              refundFormatted: refundAmount > 0 ? formatCurrency(refundAmount, currency) : "",
            },
          });
        }

        if (item.ownerUserId) {
          await createNotification(tx, {
            recipientUserId: item.ownerUserId,
            type: "ITEM_GONE_FREE",
            payload: { gameName, familyId, familyName, refundFormatted: "" },
          });
        }
      });

      log.push(`[FREE] ${gameName} → cancelled, ${item.pledges.length} pledges refunded`);
      continue;
    }

    // Skip free games with no price change and items without pledges
    if (!newPrice || newPrice === oldPrice) continue;

    const delta = Math.abs(newPrice - oldPrice) / oldPrice;
    if (delta < THRESHOLD) continue;

    // ── Price dropped ───────────────────────────────────────────────────────
    if (newPrice < oldPrice) {
      const surplus = Math.max(0, totalPledged - newPrice);
      const wasOpen = item.status === "open";
      const nowFunded = totalPledged >= newPrice;

      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: {
            targetPriceCents: newPrice,
            status: nowFunded && wasOpen ? "funded" : item.status,
          },
        });

        // Credit surplus proportionally to pledgers
        let distributed = 0;
        for (const pledge of item.pledges) {
          const pledgerSurplus = surplus > 0
            ? Math.floor(surplus * pledge.amountCents / totalPledged)
            : 0;
          distributed += pledgerSurplus;
          if (pledgerSurplus > 0) {
            await creditWallet(tx, pledge.pledgerUserId, pledgerSurplus, "price_dropped", item.id);
          }
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "PRICE_DROPPED",
            payload: {
              gameName, familyId, familyName,
              newPriceFormatted: formatCurrency(newPrice, currency),
              surplusCents: pledgerSurplus,
              surplusFormatted: pledgerSurplus > 0 ? formatCurrency(pledgerSurplus, currency) : "",
            },
          });
        }

        // Any rounding remainder goes to the item owner
        const remainder = surplus - distributed;
        if (remainder > 0 && item.ownerUserId) {
          await creditWallet(tx, item.ownerUserId, remainder, "price_dropped", item.id);
        }

        // Notify owner if not already notified as a pledger
        if (item.ownerUserId && !item.pledges.some(p => p.pledgerUserId === item.ownerUserId)) {
          await createNotification(tx, {
            recipientUserId: item.ownerUserId,
            type: "PRICE_DROPPED",
            payload: {
              gameName, familyId, familyName,
              newPriceFormatted: formatCurrency(newPrice, currency),
              surplusCents: 0,
              surplusFormatted: "",
            },
          });
        }

        // Auto-fund if now covered and was open
        if (nowFunded && wasOpen && item.ownerUserId) {
          await createNotification(tx, {
            recipientUserId: item.ownerUserId,
            type: "ITEM_FUNDED",
            payload: { gameName, familyId, familyName: item.family.name, ownerUserId: item.ownerUserId ?? "", itemId: item.id },
          });
        }
      });

      log.push(`[DROP] ${gameName}: ${oldPrice}→${newPrice}, surplus ${surplus} distributed`);
    }

    // ── Price increased ─────────────────────────────────────────────────────
    else {
      const wasFunded = item.status === "funded";
      const reverted = wasFunded && totalPledged < newPrice;
      const missing = newPrice - totalPledged;

      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: {
            targetPriceCents: newPrice,
            status: reverted ? "open" : item.status,
          },
        });

        const notifyUserIds = new Set<string>();
        if (item.ownerUserId) notifyUserIds.add(item.ownerUserId);
        item.pledges.forEach(p => notifyUserIds.add(p.pledgerUserId));

        for (const userId of notifyUserIds) {
          await createNotification(tx, {
            recipientUserId: userId,
            type: "PRICE_INCREASED",
            payload: {
              gameName, familyId, familyName,
              newPriceFormatted: formatCurrency(newPrice, currency),
              missingFormatted: formatCurrency(Math.max(0, missing), currency),
              reverted: reverted ? "1" : "",
            },
          });
        }
      });

      log.push(`[RISE] ${gameName}: ${oldPrice}→${newPrice}${reverted ? " (reverted to open)" : ""}`);
    }
  }

  return NextResponse.json({ ok: true, processed: items.length, changes: log });
}
