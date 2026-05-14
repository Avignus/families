import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validatePixKey } from "@/lib/pix-key";

const UpdateSchema = z.object({
  pixKey: z.string().max(100).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, UpdateSchema);
  if (isApiError(body)) return body;

  const data: Record<string, unknown> = {};

  if (body.pixKey !== undefined) {
    if (body.pixKey) {
      const result = validatePixKey(body.pixKey);
      if (!result.valid) return err("INVALID_PIX_KEY", result.error, 422);
      const existing = await prisma.user.findFirst({
        where: { pixKey: result.normalized },
        select: { id: true },
      });
      if (existing && existing.id !== user.id) {
        return err("PIX_KEY_IN_USE", "Esta chave PIX já está cadastrada em outra conta", 409);
      }
      data.pixKey = result.normalized;
    } else {
      data.pixKey = null;
    }
  }

  if (body.email !== undefined) {
    if (body.email) {
      const existing = await prisma.user.findFirst({
        where: { email: body.email },
        select: { id: true },
      });
      if (existing && existing.id !== user.id) {
        return err("EMAIL_IN_USE", "Este email já está cadastrado em outra conta", 409);
      }
      data.email = body.email;
    } else {
      data.email = null;
    }
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return ok({ pixKey: updated.pixKey, email: updated.email });
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
    email: dbUser.email,
    reputationScore: dbUser.reputationScore,
    creditsCents: dbUser.creditsCents,
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
