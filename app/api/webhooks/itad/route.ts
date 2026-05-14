import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

function getSurplusFeeBps(): number {
  const bps = parseInt(process.env.PLATFORM_SURPLUS_FEE_BPS ?? "1000", 10);
  return isNaN(bps) || bps < 0 || bps > 10000 ? 1000 : bps;
}

type ItadDeal = {
  shop?: { id?: string };
  price?: { amount?: number; amountInt?: number; currency?: string };
  regular?: { amount?: number };
  cut?: number;
};

type ItadGameNotification = {
  id: string;    // ITAD UUID
  slug: string;
  title: string;
  deals?: ItadDeal[];
  lastPrice?: { amount?: number; amountInt?: number; currency?: string };
};

export async function POST(req: NextRequest) {
  const event = req.headers.get("itad-event");
  const hookId = req.headers.get("itad-hook-id");

  // Validate hook ID matches our configured secret
  const expectedHookId = process.env.ITAD_HOOK_ID;
  if (expectedHookId && hookId !== expectedHookId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Ping — just acknowledge
  if (event === "ping") {
    return new Response("pong", { status: 200 });
  }

  if (event !== "notification-waitlist") {
    return NextResponse.json({ ok: true }); // ignore unknown events
  }

  let games: ItadGameNotification[];
  try {
    games = await req.json();
    if (!Array.isArray(games)) return NextResponse.json({ ok: false }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  for (const game of games) {
    // Find the Steam deal in the deals array
    const steamDeal = game.deals?.find(d => d.shop?.id === "steam");
    const priceCents = steamDeal?.price?.amountInt ?? (steamDeal?.price?.amount ? Math.round(steamDeal.price.amount * 100) : null);
    const currency = steamDeal?.price?.currency ?? "BRL";

    if (!priceCents) continue;

    // Resolve steamAppId: find by exact title match in our steamAppCache
    const cacheEntry = await prisma.steamAppCache.findFirst({
      where: { payload: { path: ["name"], equals: game.title } },
      select: { steamAppId: true },
    });
    if (!cacheEntry) continue;

    const steamAppId = cacheEntry.steamAppId;

    // Record price snapshot
    await prisma.steamPriceHistory.create({
      data: { steamAppId, priceCents, currency },
    });

    // Sync all open/funded wishlist items for this game
    const items = await prisma.wishlistItem.findMany({
      where: { steamAppId, status: { in: ["open", "funded"] } },
      include: {
        family: { select: { id: true, name: true, currency: true } },
        pledges: {
          where: { status: "active" },
          select: { id: true, pledgerUserId: true, amountCents: true, paidAt: true },
        },
      },
    });

    for (const item of items) {
      const oldPrice = item.targetPriceCents;
      const familyId = item.family.id;
      const familyName = item.family.name;
      const itemCurrency = item.family.currency;
      const totalPledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);
      const delta = Math.abs(priceCents - oldPrice) / (oldPrice || 1);
      if (delta < 0.02) continue;

      const steamData = await getAppDetails(steamAppId);
      const gameName = steamData?.name ?? game.title;

      if (priceCents < oldPrice) {
        const rawSurplus = Math.max(0, totalPledged - priceCents);
        const feeBps = getSurplusFeeBps();
        const platformFee = rawSurplus > 0 ? Math.floor(rawSurplus * feeBps / 10000) : 0;
        const distributableSurplus = rawSurplus - platformFee;
        const wasOpen = item.status === "open";
        const nowFunded = totalPledged >= priceCents;

        await prisma.$transaction(async (tx) => {
          await tx.wishlistItem.update({
            where: { id: item.id },
            data: { targetPriceCents: priceCents, status: nowFunded && wasOpen ? "funded" : item.status },
          });

          if (platformFee > 0) {
            await tx.platformRevenue.create({
              data: { amountCents: platformFee, reason: "surplus_fee", metadata: { itemId: item.id, gameName, oldPrice, newPrice: priceCents, source: "itad_webhook" } },
            });
          }

          let distributed = 0;
          for (const pledge of item.pledges) {
            const share = distributableSurplus > 0 ? Math.floor(distributableSurplus * pledge.amountCents / totalPledged) : 0;
            distributed += share;
            if (share > 0) await creditWallet(tx, pledge.pledgerUserId, share, "price_dropped", item.id);
            await createNotification(tx, {
              recipientUserId: pledge.pledgerUserId,
              type: "PRICE_DROPPED",
              payload: { gameName, familyId, familyName, newPriceFormatted: formatCurrency(priceCents, itemCurrency), surplusCents: share, surplusFormatted: share > 0 ? formatCurrency(share, itemCurrency) : "" },
            });
          }

          const remainder = distributableSurplus - distributed;
          if (remainder > 0) {
            await tx.platformRevenue.create({ data: { amountCents: remainder, reason: "surplus_fee", metadata: { itemId: item.id, note: "rounding_remainder" } } });
          }

          if (item.ownerUserId && !item.pledges.some(p => p.pledgerUserId === item.ownerUserId)) {
            await createNotification(tx, {
              recipientUserId: item.ownerUserId,
              type: "PRICE_DROPPED",
              payload: { gameName, familyId, familyName, newPriceFormatted: formatCurrency(priceCents, itemCurrency), surplusCents: 0, surplusFormatted: "" },
            });
          }

          if (nowFunded && wasOpen && item.ownerUserId) {
            await createNotification(tx, {
              recipientUserId: item.ownerUserId,
              type: "ITEM_FUNDED",
              payload: { gameName, familyId, familyName, ownerUserId: item.ownerUserId ?? "", itemId: item.id },
            });
          }
        });
      } else {
        const wasFunded = item.status === "funded";
        const reverted = wasFunded && totalPledged < priceCents;

        await prisma.$transaction(async (tx) => {
          await tx.wishlistItem.update({
            where: { id: item.id },
            data: { targetPriceCents: priceCents, status: reverted ? "open" : item.status },
          });

          const notifyIds = new Set<string>();
          if (item.ownerUserId) notifyIds.add(item.ownerUserId);
          item.pledges.forEach(p => notifyIds.add(p.pledgerUserId));

          for (const userId of notifyIds) {
            await createNotification(tx, {
              recipientUserId: userId,
              type: "PRICE_INCREASED",
              payload: {
                gameName, familyId, familyName,
                newPriceFormatted: formatCurrency(priceCents, itemCurrency),
                missingFormatted: formatCurrency(Math.max(0, priceCents - totalPledged), itemCurrency),
                reverted: reverted ? "1" : "",
              },
            });
          }
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
