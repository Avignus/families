import { requireSession, isApiError, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
    select: { status: true, feePaidAt: true, mpStatus: true },
  });

  return ok({
    membershipStatus: membership?.status ?? null,
    paid: membership?.feePaidAt !== null && membership?.feePaidAt !== undefined,
    mpStatus: membership?.mpStatus ?? null,
  });
}
