import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ newChiefUserId: z.string() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const family = await prisma.family.findUnique({ where: { id: params.id } });
  if (!family) return err("NOT_FOUND", "Family not found", 404);
  if (family.chiefId !== user.id) return err("FORBIDDEN", "Only the current chief can transfer chieftainship", 403);

  const body = await parseBody(req, Schema);
  if (isApiError(body)) return body;

  const newChiefMembership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: body.newChiefUserId, familyId: params.id } },
  });
  if (!newChiefMembership || newChiefMembership.status !== "active") {
    return err("NOT_FOUND", "New chief must be an active member of the family", 404);
  }

  await prisma.family.update({
    where: { id: params.id },
    data: { chiefId: body.newChiefUserId },
  });

  return ok({ message: "Chief transferred" });
}
