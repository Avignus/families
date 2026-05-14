import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

// Minimum relative price change to trigger a sync (2%)
const THRESHOLD = 0.02;

// Platform fee on surplus, in basis points (default 10% = 1000 bps)
// Set PLATFORM_SURPLUS_FEE_BPS in env to override
function getSurplusFeeBps(): number {
  const bps = parseInt(process.env.PLATFORM_SURPLUS_FEE_BPS ?? "1000", 10);
  return isNaN(bps) || bps < 0 || bps > 10000 ? 1000 : bps;
}

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
      const rawSurplus = Math.max(0, totalPledged - newPrice);
      const feeBps = getSurplusFeeBps();
      const platformFee = rawSurplus > 0 ? Math.floor(rawSurplus * feeBps / 10000) : 0;
      const distributableSurplus = rawSurplus - platformFee;
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

        // Record platform fee
        if (platformFee > 0) {
          await tx.platformRevenue.create({
            data: {
              amountCents: platformFee,
              reason: "surplus_fee",
              metadata: { itemId: item.id, gameName, oldPrice, newPrice, rawSurplus, feeBps },
            },
          });
        }

        // Credit distributable surplus proportionally to pledgers
        let distributed = 0;
        for (const pledge of item.pledges) {
          const pledgerShare = distributableSurplus > 0
            ? Math.floor(distributableSurplus * pledge.amountCents / totalPledged)
            : 0;
          distributed += pledgerShare;
          if (pledgerShare > 0) {
            await creditWallet(tx, pledge.pledgerUserId, pledgerShare, "price_dropped", item.id);
          }
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "PRICE_DROPPED",
            payload: {
              gameName, familyId, familyName,
              newPriceFormatted: formatCurrency(newPrice, currency),
              surplusCents: pledgerShare,
              surplusFormatted: pledgerShare > 0 ? formatCurrency(pledgerShare, currency) : "",
            },
          });
        }

        // Any rounding remainder goes to platform revenue (not users)
        const remainder = distributableSurplus - distributed;
        if (remainder > 0) {
          await tx.platformRevenue.create({
            data: {
              amountCents: remainder,
              reason: "surplus_fee",
              metadata: { itemId: item.id, gameName, note: "rounding_remainder" },
            },
          });
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

      log.push(`[DROP] ${gameName}: ${oldPrice}→${newPrice}, surplus ${rawSurplus} (fee ${platformFee}, distributed ${distributableSurplus})`);
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
