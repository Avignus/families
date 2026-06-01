import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications/service";

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await requireSession();
  const body = await req.json().catch(() => ({}));
  const removalReason: string | undefined = typeof body?.reason === "string" ? body.reason : undefined;
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const isSelf = params.userId === user.id;
  const isChief = family.chiefId === user.id;

  if (!isSelf && !isChief) {
    return err("FORBIDDEN", "Only the chief or the member themselves can remove a member", 403);
  }

  // Chief cannot remove themselves — must transfer first
  if (params.userId === family.chiefId) {
    return err(
      "CHIEF_CANNOT_LEAVE",
      "The chief must transfer chieftainship before leaving. Use POST /families/:id/transfer-chief first.",
      400
    );
  }

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: params.userId, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("NOT_FOUND", "Active membership not found", 404);
  }

  // ── Spot pro-rata refund ─────────────────────────────────────────────────
  // When a chief removes a spot buyer before spotExpiresAt, the buyer is
  // entitled to a refund proportional to the remaining time.
  const now = new Date();
  const isActiveSpot =
    !isSelf &&
    isChief &&
    membership.spotExpiresAt !== null &&
    membership.feePaidAt !== null &&
    membership.spotExpiresAt > now;

  let spotRefundCents = 0;

  if (isActiveSpot) {
    const feePaidAt = membership.feePaidAt!;
    const spotExpiresAt = membership.spotExpiresAt!;
    const totalMs = spotExpiresAt.getTime() - feePaidAt.getTime();
    const remainingMs = spotExpiresAt.getTime() - now.getTime();
    const remainingFraction = totalMs > 0 ? Math.max(0, remainingMs / totalMs) : 0;
    // Refund is based on the chief's net escrow (what the chief actually received).
    // Platform commission is not returned since the coordination service was rendered.
    const escrow = membership.spotEscrowCents ?? 0;
    spotRefundCents = Math.round(escrow * remainingFraction);
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: membership.id },
      data: { status: "removed" },
    });

    // Pledge cleanup: withdraw and refund active pledges from this member
    const pledges = await tx.pledge.findMany({
      where: {
        pledgerUserId: params.userId,
        status: "active",
        wishlistItem: { familyId: params.id },
      },
      include: {
        wishlistItem: {
          select: { id: true, status: true, targetPriceCents: true, disbursedAt: true },
        },
      },
    });

    if (pledges.length > 0) {
      const pledgeIds = pledges.map((p) => p.id);
      await tx.pledge.updateMany({
        where: { id: { in: pledgeIds } },
        data: { status: "withdrawn" },
      });

      for (const pledge of pledges) {
        const creditAmount =
          (pledge.paidAt ? (pledge.pixAmountCents ?? 0) : 0) + pledge.creditsCentsUsed;
        if (creditAmount > 0) {
          await creditWallet(tx, params.userId, creditAmount, "member_removed", pledge.id);
        }
      }

      // Revert funded → open for items no longer fully covered
      const uniqueItems = Object.values(
        Object.fromEntries(pledges.map((p) => [p.wishlistItem.id, p.wishlistItem]))
      );
      const fundedItems = uniqueItems.filter(
        (item) => item.status === "funded" && !item.disbursedAt
      );
      for (const item of fundedItems) {
        const { _sum } = await tx.pledge.aggregate({
          where: { wishlistItemId: item.id, status: "active" },
          _sum: { amountCents: true },
        });
        if ((_sum.amountCents ?? 0) < item.targetPriceCents) {
          await tx.wishlistItem.update({
            where: { id: item.id },
            data: { status: "open" },
          });
        }
      }
    }

    // Spot pro-rata refund: credit buyer wallet and clawback from chief's earnings
    if (spotRefundCents > 0) {
      await creditWallet(tx, params.userId, spotRefundCents, "spot_removed", membership.id);

      const chief = await tx.user.findUnique({
        where: { id: family.chiefId },
        select: { chiefSpotEarningsCents: true },
      });
      const currentEarnings = chief?.chiefSpotEarningsCents ?? 0;
      await tx.user.update({
        where: { id: family.chiefId },
        data: { chiefSpotEarningsCents: Math.max(0, currentEarnings - spotRefundCents) },
      });

      const currency = family.currency ?? "BRL";
      const refundAmountFormatted = formatCurrency(spotRefundCents, currency);

      await createNotification(tx, {
        recipientUserId: params.userId,
        type: "SPOT_REMOVED_REFUND",
        payload: {
          familyId: params.id,
          familyName: family.name,
          refundCents: spotRefundCents,
          refundAmountFormatted,
        },
      });
    }
  });

  if (removalReason) {
    console.log(`Member ${params.userId} removed from family ${params.id} by ${user.id}. Reason: ${removalReason}`);
  }

  return ok({ message: "Member removed", spotRefundCents });
}
