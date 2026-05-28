import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, isApiError, ok, err, parseBody } from "@/lib/api";
import { createPixPayment, MIN_CHARGE_CENTS, getWebhookPath } from "@/lib/payment";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/utils";

const BodySchema = z.object({
  amountCents: z.number().int().min(MIN_CHARGE_CENTS),
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

  const pix = await createPixPayment({
    amountCents: body.amountCents,
    description: "Families — Recarga de créditos",
    payerSteamId: dbUser.steamId,
    payerName: dbUser.personaName,
    externalReference: `credits:${user.id}`,
    notificationUrl: `${getAppBaseUrl(req)}${getWebhookPath()}`,
  });

  return ok({ pix });
}
