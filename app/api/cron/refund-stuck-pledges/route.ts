import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payment";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

const GRACE_PERIOD_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;


export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req, process.env.CRON_SECRET, true)) return NextResponse.json({ ok: false }, { status: 401 });

  const candidates = await prisma.wishlistItem.findMany({
    where: {
      status: "funded",
      disbursedAt: null,
      owner: { pixKey: null },
    },
    include: {
      owner: { select: { id: true, personaName: true } },
      family: { select: { id: true, name: true, currency: true } },
      pledges: {
        where: { status: "active" },
        select: {
          id: true,
          pledgerUserId: true,
          amountCents: true,
          pixPaymentId: true,
          pixAmountCents: true,
          creditsCentsUsed: true,
          paidAt: true,
        },
      },
    },
  });

  const results: Array<{ itemId: string; status: string; refunded?: number }> = [];

  for (const item of candidates) {
    const paidPledges = item.pledges.filter((p) => p.paidAt !== null);
    if (paidPledges.length === 0) {
      results.push({ itemId: item.id, status: "skipped_no_paid_pledges" });
      continue;
    }

    const latestPaidAt = paidPledges.reduce(
      (max, p) => (p.paidAt! > max ? p.paidAt! : max),
      paidPledges[0].paidAt!
    );
    const daysElapsed = Math.floor((Date.now() - latestPaidAt.getTime()) / ONE_DAY_MS);

    if (daysElapsed < GRACE_PERIOD_DAYS) {
      const steamData = await getAppDetails(item.steamAppId).catch(() => null);
      const gameName = steamData?.name ?? `App #${item.steamAppId}`;
      const totalCents = paidPledges.reduce((s, p) => s + p.amountCents, 0);
      const reminderLevel = item.pixKeyReminderLevel;

      if (daysElapsed >= 6 && reminderLevel < 2 && item.owner) {
        await prisma.$transaction(async (tx) => {
          await tx.wishlistItem.update({
            where: { id: item.id },
            data: { pixKeyReminderLevel: 2 },
          });
          await createNotification(tx, {
            recipientUserId: item.owner!.id,
            type: "PIX_KEY_FINAL_WARNING",
            payload: {
              itemId: item.id,
              familyId: item.family.id,
              gameName,
              amountCents: totalCents,
              currency: item.family.currency,
            },
          });
        });
        results.push({ itemId: item.id, status: "reminded_d6" });
      } else if (daysElapsed >= 3 && reminderLevel < 1 && item.owner) {
        await prisma.$transaction(async (tx) => {
          await tx.wishlistItem.update({
            where: { id: item.id },
            data: { pixKeyReminderLevel: 1 },
          });
          await createNotification(tx, {
            recipientUserId: item.owner!.id,
            type: "PIX_KEY_REMINDER",
            payload: {
              itemId: item.id,
              familyId: item.family.id,
              gameName,
              amountCents: totalCents,
              currency: item.family.currency,
              daysRemaining: GRACE_PERIOD_DAYS - daysElapsed,
            },
          });
        });
        results.push({ itemId: item.id, status: "reminded_d3" });
      } else {
        results.push({ itemId: item.id, status: "skipped_within_grace_period" });
      }
      continue;
    }

    const steamData = await getAppDetails(item.steamAppId).catch(() => null);
    const gameName = steamData?.name ?? `App #${item.steamAppId}`;

    let refundedCount = 0;
    const refundErrors: string[] = [];

    for (const pledge of paidPledges) {
      const hasPixCharge = pledge.pixPaymentId && pledge.pixAmountCents;
      const hasCredits = pledge.creditsCentsUsed > 0;

      if (!hasPixCharge && !hasCredits) continue;

      if (hasPixCharge) {
        try {
          await refundPayment(pledge.pixPaymentId!, pledge.pixAmountCents!);
          refundedCount++;
        } catch (err) {
          console.error(`Refund failed for pledge ${pledge.id}:`, err);
          refundErrors.push(pledge.id);
        }
      } else {
        // Credit-only pledge: no Asaas call needed, credits returned in transaction
        refundedCount++;
      }
    }

    const successfulPledgeIds = paidPledges
      .filter((p) => {
        const hasPixCharge = p.pixPaymentId && p.pixAmountCents;
        const hasCredits = p.creditsCentsUsed > 0;
        if (!hasPixCharge && !hasCredits) return false;
        return !refundErrors.includes(p.id);
      })
      .map((p) => p.id);

    if (successfulPledgeIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.pledge.updateMany({
          where: { id: { in: successfulPledgeIds } },
          data: { status: "withdrawn" },
        });

        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { status: "open", pixKeyReminderLevel: 0 },
        });

        for (const pledge of paidPledges.filter((p) => successfulPledgeIds.includes(p.id))) {
          if (pledge.creditsCentsUsed > 0) {
            await tx.user.update({
              where: { id: pledge.pledgerUserId },
              data: { creditsCents: { increment: pledge.creditsCentsUsed } },
            });
          }

          const totalRefundCents = (pledge.pixAmountCents ?? 0) + pledge.creditsCentsUsed;
          const refundAmountFormatted = formatCurrency(totalRefundCents, item.family.currency);
          await createNotification(tx, {
            recipientUserId: pledge.pledgerUserId,
            type: "PLEDGE_REFUNDED_NO_PIX_KEY",
            payload: {
              itemId: item.id,
              familyId: item.family.id,
              gameName,
              refundAmountFormatted,
            },
          });
        }

        if (item.owner) {
          await createNotification(tx, {
            recipientUserId: item.owner.id,
            type: "ITEM_UNFUNDED_NO_PIX_KEY",
            payload: {
              itemId: item.id,
              familyId: item.family.id,
              gameName,
              contributorCount: successfulPledgeIds.length,
            },
          });
        }
      });
    }

    results.push({
      itemId: item.id,
      status: refundErrors.length > 0 ? "partial" : "refunded",
      refunded: refundedCount,
    });
  }

  return NextResponse.json({ ok: true, checked: candidates.length, results });
}
