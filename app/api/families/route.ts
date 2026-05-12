import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const CreateFamilySchema = z.object({
  name: z.string().min(1).max(100),
  currency: z.string().length(3).optional().default("BRL"),
});

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, CreateFamilySchema);
  if (isApiError(body)) return body;

  const family = await prisma.$transaction(async (tx) => {
    const f = await tx.family.create({
      data: {
        name: body.name,
        currency: body.currency,
        chiefId: user.id,
      },
    });
    await tx.familyMembership.create({
      data: {
        userId: user.id,
        familyId: f.id,
        status: "active",
      },
    });
    return f;
  });

  return ok(family, 201);
}

export async function GET() {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const memberships = await prisma.familyMembership.findMany({
    where: { userId: user.id, status: "active" },
    include: {
      family: {
        include: {
          chief: { select: { id: true, personaName: true, avatarUrl: true } },
          _count: {
            select: {
              memberships: { where: { status: "active" } },
              wishlistItems: true,
            },
          },
        },
      },
    },
  });

  return ok(
    memberships.map((m) => ({
      ...m.family,
      memberCount: m.family._count.memberships,
      wishlistCount: m.family._count.wishlistItems,
      isChief: m.family.chiefId === user.id,
    }))
  );
}
