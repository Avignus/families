import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/asaas";
import { createNotification } from "@/lib/notifications/service";
import { getAppDetails } from "@/lib/steam";
import { formatCurrency } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

const GRACE_PERIOD_DAYS = 7;

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return false;
  if (process.env.NODE_ENV === "production" && !req.headers.get("x-vercel-cron")) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  // Items that are funded, not disbursed, owner has no PIX key,
  // and all pledges were paid more than GRACE_PERIOD_DAYS ago.
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
          mpPaymentId: true,
          mpAmountCents: true,
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
    if (latestPaidAt > cutoff) {
      results.push({ itemId: item.id, status: "skipped_within_grace_period" });
      continue;
    }

    const steamData = await getAppDetails(item.steamAppId).catch(() => null);
    const gameName = steamData?.name ?? `App #${item.steamAppId}`;

    let refundedCount = 0;
    const refundErrors: string[] = [];

    for (const pledge of paidPledges) {
      if (!pledge.mpPaymentId || !pledge.mpAmountCents) continue;
      try {
        await refundPayment(pledge.mpPaymentId, pledge.mpAmountCents);
        refundedCount++;
      } catch (err) {
        console.error(`Refund failed for pledge ${pledge.id}:`, err);
        refundErrors.push(pledge.id);
      }
    }

    // Even if some refunds failed, mark successfully-refunded pledges and revert the item.
    // Pledges with refund errors stay active for manual review.
    const successfulPledgeIds = paidPledges
      .filter((p) => p.mpPaymentId && p.mpAmountCents && !refundErrors.includes(p.id))
      .map((p) => p.id);

    if (successfulPledgeIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.pledge.updateMany({
          where: { id: { in: successfulPledgeIds } },
          data: { status: "withdrawn" },
        });

        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { status: "open" },
        });

        // Notify each contributor
        for (const pledge of paidPledges.filter((p) => successfulPledgeIds.includes(p.id))) {
          const refundAmountFormatted = formatCurrency(pledge.mpAmountCents!, item.family.currency);
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

        // Notify the item owner
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
