import { NextRequest } from "next/server";
import { requireSession, isApiError, ok, err } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { autoDistributeCredits } from "@/lib/auto-distribute";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findFirst({
    where: { userId: user.id, familyId: params.id, status: "active" },
    select: { id: true },
  });
  if (!membership) return err("FORBIDDEN", "Not a member of this family", 403);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { creditsCents: true },
  });
  if (!dbUser || dbUser.creditsCents <= 0) {
    return err("NO_CREDITS", "No credits available", 400);
  }

  const distributed = await autoDistributeCredits(user.id, dbUser.creditsCents);

  return ok({ distributed });
}
