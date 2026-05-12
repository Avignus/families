import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  const user = await requireSession();
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

  // Soft-cancel active pledges from this member in this family
  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: membership.id },
      data: { status: "removed" },
    });

    // Cancel pledges on items in this family
    const familyItems = await tx.wishlistItem.findMany({
      where: { familyId: params.id },
      select: { id: true },
    });
    const itemIds = familyItems.map((i) => i.id);

    if (itemIds.length > 0) {
      await tx.pledge.updateMany({
        where: {
          pledgerUserId: params.userId,
          wishlistItemId: { in: itemIds },
          status: "active",
        },
        data: { status: "withdrawn" },
      });
    }
  });

  return ok({ message: "Member removed" });
}
