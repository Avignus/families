import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications/service";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: { chief: { select: { id: true, personaName: true } } },
  });
  if (!family) return err("NOT_FOUND", "Family not found", 404);

  const existing = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });

  if (existing) {
    if (existing.status === "active") return err("ALREADY_MEMBER", "Already a member of this family");
    if (existing.status === "pending") return err("ALREADY_PENDING", "Join request already pending");
    // rejected/removed — allow re-request
    await prisma.familyMembership.update({
      where: { id: existing.id },
      data: { status: "pending", joinedAt: new Date() },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.familyMembership.create({
        data: { userId: user.id, familyId: params.id, status: "pending" },
      });
      await createNotification(tx, {
        recipientUserId: family.chiefId,
        type: "JOIN_REQUEST",
        payload: {
          familyId: family.id,
          familyName: family.name,
          requesterId: user.id,
          personaName: user.personaName,
        },
      });
    });
  }

  return ok({ message: "Join request sent" }, 201);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the chief can view join requests", 403);

  const requests = await prisma.familyMembership.findMany({
    where: { familyId: params.id, status: "pending" },
    include: { user: { select: { id: true, personaName: true, avatarUrl: true, avatarMedium: true, steamId: true } } },
    orderBy: { joinedAt: "asc" },
  });

  return ok(requests);
}
