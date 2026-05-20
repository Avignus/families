import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppDetails } from "@/lib/steam";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

const PRICE_CHANGE_THRESHOLD = 0.02;  // 2% minimum change to trigger pledge sync
const MIN_SAMPLES = 30;               // minimum history records before firing price alerts
const HISTORY_DAYS = 90;              // rolling window for average
const ALERT_LOW_THRESHOLD = 0.80;     // ≤80% of avg → historic low
const ALERT_HIGH_THRESHOLD = 1.20;    // ≥120% of avg → above average
const ALERT_COOLDOWN_DAYS = 7;        // don't re-alert same user for same game within 7 days
const LIBRARY_PRICE_STALENESS_DAYS = 7; // refresh library prices weekly
const LIBRARY_BATCH_SIZE = 150;         // max appIds fetched per run (Steam rate limit)

function getSurplusFeeBps(): number {
  const bps = parseInt(process.env.PLATFORM_SURPLUS_FEE_BPS ?? "1000", 10);
  return isNaN(bps) || bps < 0 || bps > 10000 ? 1000 : bps;
}

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return false;
  if (process.env.NODE_ENV === "production" && !req.headers.get("x-vercel-cron")) return false;
  return true;
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

  // ── Phase 0: backfill prices for active family members' libraries ────────
  // SteamUserCache is keyed by steamId, not User.id — resolve steamIds first
  const activeMemberSteamIds = await prisma.familyMembership.findMany({
    where: { status: "active" },
    include: { user: { select: { steamId: true } } },
  }).then((rows) => rows.map((r) => r.user.steamId));

  if (activeMemberSteamIds.length > 0) {
    const libraryCaches = await prisma.steamUserCache.findMany({
      where: { type: "library", userId: { in: activeMemberSteamIds } },
      select: { payload: true },
    });

    const allLibraryAppIds = new Set<number>();
    for (const cache of libraryCaches) {
      const games = cache.payload as Array<{ appId: number }>;
      for (const game of games) {
        if (game.appId) allLibraryAppIds.add(game.appId);
      }
    }

    const staleThreshold = new Date(
      Date.now() - LIBRARY_PRICE_STALENESS_DAYS * 24 * 60 * 60 * 1000
    );
    const freshIds = await prisma.steamAppCache.findMany({
      where: { steamAppId: { in: [...allLibraryAppIds] }, fetchedAt: { gte: staleThreshold } },
      select: { steamAppId: true },
    }).then((rows) => new Set(rows.map((r) => r.steamAppId)));

    const toFetch = [...allLibraryAppIds]
      .filter((id) => !freshIds.has(id))
      .slice(0, LIBRARY_BATCH_SIZE);

    let libFetched = 0;
    for (const appId of toFetch) {
      const result = await getAppDetails(appId);
      if (result) libFetched++;
    }

    log.push(
      `[LIB] ${allLibraryAppIds.size} unique appIds across active families` +
      `, ${freshIds.size} fresh, fetched ${libFetched}/${toFetch.length}` +
      (toFetch.length === LIBRARY_BATCH_SIZE ? ` (batch capped at ${LIBRARY_BATCH_SIZE})` : "")
    );
  }

  // ── Phase 1: fetch fresh prices + record snapshots ──────────────────────
  // Deduplicate by steamAppId — only fetch each game once per run
  const uniqueAppIds = [...new Set(items.map(i => i.steamAppId))];
  const priceMap = new Map<number, Awaited<ReturnType<typeof getAppDetails>>>();

  for (const appId of uniqueAppIds) {
    const data = await getAppDetails(appId);
    if (!data) continue;
    priceMap.set(appId, data);

    // Record one snapshot per calendar day per game
    if (!data.isFree && data.priceCents > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const alreadyToday = await prisma.steamPriceHistory.findFirst({
        where: { steamAppId: appId, recordedAt: { gte: today } },
        select: { id: true },
      });
      if (!alreadyToday) {
        await prisma.steamPriceHistory.create({
          data: { steamAppId: appId, priceCents: data.priceCents, currency: data.currency },
        });
      }
    }
  }

  // ── Phase 2: pledge sync (price changed) ────────────────────────────────
  for (const item of items) {
    const steamData = priceMap.get(item.steamAppId);
    if (!steamData) continue;

    const oldPrice = item.targetPriceCents;
    const newPrice = steamData.priceCents;
    const currency = item.family.currency;
    const gameName = steamData.name;
    const familyId = item.family.id;
    const familyName = item.family.name;
    const totalPledged = item.pledges.reduce((s, p) => s + p.amountCents, 0);

    // ── Game went free ────────────────────────────────────────────────────
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
            payload: { gameName, familyId, familyName, refundFormatted: refundAmount > 0 ? formatCurrency(refundAmount, currency) : "" },
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
      log.push(`[FREE] ${gameName} → cancelled`);
      continue;
    }

    if (!newPrice || newPrice === oldPrice) continue;
    const delta = Math.abs(newPrice - oldPrice) / oldPrice;
    if (delta < PRICE_CHANGE_THRESHOLD) continue;

    // ── Price dropped ─────────────────────────────────────────────────────
    if (newPrice < oldPrice) {
      // Only paid pledges generate surplus — pending PIX hasn't settled yet
      const paidPledges = item.pledges.filter((p) => p.paidAt !== null);
      const totalPaid = paidPledges.reduce((s, p) => s + p.amountCents, 0);
      const rawSurplus = Math.max(0, totalPaid - newPrice);
      const feeBps = getSurplusFeeBps();
      const platformFee = rawSurplus > 0 ? Math.floor(rawSurplus * feeBps / 10000) : 0;
      const distributableSurplus = rawSurplus - platformFee;
      const wasOpen = item.status === "open";
      const nowFunded = totalPledged >= newPrice;

      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { targetPriceCents: newPrice, status: nowFunded && wasOpen ? "funded" : item.status },
        });

        if (platformFee > 0) {
          await tx.platformRevenue.create({
            data: { amountCents: platformFee, reason: "surplus_fee", metadata: { itemId: item.id, gameName, oldPrice, newPrice, rawSurplus, feeBps } },
          });
        }

        // Distribute cashback proportionally among paid pledgers only
        let distributed = 0;
        for (const pledge of paidPledges) {
          const share = distributableSurplus > 0 && totalPaid > 0
            ? Math.floor(distributableSurplus * pledge.amountCents / totalPaid)
            : 0;
          distributed += share;
          if (share > 0) await creditWallet(tx, pledge.pledgerUserId, share, "price_dropped", item.id);
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "PRICE_DROPPED",
            payload: { gameName, familyId, familyName, newPriceFormatted: formatCurrency(newPrice, currency), surplusCents: share, surplusFormatted: share > 0 ? formatCurrency(share, currency) : "" },
          });
        }
        // Notify pending pledgers (no cashback, but they should know the price dropped)
        for (const pledge of item.pledges.filter((p) => !p.paidAt)) {
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "PRICE_DROPPED",
            payload: { gameName, familyId, familyName, newPriceFormatted: formatCurrency(newPrice, currency), surplusCents: 0, surplusFormatted: "" },
          });
        }

        const remainder = distributableSurplus - distributed;
        if (remainder > 0) {
          await tx.platformRevenue.create({
            data: { amountCents: remainder, reason: "surplus_fee", metadata: { itemId: item.id, gameName, note: "rounding_remainder" } },
          });
        }

        if (item.ownerUserId && !item.pledges.some(p => p.pledgerUserId === item.ownerUserId)) {
          await createNotification(tx, {
            recipientUserId: item.ownerUserId,
            type: "PRICE_DROPPED",
            payload: { gameName, familyId, familyName, newPriceFormatted: formatCurrency(newPrice, currency), surplusCents: 0, surplusFormatted: "" },
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
      log.push(`[DROP] ${gameName}: ${oldPrice}→${newPrice}, surplus ${rawSurplus} (fee ${platformFee}, distributed ${distributableSurplus})`);
    }

    // ── Price increased ───────────────────────────────────────────────────
    else {
      const wasFunded = item.status === "funded";
      const reverted = wasFunded && totalPledged < newPrice;

      await prisma.$transaction(async (tx) => {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { targetPriceCents: newPrice, status: reverted ? "open" : item.status },
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
              newPriceFormatted: formatCurrency(newPrice, currency),
              missingFormatted: formatCurrency(Math.max(0, newPrice - totalPledged), currency),
              reverted: reverted ? "1" : "",
            },
          });
        }
      });
      log.push(`[RISE] ${gameName}: ${oldPrice}→${newPrice}${reverted ? " (reverted)" : ""}`);
    }
  }

  // ── Phase 3: price intelligence alerts for premium users ─────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS);
  const alertCooloff = new Date();
  alertCooloff.setDate(alertCooloff.getDate() - ALERT_COOLDOWN_DAYS);

  for (const appId of uniqueAppIds) {
    const steamData = priceMap.get(appId);
    if (!steamData || steamData.isFree || !steamData.priceCents) continue;

    const history = await prisma.steamPriceHistory.findMany({
      where: { steamAppId: appId, recordedAt: { gte: cutoff } },
      select: { priceCents: true },
    });

    if (history.length < MIN_SAMPLES) continue;

    const avg = Math.round(history.reduce((s, h) => s + h.priceCents, 0) / history.length);
    const current = steamData.priceCents;
    const ratio = current / avg;

    const alertType = ratio <= ALERT_LOW_THRESHOLD
      ? "PRICE_ALERT_LOW" as const
      : ratio >= ALERT_HIGH_THRESHOLD
      ? "PRICE_ALERT_HIGH" as const
      : null;

    if (!alertType) continue;

    const percentDiff = Math.round(Math.abs(1 - ratio) * 100);

    // Find premium members in families that have this game on their wishlist
    const premiumUsers = await prisma.user.findMany({
      where: {
        isPremium: true,
        memberships: {
          some: {
            status: "active",
            family: { wishlistItems: { some: { steamAppId: appId, status: { in: ["open", "funded"] } } } },
          },
        },
      },
      select: { id: true },
    });

    if (premiumUsers.length === 0) continue;

    // Get a familyId for the link (first family this game appears in)
    const sampleItem = items.find(i => i.steamAppId === appId);
    const familyId = sampleItem?.family.id ?? "";
    const currency = sampleItem?.family.currency ?? steamData.currency;

    for (const { id: userId } of premiumUsers) {
      // Cooldown check: skip if already alerted this user for this game recently
      const recentAlert = await prisma.notification.findFirst({
        where: {
          recipientUserId: userId,
          type: alertType,
          createdAt: { gte: alertCooloff },
          payload: { path: ["steamAppId"], equals: appId },
        },
      });
      if (recentAlert) continue;

      await createNotification(prisma, {
        recipientUserId: userId,
        type: alertType,
        payload: {
          gameName: steamData.name,
          familyId,
          steamAppId: appId,
          priceFormatted: formatCurrency(current, currency),
          avgFormatted: formatCurrency(avg, currency),
          ...(alertType === "PRICE_ALERT_LOW"
            ? { percentBelow: percentDiff }
            : { percentAbove: percentDiff }),
        },
      });
    }

    log.push(`[ALERT ${alertType}] ${steamData.name}: ${current} vs avg ${avg} (${percentDiff}% diff), notified ${premiumUsers.length} premium users`);
  }

  return NextResponse.json({ ok: true, processed: items.length, snapshots: uniqueAppIds.length, changes: log });
}
