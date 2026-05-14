import { NextResponse } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// DELETE /api/me/account — LGPD right to erasure
export async function DELETE() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  // Cannot delete if chief of active families with other members
  const chiefFamilies = await prisma.family.findMany({
    where: { chiefId: user.id },
    include: {
      _count: { select: { memberships: { where: { status: "active" } } } },
    },
  });

  const blockedFamily = chiefFamilies.find((f) => f._count.memberships > 1);
  if (blockedFamily) {
    return err(
      "CHIEF_HAS_MEMBERS",
      `Transfira o cargo de chief ou remova todos os membros da família "${blockedFamily.name}" antes de excluir sua conta.`,
      409
    );
  }

  // Anonymize financial records (retain for legal obligation) then delete user
  await prisma.$transaction(async (tx) => {
    // Anonymize pledges — keep financial record but remove user link
    await tx.pledge.updateMany({
      where: { pledgerUserId: user.id },
      data: { pledgerUserId: null as never },
    });

    // Anonymize wishlist items
    await tx.wishlistItem.updateMany({
      where: { ownerUserId: user.id },
      data: { ownerUserId: null as never },
    });

    // Remove memberships, notifications, votes
    await tx.voteBallot.deleteMany({ where: { userId: user.id } });
    await tx.notification.deleteMany({ where: { recipientUserId: user.id } });
    await tx.familyMembership.deleteMany({ where: { userId: user.id } });

    // Delete families where user is sole member / chief
    for (const family of chiefFamilies) {
      await tx.family.delete({ where: { id: family.id } });
    }

    // Delete user
    await tx.user.delete({ where: { id: user.id } });
  });

  // Invalidate session by returning a response that clears the cookie
  const response = NextResponse.json({ ok: true, message: "Conta excluída com sucesso." });
  response.cookies.delete("next-auth.session-token");
  response.cookies.delete("__Secure-next-auth.session-token");
  return response;
}
