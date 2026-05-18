import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const BudgetSchema = z.object({
  monthlyBudgetCents: z.number().int().min(0).optional(),
  autoDistributeEnabled: z.boolean().optional(),
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

  const data: Record<string, unknown> = {};
  if (body.monthlyBudgetCents !== undefined) data.monthlyBudgetCents = body.monthlyBudgetCents;
  if (body.autoDistributeEnabled !== undefined) data.autoDistributeEnabled = body.autoDistributeEnabled;

  const updated = await prisma.familyMembership.update({
    where: { id: membership.id },
    data,
  });

  return ok({ monthlyBudgetCents: updated.monthlyBudgetCents, autoDistributeEnabled: updated.autoDistributeEnabled });
}
