import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { createPixPayment, ASAAS_MIN_CHARGE_CENTS } from "@/lib/asaas";
import { prisma } from "@/lib/prisma";

const BodySchema = z.object({
  amountCents: z.number().int().min(ASAAS_MIN_CHARGE_CENTS),
});

export async function POST(req: NextRequest) {
  const user = await requireSession();
  if (isApiError(user)) return user;

  const body = await parseBody(req, BodySchema);
  if (isApiError(body)) return body;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { steamId: true, personaName: true },
  });
  if (!dbUser) return err("NOT_FOUND", "User not found", 404);

  const notificationUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/asaas`;

  const pix = await createPixPayment({
    amountCents: body.amountCents,
    description: "Families — Recarga de créditos",
    payerSteamId: dbUser.steamId,
    payerName: dbUser.personaName,
    externalReference: `credits:${user.id}`,
    notificationUrl,
  });

  return ok({ pix });
}
