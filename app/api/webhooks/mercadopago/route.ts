import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus, verifyWebhookSignature } from "@/lib/mercadopago";
import { createNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  // Verify webhook signature
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  const dataId = String(body?.data?.id ?? "");

  if (xSignature && !verifyWebhookSignature({ xSignature, xRequestId, dataId })) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // Only handle payment notifications
  if (body.type !== "payment" || !dataId) {
    return NextResponse.json({ ok: true });
  }

  const mpStatus = await getPaymentStatus(dataId);
  if (!mpStatus) return NextResponse.json({ ok: true });

  const pledge = await prisma.pledge.findUnique({
    where: { mpPaymentId: dataId },
    include: {
      wishlistItem: { include: { family: true } },
      pledger: true,
    },
  });

  if (!pledge) return NextResponse.json({ ok: true });

  const previousStatus = pledge.mpStatus;

  // Update pledge payment status
  await prisma.$transaction(async (tx) => {
    const updates: Record<string, unknown> = { mpStatus };

    if (mpStatus === "approved" && !pledge.paidAt) {
      updates.paidAt = new Date();

      // Check if ALL active pledges on this item are now paid
      const unpaidPledges = await tx.pledge.count({
        where: {
          wishlistItemId: pledge.wishlistItemId,
          status: "active",
          paidAt: null,
          id: { not: pledge.id },
        },
      });

      // Notify item owner about the confirmed payment
      if (pledge.wishlistItem.ownerUserId && pledge.wishlistItem.ownerUserId !== pledge.pledgerUserId) {
        const steamData = await import("@/lib/steam").then((m) =>
          m.getAppDetails(pledge.wishlistItem.steamAppId)
        );
        const gameName = steamData?.name ?? `App #${pledge.wishlistItem.steamAppId}`;

        await createNotification(tx, {
          recipientUserId: pledge.wishlistItem.ownerUserId,
          type: "PLEDGE_RECEIVED",
          payload: {
            pledgeId: pledge.id,
            itemId: pledge.wishlistItemId,
            familyId: pledge.wishlistItem.familyId,
            familyName: pledge.wishlistItem.family.name,
            ownerUserId: pledge.wishlistItem.ownerUserId,
            gameName,
            pledgerId: pledge.pledgerUserId,
            personaName: pledge.pledger.personaName,
            amountCents: pledge.amountCents,
            currency: pledge.wishlistItem.currency,
            percent: Math.round((pledge.amountCents / pledge.wishlistItem.targetPriceCents) * 100),
            paymentConfirmed: true,
          },
        });
      }
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled") {
      // Downgrade pledge back to withdrawn if payment failed
      updates.status = "withdrawn";
      if (pledge.wishlistItem.status === "funded") {
        await tx.wishlistItem.update({
          where: { id: pledge.wishlistItemId },
          data: { status: "open" },
        });
      }
    }

    await tx.pledge.update({ where: { id: pledge.id }, data: updates });
  });

  return NextResponse.json({ ok: true });
}
