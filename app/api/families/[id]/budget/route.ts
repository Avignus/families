import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const BudgetSchema = z.object({
  monthlyBudgetCents: z.number().int().min(0),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, BudgetSchema);
  if (isApiError(body)) return body;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId: user.id, familyId: params.id } },
  });
  if (!membership || membership.status !== "active") {
    return err("FORBIDDEN", "Você não é membro desta família", 403);
  }

  const updated = await prisma.familyMembership.update({
    where: { id: membership.id },
    data: { monthlyBudgetCents: body.monthlyBudgetCents },
  });

  return ok({ monthlyBudgetCents: updated.monthlyBudgetCents });
}
