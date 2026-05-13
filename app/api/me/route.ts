import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const PixKeySchema = z.object({
  pixKey: z.string().max(100).nullable(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, PixKeySchema);
  if (isApiError(body)) return body;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { pixKey: body.pixKey ?? null },
  });

  return ok({ pixKey: updated.pixKey });
}

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      memberships: {
        where: { status: "active" },
        include: {
          family: {
            include: {
              _count: {
                select: {
                  memberships: { where: { status: "pending" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dbUser) return err("NOT_FOUND", "User not found", 404);

  const pendingRequests = dbUser.memberships
    .filter((m) => m.family.chiefId === user.id)
    .reduce((sum, m) => sum + m.family._count.memberships, 0);

  return ok({
    id: dbUser.id,
    steamId: dbUser.steamId,
    personaName: dbUser.personaName,
    avatarUrl: dbUser.avatarUrl,
    avatarMedium: dbUser.avatarMedium,
    avatarFull: dbUser.avatarFull,
    profileUrl: dbUser.profileUrl,
    pixKey: dbUser.pixKey,
    reputationScore: dbUser.reputationScore,
    families: dbUser.memberships.map((m) => ({
      id: m.family.id,
      name: m.family.name,
      currency: m.family.currency,
      isChief: m.family.chiefId === user.id,
      pendingJoinRequests: m.family.chiefId === user.id ? m.family._count.memberships : 0,
    })),
    totalPendingJoinRequests: pendingRequests,
  });
}
