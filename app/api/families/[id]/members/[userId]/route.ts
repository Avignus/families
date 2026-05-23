import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/wallet";

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

  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: membership.id },
      data: { status: "removed" },
    });

    // Load all active pledges from this member on items in this family
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

    if (pledges.length === 0) return;

    const pledgeIds = pledges.map((p) => p.id);
    await tx.pledge.updateMany({
      where: { id: { in: pledgeIds } },
      data: { status: "withdrawn" },
    });

    // Credit removed member's wallet: PIX already paid + credits used
    for (const pledge of pledges) {
      const creditAmount =
        (pledge.paidAt ? (pledge.pixAmountCents ?? 0) : 0) + pledge.creditsCentsUsed;
      if (creditAmount > 0) {
        await creditWallet(tx, params.userId, creditAmount, "member_removed", pledge.id);
      }
    }

    // Revert funded → open for items no longer fully covered (skip already-disbursed items)
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
      if (((_sum.amountCents ?? 0) < item.targetPriceCents)) {
        await tx.wishlistItem.update({
          where: { id: item.id },
          data: { status: "open" },
        });
      }
    }
  });

  if (removalReason) {
    console.log(`Member ${params.userId} removed from family ${params.id} by ${user.id}. Reason: ${removalReason}`);
  }

  return ok({ message: "Member removed" });
}
