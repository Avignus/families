import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; requestId: string } }
) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can approve requests", 403);

  const membership = await prisma.familyMembership.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  });
  if (!membership || membership.familyId !== params.id) {
    return err("NOT_FOUND", "Join request not found", 404);
  }
  if (membership.status !== "pending") {
    return err("INVALID_STATE", "Request is not pending");
  }

  // Single-family rule: reject if the requester joined another family while pending
  const otherActive = await prisma.familyMembership.findFirst({
    where: { userId: membership.userId, status: "active", familyId: { not: params.id } },
    select: { familyId: true },
  });
  if (otherActive) {
    await prisma.familyMembership.update({
      where: { id: params.requestId },
      data: { status: "rejected" },
    });
    return err("ALREADY_IN_FAMILY", "Este usuário já faz parte de outra família e não pode ser aprovado.", 409);
  }

  const isSpot = family.spotPricingEnabled && !!membership.feePaidAt;
  const spotExpiresAt = isSpot ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : undefined;

  await prisma.$transaction(async (tx) => {
    await tx.familyMembership.update({
      where: { id: params.requestId },
      data: { status: "active", joinedAt: new Date(), ...(spotExpiresAt ? { spotExpiresAt } : {}) },
    });
    await createNotification(tx, {
      recipientUserId: membership.userId,
      type: "JOIN_APPROVED",
      payload: { familyId: family.id, familyName: family.name },
    });
  });

  return ok({ message: "Request approved" });
}
